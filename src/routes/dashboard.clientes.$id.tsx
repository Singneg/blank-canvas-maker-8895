import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, Phone, Mail, Calendar, DollarSign, Award, Plus } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phone";

export const Route = createFileRoute("/dashboard/clientes/$id")({
  component: CustomerDetailPage,
});

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  no_show: "Não compareceu",
  cancelled: "Cancelado",
};

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", id],
    queryFn: async () => {
      const [customerRes, apptsRes, notesRes, txRes, pointsRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("appointments")
          .select("*, services(name, price_cents), barbers(full_name)")
          .eq("customer_id", id)
          .order("starts_at", { ascending: false })
          .limit(50),
        supabase
          .from("customer_notes")
          .select("*")
          .eq("customer_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("*")
          .eq("customer_id", id)
          .order("occurred_at", { ascending: false })
          .limit(20),
        supabase.from("loyalty_points").select("*").eq("customer_id", id).maybeSingle(),
      ]);

      return {
        customer: customerRes.data,
        appts: apptsRes.data ?? [],
        notes: notesRes.data ?? [],
        tx: txRes.data ?? [],
        points: pointsRes.data,
      };
    },
  });

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSavingNote(true);
    const { error } = await supabase
      .from("customer_notes")
      .insert({ customer_id: id, body: note.trim() });
    setSavingNote(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNote("");
    qc.invalidateQueries({ queryKey: ["customer-detail", id] });
    toast.success("Observação adicionada");
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  const c = data?.customer;
  if (!c) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
        <Button asChild variant="ghost" className="mt-4">
          <Link to="/dashboard/clientes">← Voltar</Link>
        </Button>
      </div>
    );
  }

  const completedAppts = data?.appts.filter(a => a.status === "completed") ?? [];
  const totalVisits = completedAppts.length;
  const totalSpent = completedAppts.reduce((acc, a) => acc + ((a.services as { price_cents?: number } | null)?.price_cents ?? 0), 0);
  const ticket = totalVisits > 0 ? totalSpent / totalVisits : 0;
  const daysSince = c.last_visit_at ? differenceInDays(new Date(), new Date(c.last_visit_at)) : null;

  return (
    <div className="space-y-8">
      <Link
        to="/dashboard/clientes"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> Todos os clientes
      </Link>

      <header>
        <p className="text-xs font-medium tracking-[0.3em] text-gold">FICHA DO CLIENTE</p>
        <h1 className="mt-2 font-display text-4xl font-bold">{c.full_name}</h1>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {c.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-gold" />
              {formatPhone(c.phone)}
            </span>
          )}
          {c.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-gold" />
              {c.email}
            </span>
          )}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Visitas totais"
          value={String(totalVisits)}
          icon={Calendar}
          sub={daysSince !== null ? `Última há ${daysSince}d` : "—"}
        />
        <Kpi label="Total gasto" value={fmtBRL(totalSpent)} icon={DollarSign} />
        <Kpi label="Ticket médio" value={fmtBRL(ticket)} icon={DollarSign} />
        <Kpi
          label="Pontos fidelidade"
          value={String(data?.points?.balance ?? 0)}
          icon={Award}
          sub={`Total: ${data?.points?.lifetime_earned ?? 0}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Histórico */}
        <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
          <h2 className="font-display text-lg font-semibold">Histórico de atendimentos</h2>
          {data!.appts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Sem agendamentos ainda.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border/40">
              {data!.appts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">
                      {(a.services as { name?: string } | null)?.name ?? "Serviço"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      com {(a.barbers as { full_name?: string } | null)?.full_name ?? "—"} ·{" "}
                      {format(new Date(a.starts_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-gold">
                      {fmtBRL((a.services as { price_cents?: number } | null)?.price_cents ?? 0)}
                    </span>
                    <Badge variant="outline" className="border-gold/30">
                      {STATUS_LABEL[a.status as keyof typeof STATUS_LABEL] ?? a.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Notas */}
        <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
          <h2 className="font-display text-lg font-semibold">Observações</h2>
          <form onSubmit={addNote} className="mt-4 space-y-2">
            <Label htmlFor="note" className="text-xs">
              Nova observação
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ex: prefere fade médio, alérgico a..."
            />
            <Button
              type="submit"
              size="sm"
              disabled={savingNote || !note.trim()}
              className="w-full bg-gold text-background hover:bg-gold-soft"
            >
              {savingNote && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              <Plus className="mr-1 h-3 w-3" /> Adicionar
            </Button>
          </form>
          {data!.notes.length > 0 && (
            <ul className="mt-6 space-y-3 border-t border-border/40 pt-4">
              {data!.notes.map((n) => (
                <li key={n.id} className="rounded-md bg-surface-2 p-3">
                  <p className="text-sm text-foreground">{n.body}</p>
                  <p className="mt-1 text-[10px] tracking-wider text-muted-foreground">
                    {format(new Date(n.created_at || new Date()), "dd MMM yyyy HH:mm", { locale: ptBR })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Transações */}
      {data!.tx.length > 0 && (
        <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
          <h2 className="font-display text-lg font-semibold">Transações financeiras</h2>
          <ul className="mt-4 divide-y divide-border/40">
            {data!.tx.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{t.description ?? "Pagamento"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(t.occurred_at), "dd MMM yyyy", { locale: ptBR })} · {t.method}
                  </p>
                </div>
                <span className="font-display text-lg font-semibold text-gold">
                  {fmtBRL(t.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Calendar;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
