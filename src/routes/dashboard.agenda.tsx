import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatPhone, maskPhoneInput, normalizePhoneForStorage } from "@/lib/phone";
import {
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  UserPlus,
  Clock,
} from "lucide-react";
import {
  format,
  addDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addMonths,
  isSameDay,
  isSameMonth,
  parse,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { notifyCustomerStatusChange } from "@/lib/notify-barber";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AgendaListSkeleton } from "@/components/ui/premium-skeletons";
import {
  BookingConfirmationDialog,
  type BookingConfirmationData,
} from "@/components/agenda/booking-confirmation-dialog";

export const Route = createFileRoute("/dashboard/agenda")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      date: (search.date as string) || undefined,
    };
  },
  component: AgendaPage,
});

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  no_show: "Não compareceu",
  cancelled: "Cancelado",
};

interface Appt {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  customer_id?: string;
  customers: { full_name?: string; phone?: string } | null;
  services: { name?: string; duration_minutes?: number; price_cents?: number } | null;
}

const STATUS_STYLE: Record<string, string> = {
  scheduled: "border-gold/40 bg-gold/10 text-gold",
  confirmed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  in_progress: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  completed: "border-emerald-600/40 bg-emerald-600/15 text-emerald-300",
  no_show: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  cancelled: "border-red-500/40 bg-red-500/10 text-red-400",
};

function AgendaPage() {
  const { date } = Route.useSearch();
  const qc = useQueryClient();
  
  const initialDate = useMemo(() => {
    if (date) {
      const parsed = parse(date, "yyyy-MM-dd", new Date());
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }, [date]);

  const [day, setDay] = useState(initialDate);
  const [monthCursor, setMonthCursor] = useState(startOfMonth(initialDate));

  // Sincroniza estado se a URL mudar (ex: clicando em outro agendamento na dashboard)
  useEffect(() => {
    if (date) {
      const parsed = parse(date, "yyyy-MM-dd", new Date());
      if (!isNaN(parsed.getTime())) {
        setDay(parsed);
        setMonthCursor(startOfMonth(parsed));
      }
    }
  }, [date]);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmationData | null>(null);

  // ---------- Mês inteiro (para pintar dias ocupados no calendário) ----------
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const { data: monthAppts } = useQuery({
    queryKey: ["appointments-month", format(monthCursor, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, starts_at, status")
        .gte("starts_at", monthStart.toISOString())
        .lte("starts_at", monthEnd.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---------- Dia selecionado (lista detalhada) ----------
  const dayKey = format(day, "yyyy-MM-dd");
  const { data: appts, isLoading } = useQuery({
    queryKey: ["appointments", dayKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, notes, customer_id, service_id, customers!left(full_name, phone), services!left(name, duration_minutes, price_cents)",
        )
        .gte("starts_at", startOfDay(day).toISOString())
        .lte("starts_at", endOfDay(day).toISOString())
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as Appt[];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("appointments-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          qc.invalidateQueries({ queryKey: ["appointments"] });
          qc.invalidateQueries({ queryKey: ["appointments-month"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  // Mapa diaKey -> contagem de appts ativos
  const monthMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of monthAppts ?? []) {
      if (a.status === "cancelled" || a.status === "no_show") continue;
      const k = format(new Date(a.starts_at), "yyyy-MM-dd");
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [monthAppts]);

  // Constrói grid 6x7 do calendário
  const calendarDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthStart]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.3em] text-gold">
            SUA AGENDA
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">
            {format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toque em um dia no calendário para ver os horários e gerenciar os atendimentos.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold text-background hover:bg-gold-soft">
              <Plus className="mr-2 h-4 w-4" />
              Novo agendamento
            </Button>
          </DialogTrigger>
          <NewAppointmentDialog
            day={day}
            onClose={() => setOpen(false)}
            initialTime={null}
            onConfirmed={(c) => setConfirmation(c)}
          />
        </Dialog>
      </header>

      <BookingConfirmationDialog
        data={confirmation}
        open={Boolean(confirmation)}
        onOpenChange={(v) => {
          if (!v) setConfirmation(null);
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Calendário mensal */}
        <section className="rounded-lg border border-border/60 bg-surface-1 p-4">
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonthCursor(addMonths(monthCursor, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="font-display text-base font-semibold capitalize">
              {format(monthCursor, "MMMM yyyy", { locale: ptBR })}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonthCursor(addMonths(monthCursor, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((d) => {
              const k = format(d, "yyyy-MM-dd");
              const count = monthMap.get(k) ?? 0;
              const isCurMonth = isSameMonth(d, monthCursor);
              const isSelected = isSameDay(d, day);
              const isToday = isSameDay(d, new Date());
              return (
                <button
                  key={k}
                  onClick={() => setDay(d)}
                  className={cn(
                    "relative aspect-square rounded-md border text-sm transition",
                    isSelected
                      ? "border-gold bg-gold text-background font-semibold"
                      : isToday
                        ? "border-gold/60 bg-surface-2 text-foreground"
                        : isCurMonth
                          ? "border-border/40 bg-surface-2/40 text-foreground hover:border-gold/40 hover:bg-surface-2"
                          : "border-transparent text-muted-foreground/50 hover:bg-surface-2/30",
                  )}
                >
                  {format(d, "d")}
                  {count > 0 && (
                    <span
                      className={cn(
                        "absolute bottom-1 left-1/2 inline-flex h-1 w-1 -translate-x-1/2 rounded-full",
                        isSelected ? "bg-background" : "bg-gold",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDay(addDays(day, -1))}
            >
              <ChevronLeft className="mr-1 h-3 w-3" /> Dia anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const t = new Date();
                setDay(t);
                setMonthCursor(startOfMonth(t));
              }}
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDay(addDays(day, 1))}
            >
              Próximo <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </section>

        {/* Lista do dia */}
        <section className="rounded-lg border border-border/60 bg-surface-1">
          {isLoading ? (
            <AgendaListSkeleton />
          ) : (appts?.length ?? 0) === 0 ? (
            <div className="p-12 text-center">
              <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nenhum agendamento para este dia.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Que tal preencher essa janela com um novo cliente?
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setOpen(true)}
              >
                <Plus className="mr-2 h-3 w-3" /> Criar agendamento
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {appts!.map((a) => {
                const start = new Date(a.starts_at);
                const end = new Date(a.ends_at);
                const dur =
                  a.services?.duration_minutes ??
                  Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
                const price = a.services?.price_cents ?? 0;
                const statusCls = STATUS_STYLE[a.status] ?? "border-border text-muted-foreground";
                return (
                  <li
                    key={a.id}
                    className="group relative flex flex-col gap-3 p-5 transition hover:bg-surface-2/40 sm:flex-row sm:items-center sm:gap-5"
                  >
                    {/* HORÁRIO grande */}
                    <div className="flex items-baseline gap-2 sm:w-28 sm:flex-col sm:items-start sm:gap-0">
                      <p className="font-display text-3xl font-bold leading-none text-gold sm:text-4xl">
                        {format(start, "HH:mm")}
                      </p>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {dur} min
                      </p>
                    </div>

                    {/* Cliente + serviço */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold sm:text-lg">
                        {a.customers?.full_name ?? "Cliente"}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span className="truncate">{a.services?.name ?? "Serviço"}</span>
                        {price > 0 && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="font-medium text-gold/90">{fmtBRL(price)}</span>
                          </>
                        )}
                        {a.customers?.phone && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="text-xs">{formatPhone(a.customers.phone)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status + ações */}
                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", statusCls)}
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                      <StatusActions id={a.id} current={a.status} appt={a} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusActions({
  id,
  current,
  appt,
}: {
  id: string;
  current: string;
  appt: Appt;
}) {
  const qc = useQueryClient();
  async function setStatus(status: string) {
    if (status === current) return;

    const notifiable: Record<string, "confirmed" | "cancelled"> = {
      confirmed: "confirmed",
      cancelled: "cancelled",
    };
    const notifyKind = notifiable[status as keyof typeof notifiable];
    if (notifyKind && appt.customers?.phone) {
      notifyCustomerStatusChange({
        status: notifyKind as any,
        customerName: appt.customers.full_name ?? "Cliente",
        customerPhone: appt.customers.phone,
        serviceName: appt.services?.name ?? "Serviço",
        startsAt: new Date(appt.starts_at),
      });
    }

    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Status atualizado");
      
      // Se concluiu, atualiza métricas do cliente (visitas e faturamento)
      if (status === "completed" && appt.customer_id && appt.services?.price_cents) {
        const { data: customer } = await supabase
          .from("customers")
          .select("total_visits, total_spent_cents")
          .eq("id", appt.customer_id)
          .single();
        
        if (customer) {
          await supabase
            .from("customers")
            .update({
              total_visits: (customer.total_visits || 0) + 1,
              total_spent_cents: (customer.total_spent_cents || 0) + (appt.services.price_cents || 0),
              last_visit_at: new Date().toISOString()
            })
            .eq("id", appt.customer_id);
        }
      }

      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments-month"] });
      qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
      qc.invalidateQueries({ queryKey: ["finance-overview"] });
      qc.invalidateQueries({ queryKey: ["customers-list"] });
    }
  }
  return (
    <Select value={current} onValueChange={setStatus}>
      <SelectTrigger className="h-8 w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------
//  Novo agendamento — UX de barbearia profissional
// ---------------------------------------------------------------

interface CustomerLite {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}
interface ServiceLite {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
}
interface BarberLite {
  id: string;
  full_name: string;
}

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function NewAppointmentDialog({
  day,
  onClose,
  initialTime,
  onConfirmed,
}: {
  day: Date;
  onClose: () => void;
  initialTime: string | null;
  onConfirmed?: (data: BookingConfirmationData) => void;
}) {
  const qc = useQueryClient();

  // Cliente
  const [customerId, setCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerFocused, setCustomerFocused] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Serviço / horário
  const [serviceId, setServiceId] = useState<string>("");
  const [time, setTime] = useState<string>(initialTime ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .order("full_name");
      return (data ?? []) as CustomerLite[];
    },
  });

  const { data: barbers } = useQuery({
    queryKey: ["barbers-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("barbers")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      return (data ?? []) as BarberLite[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents")
        .eq("active", true)
        .order("name");
      return (data ?? []) as ServiceLite[];
    },
  });

  // Barbeiro padrão = primeiro barbeiro ativo (Leonardo). Se houver mais que
  // 1, mostra um Select; senão fica oculto.
  const barberId = barbers?.[0]?.id ?? "";

  // Slots disponíveis (consulta o RPC quando temos barbeiro+serviço+dia)
  const dayKey = format(day, "yyyy-MM-dd");
  const {
    data: slots,
    isLoading: loadingSlots,
    error: slotsError,
  } = useQuery({
    queryKey: ["slots", barberId, serviceId, dayKey],
    enabled: Boolean(barberId && serviceId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_slots", {
        p_barber_id: barberId,
        p_date: dayKey,
        p_service_id: serviceId,
      });
      if (error) throw error;
      // RPC retorna array de timestamps (strings ISO) ou objetos com .slot
      const raw = (data ?? []) as unknown[];
      return raw
        .map((r) => {
          if (typeof r === "string") return r;
          if (r && typeof r === "object" && "slot" in r) {
            return (r as { slot: string }).slot;
          }
          return null;
        })
        .filter((x): x is string => Boolean(x))
        .filter((iso) => {
          // Filtro de segurança: garante que o horário termine em :00 ou :30
          const t = format(new Date(iso), "HH:mm");
          return t.endsWith(":00") || t.endsWith(":30");
        });
    },
    retry: false,
  });

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.toLowerCase().trim();
    if (!term) return customers ?? [];
    const digits = term.replace(/\D/g, "");
    return (customers ?? []).filter((c) => {
      const inName = c.full_name.toLowerCase().includes(term);
      const inEmail = (c.email ?? "").toLowerCase().includes(term);
      const inPhone =
        (c.phone ?? "").toLowerCase().includes(term) ||
        (digits.length > 0 &&
          (c.phone ?? "").replace(/\D/g, "").includes(digits));
      return inName || inEmail || inPhone;
    });
  }, [customers, customerSearch]);

  const selectedCustomer =
    customers?.find((c) => c.id === customerId) ?? null;
  const selectedService = services?.find((s) => s.id === serviceId) ?? null;

  async function createCustomer() {
    if (!newName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    const phoneDigits = newPhone.replace(/\D/g, "");
    if (phoneDigits) {
      const dup = (customers ?? []).find(
        (c) => (c.phone ?? "").replace(/\D/g, "") === phoneDigits,
      );
      if (dup) {
        toast.error(`Telefone já cadastrado para ${dup.full_name}`);
        return;
      }
    }
    const { data, error } = await supabase
      .from("customers")
      .insert({
        full_name: newName.trim(),
        phone: normalizePhoneForStorage(newPhone),
      })
      .select("id, full_name, phone")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cliente cadastrado");
    qc.invalidateQueries({ queryKey: ["customers-min"] });
    qc.invalidateQueries({ queryKey: ["customers-list"] });
    setCustomerId(data.id);
    setShowNewCustomer(false);
    setNewName("");
    setNewPhone("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!barberId) {
      toast.error("Nenhum barbeiro disponível");
      return;
    }
    if (!serviceId || !selectedService) {
      toast.error("Selecione um serviço");
      return;
    }
    if (!time) {
      toast.error("Selecione um horário");
      return;
    }

    const starts = parse(`${dayKey} ${time}`, "yyyy-MM-dd HH:mm", new Date());

    setSubmitting(true);
    const { error } = await supabase.rpc("book_appointment", {
      p_customer_id: customerId,
      p_service_id: serviceId,
      p_barber_id: barberId,
      p_start_at: starts.toISOString(),
      p_notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (error) {
      toast.error(
        error.message.includes("appointments_no_overlap") ||
          error.message.toLowerCase().includes("overlap")
          ? "Conflito: o barbeiro já tem outro agendamento neste horário."
          : error.message,
      );
      return;
    }
    const customerName = selectedCustomer?.full_name ?? "Cliente";
    toast.success(`✓ ${customerName} confirmado na agenda`, {
      description: `${selectedService.name} · ${format(starts, "dd/MM 'às' HH:mm", { locale: ptBR })}`,
      duration: 4500,
    });
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["appointments-month"] });
    qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
    qc.invalidateQueries({ queryKey: ["slots"] });
    onClose();
    onConfirmed?.({
      customerName,
      customerPhone: selectedCustomer?.phone ?? null,
      serviceName: selectedService.name,
      startsAt: starts,
    });
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Novo agendamento</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-5">
        {/* Cliente */}
        <div className="space-y-2">
          <Label>Cliente *</Label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-md border border-gold/40 bg-gold/5 px-3 py-2">
              <div>
                <p className="font-medium">{selectedCustomer.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedCustomer.phone ? formatPhone(selectedCustomer.phone) : "Sem telefone"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCustomerId("")}
              >
                Trocar
              </Button>
            </div>
          ) : showNewCustomer ? (
            <div className="space-y-2 rounded-md border border-border/60 bg-surface-2/40 p-3">
              <Input
                placeholder="Nome completo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder="(11) 943769788"
                value={newPhone}
                onChange={(e) => setNewPhone(maskPhoneInput(e.target.value))}
                inputMode="tel"
                maxLength={16}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={createCustomer}>
                  Salvar cliente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewCustomer(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onFocus={() => setCustomerFocused(true)}
                  onBlur={() => setTimeout(() => setCustomerFocused(false), 200)}
                  className="pl-9"
                />
              </div>
              {(customerFocused || customerSearch.trim()) && (
                <div className="max-h-56 overflow-y-auto rounded-md border border-border/60 bg-surface-2/30">
                  {filteredCustomers.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      {customerSearch.trim()
                        ? "Nenhum cliente encontrado."
                        : "Nenhum cliente cadastrado ainda."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/30">
                      {filteredCustomers.slice(0, 10).map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerId(c.id);
                              setCustomerSearch("");
                              setCustomerFocused(false);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
                          >
                            <span>{c.full_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.phone ? formatPhone(c.phone) : (c.email ?? "")}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewCustomer(true)}
              >
                <UserPlus className="mr-2 h-3 w-3" />
                Novo cliente
              </Button>
            </div>
          )}
        </div>

        {/* Barbeiro — só mostra se houver mais de 1 */}
        {(barbers?.length ?? 0) > 1 && (
          <div className="space-y-2">
            <Label>Barbeiro</Label>
            <Select value={barberId} onValueChange={() => {}}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(barbers ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Serviço */}
        <div className="space-y-2">
          <Label>Serviço *</Label>
          <div className="grid grid-cols-2 gap-2">
            {(services ?? []).map((s) => {
              const active = s.id === serviceId;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setServiceId(s.id);
                    setTime("");
                  }}
                  className={cn(
                    "rounded-md border p-3 text-left text-sm transition",
                    active
                      ? "border-gold bg-gold/10"
                      : "border-border/60 bg-surface-2/30 hover:border-gold/40",
                  )}
                >
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.duration_minutes} min · {fmtBRL(s.price_cents)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Horário — slots clicáveis vindos do RPC */}
        <div className="space-y-2">
          <Label>Horário disponível *</Label>
          {!serviceId ? (
            <p className="text-xs text-muted-foreground">
              Selecione um serviço para ver os horários livres.
            </p>
          ) : loadingSlots ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Buscando horários...
            </div>
          ) : slotsError ? (
            <p className="text-xs text-destructive">
              Erro ao buscar horários: {(slotsError as Error).message}
            </p>
          ) : (slots?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum horário disponível neste dia. Verifique se o expediente
              está cadastrado em <strong>Horários</strong> e tente outra data.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots!.map((iso) => {
                const t = format(new Date(iso), "HH:mm");
                const active = t === time;
                return (
                  <button
                    type="button"
                    key={iso}
                    onClick={() => setTime(t)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-sm font-medium transition",
                      active
                        ? "border-gold bg-gold text-background"
                        : "border-border/60 bg-surface-2/30 hover:border-gold/40",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Observações */}
        <div className="space-y-2">
          <Label htmlFor="notes">Observações (opcional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-gold text-background hover:bg-gold-soft"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirmar agendamento
        </Button>
      </form>
    </DialogContent>
  );
}
