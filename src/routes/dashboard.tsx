import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/logo";
import { GoldWatermark } from "@/components/brand/watermark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Calendar,
  Users,
  LayoutDashboard,
  LogOut,
  Loader2,
  DollarSign,
  Clock,
  Menu,
  Settings,
  Image as ImageIcon,
  Layout,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/dashboard/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Painel — LÉO MORAES BARBER" }] }),
  component: DashboardLayout,
});

// Realtime cross-table: qualquer mudança em appointments/transactions/customers
// invalida todas as queries relevantes do painel sem precisar refresh manual.
function useDashboardRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
      qc.invalidateQueries({ queryKey: ["finance-overview"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments-month"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-detail"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    };
    const ch = supabase
      .channel("dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, invalidateAll)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}

const navItems: ReadonlyArray<{
  to: "/dashboard" | "/dashboard/agenda" | "/dashboard/clientes" | "/dashboard/financeiro" | "/dashboard/portfolio" | "/dashboard/horarios" | "/dashboard/configuracoes" | "/dashboard/landing" | "/dashboard/historico";
  label: string;
  icon: any;
  exact?: boolean;
}> = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/agenda", label: "Agenda", icon: Calendar },
  { to: "/dashboard/historico", label: "Histórico", icon: History },
  { to: "/dashboard/clientes", label: "Clientes", icon: Users },
  { to: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/dashboard/portfolio", label: "Portfólio", icon: ImageIcon },
  { to: "/dashboard/horarios", label: "Horários", icon: Clock },
  { to: "/dashboard/landing", label: "Landing Page", icon: Layout },
  { to: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <nav className="flex-1 space-y-1 p-4">
      {navItems.map((item) => {
        const active = item.exact
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-gold/10 text-gold"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, isAuthenticated, rolesLoaded, hasAnyRole, signOut, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useDashboardRealtime();

  // Fecha o drawer mobile ao trocar de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      // Permitir acesso público à landing page
      if (location.pathname === "/") return;
      navigate({ to: "/auth" });
      return;
    }
    // Aguarda roles carregarem antes de decidir — evita bounce indevido para /cliente
    if (!rolesLoaded) return;
    if (!hasAnyRole(["owner", "barber", "master_admin"])) {
      navigate({ to: "/cliente" });
    }
  }, [loading, isAuthenticated, rolesLoaded, hasAnyRole, navigate, location.pathname]);

  if (loading || !isAuthenticated || !rolesLoaded || !hasAnyRole(["owner", "barber", "master_admin"])) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen bg-background">
      <GoldWatermark />

      {/* Sidebar desktop */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-border/40 bg-surface-1/80 backdrop-blur md:flex md:flex-col">
        <div className="flex h-24 items-center justify-center border-b border-border/40 px-6">
          <Logo size={72} />
        </div>
        <NavLinks />
        <div className="border-t border-border/40 p-4">
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start text-muted-foreground hover:text-foreground"
              onClick={() => signOut().then(() => navigate({ to: "/" }))}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Header mobile com drawer */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-border/40 bg-surface-1 p-0">
              <SheetHeader className="flex h-20 items-center justify-center border-b border-border/40 px-6">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Logo size={56} />
              </SheetHeader>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
              <div className="border-t border-border/40 p-4">
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground"
                  onClick={() => signOut().then(() => navigate({ to: "/" }))}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Logo size={44} />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair"
              onClick={() => signOut().then(() => navigate({ to: "/" }))}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-4 pb-24 sm:p-6 md:p-10 md:pb-10">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
