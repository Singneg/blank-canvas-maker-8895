import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — LÉO MORAES BARBER" }] }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

/** Translate Supabase auth errors into clear PT-BR messages. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Verifique e tente novamente, ou redefina sua senha.";
  }
  if (m.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Este e-mail já possui conta. Faça login ou redefina sua senha.";
  }
  if (m.includes("password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Muitas tentativas. Aguarde alguns segundos e tente novamente.";
  }
  if (m.includes("network")) {
    return "Erro de conexão. Verifique sua internet.";
  }
  return message;
}

function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, hasAnyRole, hasRole, rolesLoaded, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return;
    // Aguarda roles carregarem antes de decidir destino — evita fallback indevido para /cliente
    if (!rolesLoaded) return;
    if (hasAnyRole(["owner", "master_admin", "barber"])) {
      navigate({ to: "/dashboard" });
    } else {
      // Default: cliente (mesmo sem role explícita em user_roles)
      navigate({ to: "/cliente" });
    }
  }, [loading, isAuthenticated, rolesLoaded, hasAnyRole, hasRole, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "login") {
        const { error, data } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        
        if (data?.user) {
          // Incrementa contador de acessos via RPC (AuthContext já trata, mas garantimos aqui após login manual)
          await supabase.rpc('track_platform_login', { arg_user_id: data.user.id });
        }
        
        toast.success("Bem-vindo de volta.");
        // Navigation handled by useEffect when auth state updates
      } else if (mode === "signup") {
        const redirectTo =
          typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        // Supabase returns identities=[] when email already exists (silent collision)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          toast.error(
            "Este e-mail já está cadastrado. Faça login ou redefina sua senha.",
          );
          setMode("login");
          return;
        }
        toast.success("Conta criada. Verifique seu e-mail para confirmar o cadastro.");
        setMode("login");
      } else if (mode === "forgot") {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/reset-password`
            : undefined;
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo,
        });
        if (error) throw error;
        toast.success(
          "Enviamos um link de redefinição de senha. Verifique seu e-mail.",
        );
        setMode("login");
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro inesperado";
      toast.error(translateAuthError(raw));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendConfirmation() {
    if (!email.trim()) {
      toast.error("Informe seu e-mail primeiro.");
      return;
    }
    setSubmitting(true);
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      toast.success("E-mail de confirmação reenviado.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro inesperado";
      toast.error(translateAuthError(raw));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) toast.error(translateAuthError(error.message));
  }

  const title =
    mode === "login"
      ? "Bem-vindo de volta"
      : mode === "signup"
        ? "Criar conta"
        : "Redefinir senha";

  const subtitle =
    mode === "login"
      ? "Entre para acessar sua área exclusiva."
      : mode === "signup"
        ? "Em segundos você está pronto para agendar."
        : "Enviaremos um link para redefinir sua senha.";

  const cta =
    mode === "login" ? "ENTRAR" : mode === "signup" ? "CRIAR CONTA" : "ENVIAR LINK";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Logo size={140} />
        </div>
        <div className="rounded-lg border border-border/60 bg-surface-1 p-8 shadow-2xl">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="voce@email.com"
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-gold hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full bg-gold text-sm font-semibold tracking-wider text-background hover:bg-gold-soft"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cta}
            </Button>
          </form>

          {mode === "login" && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={submitting}
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-gold"
            >
              Não recebeu o e-mail de confirmação? Reenviar
            </button>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            className="h-11 w-full border-border bg-surface-2 hover:bg-surface-3"
          >
            Continuar com Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" && (
              <>
                Ainda não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-medium text-gold hover:underline"
                >
                  Criar agora
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-medium text-gold hover:underline"
                >
                  Entrar
                </button>
              </>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-medium text-gold hover:underline"
              >
                ← Voltar ao login
              </button>
            )}
          </p>
        </div>
        <p className="mt-6 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Voltar ao site
          </Link>
        </p>
      </div>
    </div>
  );
}
