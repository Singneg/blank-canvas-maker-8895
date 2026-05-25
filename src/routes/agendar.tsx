import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/brand/logo";
import { GoldWatermark } from "@/components/brand/watermark";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, Check, Scissors, Award, Sparkles, Calendar as CalIcon, Clock } from "lucide-react";
import { addDays, format, isSameDay, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, isPast, isToday, addMonths, subMonths, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { notifyBarberNewBooking } from "@/lib/notify-barber";
import { normalizePhoneForStorage } from "@/lib/phone";

export const Route = createFileRoute("/agendar")({
  head: () => ({ meta: [{ title: "Agendar — LÉO MORAES BARBER" }] }),
  component: BookingPage,
});

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ICONS = [Scissors, Award, Sparkles] as const;

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
}
interface Barber {
  id: string;
  full_name: string;
}

function BookingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated, loading: authLoading, user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [serviceId, setServiceId] = useState<string>("");
  const [barberId, setBarberId] = useState<string>("");
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [slot, setSlot] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Buscar serviços ativos
  const { data: services, isLoading: loadingServices, error: servicesError } = useQuery({
    queryKey: ["public-services"],
    queryFn: async () => {
      console.log("[AGENDA] Buscando serviços ativos...");
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description, duration_minutes, price_cents")
        .eq("active", true)
        .order("price_cents");
      
      if (error) {
        console.error("[AGENDA] Erro ao buscar serviços:", error);
        throw error;
      }
      
      console.log("[AGENDA] Serviços carregados:", data?.length ?? 0);
      return (data ?? []) as Service[];
    },
  });

  // Buscar barbeiros ativos (auto-selecionar único)
  const { data: barbers, isLoading: loadingBarbers, error: barbersError } = useQuery({
    queryKey: ["public-barbers"],
    queryFn: async () => {
      console.log("[AGENDA] Buscando barbeiro ativo...");
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("active", true)
        .maybeSingle();
      
      if (error) {
        console.error("[AGENDA] Erro crítico ao buscar barbeiro:", error);
        throw error;
      }
      
      console.log("[AGENDA] Resposta da query de barbeiro:", data);
      
      // Se maybeSingle retornar nulo, retornamos array vazio para manter compatibilidade com o restante do código
      return data ? [data as Barber] : [];
    },
  });

  useEffect(() => {
    console.log("[AGENDA] Monitorando estado dos barbeiros:", {
      count: barbers?.length,
      loading: loadingBarbers,
      currentBarberId: barberId
    });

    if (barbers && barbers.length === 1 && !barberId) {
      console.log("[AGENDA] Auto-selecionando único barbeiro:", barbers[0].id);
      setBarberId(barbers[0].id);
    } else if (barbers && barbers.length > 1 && !barberId) {
      console.log("[AGENDA] Múltiplos barbeiros encontrados, aguardando seleção manual.");
    }
  }, [barbers, barberId, loadingBarbers]);

  // Slots disponíveis
  const dayKey = format(day, "yyyy-MM-dd");
  const { data: slots, isLoading: loadingSlots, isFetching: fetchingSlots, error: slotsError } = useQuery({
    enabled: !!barberId && !!serviceId && step === 3,
    queryKey: ["slots", barberId, serviceId, dayKey],

    queryFn: async () => {
      console.log("[AGENDA] Iniciando busca de horários:", { 
        barberId, 
        serviceId, 
        dayKey,
        step 
      });
      
      try {
        // Tentativa de chamada com a assinatura que o usuário mencionou como "compatível"
        // public.get_available_slots(date, uuid)
        // No JS/Supabase, passamos um objeto. Se a função tem argumentos nomeados, o Supabase casa pelo nome.
        // O usuário disse compatível com (date, uuid), o que sugere que talvez p_barber_id não devesse ser enviado ou a ordem importa.
        // Vamos testar enviando apenas os nomes que a RPC espera.
        
        console.log("[AGENDA] Enviando RPC com parâmetros:", {
          p_date: dayKey,
          p_service_id: serviceId,
          p_barber_id: barberId
        });

        const { data, error } = await supabase.rpc("get_available_slots", {
          p_date: dayKey,
          p_barber_id: barberId,
          p_service_id: serviceId,
        });

        if (error) {
          console.error("[AGENDA] Erro na RPC get_available_slots:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          throw error;
        }

        console.log("[AGENDA] Resposta bruta da RPC recebida:", data);
        
        const raw = (data ?? []) as unknown[];
        const processed = raw
          .map((r) => {
            if (typeof r === "string") return r;
            if (r && typeof r === "object" && "slot" in r) {
              return (r as { slot: string }).slot;
            }
            return null;
          })
          .filter((x): x is string => Boolean(x))
          .filter((timeStr) => {
            try {
              const date = new Date(timeStr);
              if (isNaN(date.getTime())) return false;
              const timePart = format(date, "HH:mm");
              return timePart.endsWith(":00") || timePart.endsWith(":30");
            } catch (e) {
              return false;
            }
          });
        
        console.log("[AGENDA] Horários processados com sucesso:", processed.length, "encontrados");
        return processed;
      } catch (err) {
        console.error("[AGENDA] Falha crítica no queryFn dos slots:", err);
        throw err;
      }
    },
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  useEffect(() => {
    if (slotsError) {
      console.error("[AGENDA] Erro global nos slots:", slotsError);
      toast.error("Erro ao carregar horários. Tente novamente.");
    }
  }, [slotsError]);

  const selectedService = useMemo(
    () => services?.find((s) => s.id === serviceId),
    [services, serviceId],
  );
  const selectedBarber = useMemo(
    () => barbers?.find((b) => b.id === barberId),
    [barbers, barberId],
  );

  const calendarDays = useMemo(() => {
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const days = eachDayOfInterval({ start, end });
      
      // Preencher dias vazios no início da semana (0-6, onde 0 é Domingo)
      const firstDayOfWeek = start.getDay();
      const padding = Array.from({ length: firstDayOfWeek }).map((_, i) => null);
      
      return [...padding, ...days];
    } catch (err) {
      console.error("[AGENDA] Erro ao calcular dias do calendário:", err);
      return [];
    }
  }, [currentMonth]);

  async function confirmBooking() {
    if (!isAuthenticated || !user) {
      // Salva contexto e redireciona para login
      sessionStorage.setItem(
        "lmb_pending_booking",
        JSON.stringify({ serviceId, barberId, slot }),
      );
      navigate({ to: "/auth" });
      return;
    }
    if (!slot || !serviceId || !barberId) {
      toast.error("Selecione todos os campos");
      return;
    }
    setSubmitting(true);

    // Resolver customer_id real do usuário autenticado
    let customerId: string | null = null;
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing?.id) {
      customerId = existing.id;
    } else {
      const fullName =
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        "Cliente";
      const phone = (user.user_metadata?.phone as string | undefined) ?? null;
      const { data: created, error: cErr } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          full_name: fullName,
          email: user.email ?? null,
          phone,
        })
        .select("id")
        .maybeSingle();
      if (cErr || !created) {
        setSubmitting(false);
        toast.error(cErr?.message ?? "Não foi possível criar o cadastro");
        return;
      }
      customerId = created.id;
    }

    const { data, error } = await supabase.rpc("book_appointment", {
      p_customer_id: customerId,
      p_service_id: serviceId,
      p_barber_id: barberId,
      p_start_at: slot,
      p_notes: undefined,
    });
    setSubmitting(false);
    if (error) {
      const msg =
        error.message.includes("appointments_no_overlap") ||
        error.message.toLowerCase().includes("overlap")
          ? "Esse horário acabou de ser ocupado. Escolha outro."
          : error.message;
      toast.error(msg);
      qc.invalidateQueries({ queryKey: ["slots", barberId, serviceId, dayKey] });
      return;
    }
    toast.success("Agendamento confirmado!");
    sessionStorage.removeItem("lmb_pending_booking");

    // Notificação automática para o barbeiro via WhatsApp.
    // Chamamos ANTES do navigate para preservar o gesto do usuário
    // (evita bloqueio de window.open pelo navegador).
    if (selectedService && selectedBarber) {
      const customerName =
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        "Cliente";
      const customerPhone = normalizePhoneForStorage(
        (user.user_metadata?.phone as string | undefined) ?? null,
      );
      await notifyBarberNewBooking({
        barberId: selectedBarber.id,
        customerName,
        customerPhone,
        serviceName: selectedService.name,
        startsAt: new Date(slot),
      });
    }

    navigate({ to: "/cliente" });
    return data;
  }

  // Restaurar contexto após login
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const raw = sessionStorage.getItem("lmb_pending_booking");
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      if (p.serviceId) setServiceId(p.serviceId);
      if (p.barberId) setBarberId(p.barberId);
      if (p.slot) {
        setSlot(p.slot);
        setDay(startOfDay(new Date(p.slot)));
        setStep(4);
      }
    } catch {
      // ignore
    }
  }, [authLoading, isAuthenticated]);

  return (
    <div className="relative min-h-screen bg-background">
      <GoldWatermark />
      <header className="border-b border-border/40 bg-surface-1/60 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-6">
          <Link to="/">
            <Logo size={56} />
          </Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 text-center">
          <p className="text-xs font-medium tracking-[0.3em] text-gold">RESERVA</p>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">
            Agende seu <span className="italic text-gradient-gold">horário</span>
          </h1>
        </div>

        {/* Steps indicator */}
        <ol className="mb-10 flex items-center justify-center gap-2 text-xs">
          {[
            { n: 1, l: "Serviço" },
            { n: 2, l: "Data" },
            { n: 3, l: "Horário" },
            { n: 4, l: "Confirmar" },
          ].map((s, i) => (
            <li key={s.n} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition",
                  step >= s.n
                    ? "border-gold bg-gold text-background"
                    : "border-border bg-surface-1 text-muted-foreground",
                )}
              >
                {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              <span
                className={cn(
                  "hidden font-medium tracking-wider sm:inline",
                  step >= s.n ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.l.toUpperCase()}
              </span>
              {i < 3 && <span className="h-px w-6 bg-border sm:w-10" />}
            </li>
          ))}
        </ol>

        <div className="rounded-lg border border-border/60 bg-surface-1/80 p-6 shadow-2xl backdrop-blur md:p-8">
          {/* STEP 1: Serviço */}
          {step === 1 && (
            <div>
              <h2 className="mb-6 font-display text-2xl font-semibold">Escolha o serviço</h2>
              {loadingServices ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gold mb-4" />
                  <p className="text-sm text-muted-foreground">Carregando serviços...</p>
                </div>
              ) : servicesError ? (
                <div className="text-center py-12">
                   <p className="text-sm text-red-500 mb-4">Falha ao carregar serviços.</p>
                   <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["public-services"] })}>
                      Recarregar
                   </Button>
                </div>
              ) : (services?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  Nenhum serviço disponível no momento.
                </p>
              ) : (

                <div className="grid gap-3">
                  {services!.map((s, i) => {
                    const Icon = ICONS[i % ICONS.length];
                    const active = serviceId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setServiceId(s.id)}
                        className={cn(
                          "flex items-center gap-4 rounded-md border p-4 text-left transition-all duration-300",
                          active
                            ? "border-gold bg-gold/5"
                            : "bg-[#f8f8f7] border-[#e7e5e4] hover:bg-[#f1f1ef] dark:border-border/60 dark:bg-surface-2 dark:hover:bg-surface-2 dark:hover:border-gold/40",
                        )}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0 text-gold" />
                        <div className="flex-1">
                          <p className="font-display text-base font-semibold text-zinc-800 dark:text-foreground">{s.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {s.description} · {s.duration_minutes} min
                          </p>
                        </div>
                        <p className="font-display text-lg font-bold text-gold">
                          {brl(s.price_cents)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-8 flex justify-end">
                <Button
                  disabled={!serviceId}
                  onClick={() => setStep(2)}
                  className="bg-gold text-background hover:bg-gold-soft"
                >
                  Continuar
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Data */}
          {step === 2 && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-display text-2xl font-semibold">Escolha a data</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    disabled={isBefore(startOfMonth(currentMonth), startOfMonth(new Date()))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[120px] text-center text-sm font-medium capitalize">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {loadingBarbers ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gold mb-4" />
                  <p className="text-sm text-muted-foreground animate-pulse">Localizando profissional...</p>
                </div>
              ) : (barbers?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Award className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum profissional disponível para agendamento no momento.<br/>
                    Por favor, tente novamente mais tarde.
                  </p>
                  {barbersError && (
                    <p className="mt-2 text-[10px] text-red-500/50">
                      Erro: {(barbersError as any)?.message || "Conexão falhou"}
                    </p>
                  )}
                </div>
              ) : !barberId && barbers && barbers.length > 1 ? (
                <div className="py-6 space-y-4">
                  <p className="text-center text-sm text-muted-foreground mb-4">Escolha um profissional:</p>
                  <div className="grid gap-3">
                    {barbers.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBarberId(b.id)}
                        className="flex items-center justify-between rounded-md border border-border/60 bg-surface-2 p-4 transition hover:border-gold/40"
                      >
                        <span className="font-medium">{b.full_name}</span>
                        <ChevronRight className="h-4 w-4 text-gold" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (

                <div className="grid grid-cols-7 gap-1">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                    <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {d}
                    </div>
                  ))}
                  {calendarDays.map((d, i) => {
                    if (!d) return <div key={`pad-${i}`} />;
                    
                    const isPastDay = isBefore(d, startOfDay(new Date()));
                    const active = isSameDay(d, day);
                    const today = isToday(d);
                    
                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        disabled={isPastDay}
                        onClick={() => setDay(d)}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-md border p-2 transition h-14",
                          active
                            ? "border-gold bg-gold text-background shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                            : isPastDay
                            ? "opacity-20 cursor-not-allowed border-transparent"
                            : "border-border/40 bg-surface-2 hover:border-gold/40",
                          today && !active && "text-gold font-bold border-gold/20"
                        )}
                      >
                        <span className="font-display text-lg font-bold">
                          {format(d, "dd")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                </Button>
                <Button 
                  disabled={!day || !barberId}
                  onClick={() => {
                    console.log("[AGENDA] Avançando para Step 3:", { 
                      day: format(day, "yyyy-MM-dd"), 
                      barberId,
                      serviceId
                    });
                    setStep(3);
                  }} 
                  className="bg-gold text-background hover:bg-gold-soft"
                >
                  Ver horários <ChevronRight className="ml-1 h-4 w-4" />
                </Button>

              </div>
            </div>
          )}

          {/* STEP 3: Horário */}
          {step === 3 && (
            <div>
              <h2 className="mb-2 font-display text-2xl font-semibold">Horários disponíveis</h2>
              <p className="mb-6 text-xs tracking-wider text-muted-foreground">
                {format(day, "EEEE, dd 'de' MMMM", { locale: ptBR }).toUpperCase()}
              </p>
              {loadingSlots || fetchingSlots ? (
                <div className="flex flex-col items-center justify-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-gold mb-4" />
                  <p className="text-sm text-muted-foreground animate-pulse">Buscando horários disponíveis...</p>
                </div>
              ) : (slots?.length ?? 0) === 0 ? (
                <div className="rounded-md border border-border/60 bg-surface-2 p-8 text-center">
                  <Clock className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum horário disponível neste dia. Tente outra data.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {slots!.map((s) => {
                    const active = slot === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlot(s)}
                        className={cn(
                          "rounded-md border py-2.5 text-sm font-medium transition",
                          active
                            ? "border-gold bg-gold text-background"
                            : "border-border/60 bg-surface-2 hover:border-gold/40",
                        )}
                      >
                        {format(new Date(s), "HH:mm")}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                </Button>
                <Button
                  disabled={!slot}
                  onClick={() => setStep(4)}
                  className="bg-gold text-background hover:bg-gold-soft"
                >
                  Continuar <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Confirmação */}
          {step === 4 && (
            <div>
              <h2 className="mb-6 font-display text-2xl font-semibold">Confirmar reserva</h2>
              <dl className="space-y-3 rounded-md border border-gold/30 bg-surface-2 p-5">
                <Row label="Serviço" value={selectedService?.name ?? "—"} />
                <Row label="Duração" value={`${selectedService?.duration_minutes ?? "—"} min`} />
                <Row label="Profissional" value={selectedBarber?.full_name ?? "—"} />
                <Row
                  label="Data"
                  value={slot ? format(new Date(slot), "dd 'de' MMMM (EEEE)", { locale: ptBR }) : "—"}
                />
                <Row label="Horário" value={slot ? format(new Date(slot), "HH:mm") : "—"} />
                <div className="border-t border-border/40 pt-3">
                  <Row
                    label="Total"
                    value={selectedService ? brl(selectedService.price_cents) : "—"}
                    highlight
                  />
                </div>
              </dl>

              {!isAuthenticated && (
                <p className="mt-4 rounded-md border border-gold/30 bg-gold/5 p-3 text-xs text-muted-foreground">
                  <CalIcon className="mr-1 inline h-3 w-3 text-gold" />
                  Você será direcionado para login antes de finalizar — sua reserva será mantida.
                </p>
              )}

              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                </Button>
                <Button
                  disabled={submitting}
                  onClick={confirmBooking}
                  className="bg-gold text-background hover:bg-gold-soft"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isAuthenticated ? "CONFIRMAR" : "ENTRAR E CONFIRMAR"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium",
          highlight ? "font-display text-2xl font-bold text-gold" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
