import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "master_admin" | "owner" | "barber" | "customer";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  rolesLoaded: boolean;
  isAuthenticated: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) {
    console.warn("[auth] failed to load roles:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.role as AppRole);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  useEffect(() => {
    // Set up listener BEFORE getSession (Supabase recommendation)
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user?.id) {
        // Track login event for CRM
        if (event === "SIGNED_IN") {
          supabase.rpc("track_platform_login", { arg_user_id: newSession.user.id })
            .then(({ error }) => {
              if (error) console.error("[auth] failed to track login:", error.message);
            });
        }

        setRolesLoaded(false);
        // Defer DB call to avoid auth deadlock
        setTimeout(() => {
          fetchRoles(newSession.user.id).then((r) => {
            setRoles(r);
            setRolesLoaded(true);
          });
        }, 0);
      } else {
        setRoles([]);
        setRolesLoaded(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      
      if (data.session?.user?.id) {
        // Also track on initial session if we just loaded
        supabase.rpc("track_platform_login", { arg_user_id: data.session.user.id })
          .then(({ error }) => {
            if (error) console.error("[auth] error tracking initial session:", error?.message);
          });

        fetchRoles(data.session.user.id).then((r) => {
          setRoles(r);
          setRolesLoaded(true);
          setLoading(false);
        });
      } else {
        setRolesLoaded(true);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      roles,
      loading,
      rolesLoaded,
      isAuthenticated: !!session,
      hasRole: (r) => roles.includes(r),
      hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refreshRoles: async () => {
        if (user) {
          setRolesLoaded(false);
          const r = await fetchRoles(user.id);
          setRoles(r);
          setRolesLoaded(true);
        }
      },
    }),
    [user, session, roles, loading, rolesLoaded],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
