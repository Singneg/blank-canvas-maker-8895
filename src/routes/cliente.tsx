import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/logo";
import { GoldWatermark } from "@/components/brand/watermark";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  LogOut,
  Calendar,
  Award,
  Plus,
  X,
  MessageCircle,
  RotateCcw,
  CalendarPlus,
  Clock,
} from "lucide-react";
import { format, differenceInCalendarDays, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { buildWhatsAppUrl, openExternalUrl } from "@/lib/phone";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/cliente")({
  head: () => ({ meta: [{ title: "Minha área — LÉO MORAES BARBER" }] }),
  component: CustomerArea,
});

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  no_show: "Não compareceu",
  cancelled: "Cancelado",
};

/** Gera link "Adicionar ao Google Calendar" — formato universal, abre também em Outlook web. */
function buildGoogleCalendarUrl(opts: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  details?: string;
  location?: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(opts.startsAt)}/${fmt(opts.endsAt)}`,
    details: opts.details ?? "",
    location: opts.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function CustomerArea() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { loading, isAuthenticated, user, signOut, hasAnyRole, rolesLoaded } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      // Permitir acesso público à landing page
      const isPublicPath = window.location.pathname === "/";
      if (isPublicPath) return;

      navigate({ to: "/auth" });
      return;
    }
    if (!rolesLoaded) return;
    if (hasAnyRole(["owner", "master_admin", "barber"])) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, isAuthenticated, rolesLoaded, hasAnyRole, navigate]);

  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["customer-area", user?.id],
    queryFn: async () => {
      await supabase.rpc("ensure_self_customer");

      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!customer) {
        return { customer: null, appts: [], points: null, barber: null };
      }

      const [apptsRes, pointsRes, barberRes, portfolioRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, services(name, duration_minutes), barbers(full_name, phone)")
          .eq("customer_id", customer.id)
          .order("starts_at", { ascending: false })
          .limit(30),
        supabase
          .from("loyalty_points")
          .select("*")
          .eq("customer_id", customer.id)
          .maybeSingle(),
        // Barbeiro principal — primeiro ativo na ordem de exibição
        supabase
          .from("barbers")
          .select("full_name, phone")
          .eq("active", true)
          .order("display_order", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("portfolio")
          .select("*")
          .eq("is_active", true)
          .order("show_on_landing", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      return {
        customer,
        appts: apptsRes.data ?? [],
        points: pointsRes.data,
        barber: barberRes.data,
        portfolio: portfolioRes.data ?? [],
      };
    },
  });

  // Realtime nos próprios agendamentos
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("client-appts-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => qc.invalidateQueries({ queryKey: ["customer-area", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  async function cancelAppt(id: string, waUrl?: string | null) {
    const prev = qc.getQueryData<{ appts: Array<{ id: string; status: string }> }>([
      "customer-area",
      user?.id,
    ]);
    if (prev) {
      qc.setQueryData(["customer-area", user?.id], {
        ...prev,
        appts: prev.appts.map((a) =>
          a.id === id ? { ...a, status: "cancelled" } : a,
        ),
      });
    }

    const { data: updated, error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      if (prev) qc.setQueryData(["customer-area", user?.id], prev);
      toast.error(error.message);
      return;
    }
    if (!updated) {
      if (prev) qc.setQueryData(["customer-area", user?.id], prev);
      toast.error("Não foi possível cancelar este agendamento.");
      return;
    }

    toast.success("Agendamento cancelado. Horário liberado.");
    
    if (waUrl) {
      openExternalUrl(waUrl);
    }
    
    await qc.invalidateQueries({ queryKey: ["customer-area"] });
  }

  const upcoming = useMemo(
    () =>
      (data?.appts ?? []).filter(
        (a) =>
          new Date(a.starts_at) > new Date() &&
          !["cancelled", "no_show"].includes(a.status || ""),
      ),
    [data?.appts],
  );
  const past = useMemo(
    () =>
      (data?.appts ?? []).filter(
        (a) =>
          new Date(a.starts_at) <= new Date() ||
          ["cancelled", "no_show", "completed"].includes(a.status || ""),
      ),
    [data?.appts],
  );

  // Último atendimento concluído (para "Agendar novamente" + lembrete)
  const lastCompleted = useMemo(
    () => (data?.appts ?? []).find((a) => a.status === "completed") ?? null,
    [data?.appts],
  );
  const daysSinceLast = useMemo(() => {
    if (!lastCompleted) return null;
    return differenceInCalendarDays(new Date(), new Date(lastCompleted.starts_at));
  }, [lastCompleted]);

  // Telefone do barbeiro: do próximo agendamento (se houver) ou do barbeiro principal
  const barberPhone =
    (upcoming[0]?.barbers as { phone?: string } | null)?.phone ??
    data?.barber?.phone ??
    null;
  const barberName =
    (upcoming[0]?.barbers as { full_name?: string } | null)?.full_name ??
    data?.barber?.full_name ??
    "seu barbeiro";

  // Mensagens WhatsApp
  const waMessageDefault = upcoming[0]
    ? `Olá, gostaria de confirmar meu agendamento do dia ${format(
        new Date(upcoming[0].starts_at),
        "dd/MM",
      )} às ${format(new Date(upcoming[0].starts_at), "HH:mm")}.`
    : "Olá, gostaria de confirmar meu agendamento.";
  const waMessageReschedule = "Olá, gostaria de reagendar meu horário.";

  const waUrlConfirm = buildWhatsAppUrl(barberPhone, waMessageDefault);
  const waUrlReschedule = buildWhatsAppUrl(barberPhone, waMessageReschedule);

  if (loading || !isAuthenticated || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <GoldWatermark />
      <header className="border-b border-border/40 bg-surface-1/60 backdrop-blur">
        <div className="mx-auto flex h-24 max-w-5xl items-center justify-between px-6">
          <Link to="/">
            <Logo size={64} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut().then(() => navigate({ to: "/" }))}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.3em] text-gold">MINHA ÁREA</p>
            <h1 className="mt-2 font-display text-4xl font-bold">
              Olá, {data?.customer?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0]}
            </h1>
          </div>
          <Button asChild className="bg-gold text-background hover:bg-gold-soft">
            <Link to="/agendar">
              <Plus className="mr-2 h-4 w-4" />
              Novo agendamento
            </Link>
          </Button>
        </div>

        {/* Lembrete inteligente de retorno */}
        {daysSinceLast !== null && daysSinceLast >= 14 && upcoming.length === 0 && (
          <section className="mb-6 overflow-hidden rounded-lg border border-gold/40 bg-gradient-to-r from-gold/10 via-gold/5 to-transparent p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gold/20 p-2.5">
                  <Clock className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold">
                    Já faz {daysSinceLast} dias desde seu último corte ✂
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Garanta seu horário com {barberName.split(" ")[0]} antes que lote.
                  </p>
                </div>
              </div>
              <Button asChild className="bg-gold text-background hover:bg-gold-soft">
                <Link to="/agendar">Agendar agora</Link>
              </Button>
            </div>
          </section>
        )}

        {/* Ação rápida: WhatsApp direto */}
        <section className="mb-6 rounded-lg border border-border/60 bg-surface-1 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-500/15 p-2.5">
                <MessageCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-display text-base font-semibold">Falar com seu barbeiro</p>
                <p className="text-xs text-muted-foreground">
                  {waUrlConfirm
                    ? "Mensagem pronta para confirmar ou tirar dúvidas."
                    : "WhatsApp do profissional ainda não configurado."}
                </p>
              </div>
            </div>
            {waUrlConfirm ? (
              <Button
                type="button"
                onClick={() => openExternalUrl(waUrlConfirm)}
                className="bg-emerald-500 text-background hover:bg-emerald-400"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Abrir WhatsApp
              </Button>
            ) : (
              <Button disabled variant="outline">
                Indisponível
              </Button>
            )}
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-gold" />
              <h2 className="font-display text-lg font-semibold">Pontos de fidelidade</h2>
            </div>
            <p className="mt-4 font-display text-5xl font-bold text-gold">
              {data?.points?.balance ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total acumulado: {data?.points?.lifetime_earned ?? 0} pts
            </p>
          </section>

          <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gold" />
              <h2 className="font-display text-lg font-semibold">Próximo agendamento</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nenhum agendamento futuro.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="font-display text-2xl font-semibold">
                    {format(new Date(upcoming[0].starts_at), "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="mt-1 text-sm text-gold">
                    {format(new Date(upcoming[0].starts_at), "HH:mm")} ·{" "}
                    {(upcoming[0].services as { name?: string } | null)?.name}
                  </p>
                </div>
                {(() => {
                  const a = upcoming[0];
                  const start = new Date(a.starts_at);
                  const end = new Date(a.ends_at ?? start.getTime() + 30 * 60_000);
                  const serviceName =
                    (a.services as { name?: string } | null)?.name ?? "Serviço";
                  const calUrl = buildGoogleCalendarUrl({
                    title: `${serviceName} — LÉO MORAES BARBER`,
                    startsAt: start,
                    endsAt: end,
                    details: `Profissional: ${barberName}`,
                    location: "LÉO MORAES BARBER",
                  });
                  return (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-gold/40 text-gold hover:bg-gold/10"
                    >
                      <a href={calUrl} target="_blank" rel="noreferrer">
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Adicionar ao Google Calendar
                      </a>
                    </Button>
                  );
                })()}
              </div>
            )}
          </section>
        </div>

        {/* Agendar novamente — baseado em último serviço */}
        {lastCompleted && (
          <section className="mt-8 rounded-lg border border-border/60 bg-surface-1 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gold/15 p-2.5">
                  <RotateCcw className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Agendar novamente
                  </p>
                  <p className="font-display text-base font-semibold">
                    Último serviço:{" "}
                    {(lastCompleted.services as { name?: string } | null)?.name ?? "Serviço"}
                    {(lastCompleted.services as { duration_minutes?: number } | null)
                      ?.duration_minutes
                      ? ` — ${(lastCompleted.services as { duration_minutes?: number }).duration_minutes} min`
                      : ""}
                  </p>
                </div>
              </div>
              <Button
                className="bg-gold text-background hover:bg-gold-soft"
                onClick={() => {
                  if (lastCompleted.service_id) {
                    sessionStorage.setItem(
                      "lmb_pending_booking",
                      JSON.stringify({ serviceId: lastCompleted.service_id }),
                    );
                  }
                  navigate({ to: "/agendar" });
                }}
              >
                Agendar novamente
              </Button>
            </div>
          </section>
        )}

        {/* Próximos agendamentos com ações */}
        {upcoming.length > 0 && (
          <section className="mt-8 rounded-lg border border-border/60 bg-surface-1 p-6">
            <h2 className="font-display text-lg font-semibold">Próximos agendamentos</h2>
            <ul className="mt-4 divide-y divide-border/40">
              {upcoming.map((a) => {
                const start = new Date(a.starts_at);
                const end = new Date(a.ends_at ?? start.getTime() + 30 * 60_000);
                const serviceName =
                  (a.services as { name?: string } | null)?.name ?? "Serviço";
                const apptBarberName =
                  (a.barbers as { full_name?: string } | null)?.full_name ?? "—";
                const calUrl = buildGoogleCalendarUrl({
                  title: `${serviceName} — LÉO MORAES BARBER`,
                  startsAt: start,
                  endsAt: end,
                  details: `Profissional: ${apptBarberName}`,
                  location: "LÉO MORAES BARBER",
                });
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{serviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        com {apptBarberName} ·{" "}
                        {format(start, "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-gold/40 text-gold">
                        {STATUS_LABEL[a.status as keyof typeof STATUS_LABEL] ?? a.status}
                      </Badge>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="border-gold/30 text-gold hover:bg-gold/10"
                      >
                        <a href={calUrl} target="_blank" rel="noreferrer">
                          <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                          Calendar
                        </a>
                      </Button>
                      {waUrlReschedule ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openExternalUrl(waUrlReschedule)}
                        >
                          Reagendar
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/agendar">Reagendar</Link>
                        </Button>
                      )}
                      {(() => {
                        const minutesToStart = differenceInMinutes(start, new Date());
                        const isBlocked = minutesToStart < 60;
                        const isLateWarning = minutesToStart >= 60 && minutesToStart < 120;
                        
                        const apptBarberPhone = (a.barbers as { phone?: string } | null)?.phone ?? barberPhone;
                        const waCancelMsg = `Olá, estou cancelando meu agendamento de hoje às ${format(start, "HH:mm")}. Peço desculpas pelo aviso em cima da hora.`;
                        const waCancelUrl = buildWhatsAppUrl(apptBarberPhone, waCancelMsg);

                        if (isBlocked) {
                          return (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive/50">
                                  <X className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <div className="space-y-4 py-4">
                                  <h3 className="text-lg font-bold text-destructive">Cancelamento bloqueado</h3>
                                  <p className="text-sm text-muted-foreground">
                                    Cancelamentos não podem ser realizados com menos de 1 hora de antecedência. Entre em contato diretamente com o barbeiro.
                                  </p>
                                  <Button 
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                                    onClick={() => {
                                      const url = buildWhatsAppUrl(apptBarberPhone, "Olá, preciso falar sobre meu agendamento de agora.");
                                      if (url) openExternalUrl(url);
                                    }}
                                  >
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    Falar com o barbeiro
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          );
                        }

                        return (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive">
                                <X className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className={isLateWarning ? "text-destructive" : ""}>
                                  {isLateWarning ? "Aviso de cancelamento tardio" : "Cancelar agendamento?"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {isLateWarning ? (
                                    <span className="font-medium text-destructive">
                                      Você está cancelando com menos de 2 horas de antecedência. O barbeiro será notificado via WhatsApp automaticamente.
                                    </span>
                                  ) : (
                                    "Esta ação não pode ser desfeita. O horário será liberado."
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => cancelAppt(a.id, isLateWarning ? waCancelUrl : undefined)}
                                >
                                  Confirmar cancelamento
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        );
                      })()}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Galeria de Trabalhos */}
        {data?.portfolio && data.portfolio.length > 0 && (
          <section className="mt-12">
            <div className="mb-6">
              <p className="text-xs font-medium tracking-[0.3em] text-gold uppercase">PORTFÓLIO</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Galeria de trabalhos</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.portfolio.map((item: any) => (
                <Dialog key={item.id}>
                  <DialogTrigger asChild>
                    <div className="group cursor-pointer overflow-hidden rounded-lg border border-border/40 bg-surface-1 transition hover:border-gold/40 shadow-sm hover:shadow-gold/5">
                      <div className="aspect-[4/5] overflow-hidden relative">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        {item.show_on_landing && (
                          <div className="absolute top-3 left-3 bg-gold/90 backdrop-blur-sm text-[10px] px-2 py-0.5 rounded text-background uppercase tracking-wider font-bold shadow-lg">
                            Destaque
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center">
                          <Plus className="text-white h-8 w-8" />
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="truncate text-sm font-medium">{item.title}</h3>
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl border-gold/20 bg-background/95 backdrop-blur-md p-0 overflow-hidden sm:rounded-2xl shadow-2xl">
                    <div className="relative aspect-[4/5] sm:aspect-auto sm:h-[80vh] w-full flex items-center justify-center bg-black/20">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="h-full w-full object-contain"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-12">
                        <h3 className="font-display text-xl font-bold text-white">{item.title}</h3>
                      </div>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm transition-all border border-white/10"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </DialogTrigger>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-lg border border-border/60 bg-surface-1 p-6">
          <h2 className="font-display text-lg font-semibold">Histórico</h2>
          {past.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Sem visitas registradas ainda.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/40">
              {past.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">
                      {(a.services as { name?: string } | null)?.name ?? "Serviço"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      com {(a.barbers as { full_name?: string } | null)?.full_name ?? "—"} ·{" "}
                      {format(new Date(a.starts_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-gold/30 text-muted-foreground">
                    {STATUS_LABEL[a.status as keyof typeof STATUS_LABEL] ?? a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Voltar ao site
          </Link>
        </div>
      </main>
    </div>
  );
}
