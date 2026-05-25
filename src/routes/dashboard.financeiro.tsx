import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Plus,
  DollarSign,
  TrendingUp,
  Wallet,
  BarChart3,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  subDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  isSameMonth,
  isAfter,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { KpiGridSkeleton, ChartSkeleton } from "@/components/ui/premium-skeletons";
import { KpiHint } from "@/components/ui/kpi-hint";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/financeiro")({
  component: FinancePage,
});

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit_card: "Crédito",
  debit_card: "Débito",
  transfer: "Transferência",
  other: "Outro",
};

const CHART_COLORS = ["#D4AF37", "#3B82F6", "#F97316", "#9CA3AF", "#8B5CF6", "#EC4899", "#10B981"];

type RangeKey = "today" | "7d" | "30d" | "month" | "6m";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
  { key: "6m", label: "Últimos 6 meses" },
];

function getRangeBounds(range: RangeKey, anchor: Date): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "7d":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "6m":
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
    case "month":
    default:
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
}

function FinancePage() {
  const [open, setOpen] = useState(false);
  const [anchorMonth, setAnchorMonth] = useState<Date>(startOfMonth(new Date()));
  const [range, setRange] = useState<RangeKey>("month");

  const bounds = useMemo(() => getRangeBounds(range, anchorMonth), [range, anchorMonth]);
  const monthStart = startOfMonth(anchorMonth);
  const monthEnd = endOfMonth(anchorMonth);
  const prevMonthStart = startOfMonth(subMonths(anchorMonth, 1));
  const prevMonthEnd = endOfMonth(subMonths(anchorMonth, 1));
  const sixMonthsStart = startOfMonth(subMonths(new Date(), 5));
  const isCurrentMonth = isSameMonth(anchorMonth, new Date());
  const canGoNext = !isCurrentMonth;

  const { data, isLoading } = useQuery({
    queryKey: [
      "finance-overview-v2",
      range,
      monthStart.toISOString().slice(0, 7),
    ],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const [
        rangeApptsRes,
        prevMonthApptsRes,
        monthApptsRes,
        sixMonthApptsRes,
        sixMonthTxRes,
        rangeTxRes,
      ] = await Promise.all([
        // Appointments do range selecionado (para gráficos / KPIs principais)
        supabase
          .from("appointments")
          .select("id, status, starts_at, services(name, price_cents)")
          .gte("starts_at", bounds.start.toISOString())
          .lte("starts_at", bounds.end.toISOString()),
        // Mês anterior (para comparação)
        supabase
          .from("appointments")
          .select("id, status, services(price_cents)")
          .gte("starts_at", prevMonthStart.toISOString())
          .lte("starts_at", prevMonthEnd.toISOString()),
        // Mês ancorado (para KPIs do mês independente do filtro)
        supabase
          .from("appointments")
          .select("id, status, services(price_cents)")
          .gte("starts_at", monthStart.toISOString())
          .lte("starts_at", monthEnd.toISOString()),
        // Últimos 6 meses (para histórico) - agendamentos
        supabase
          .from("appointments")
          .select("id, status, starts_at, services(price_cents)")
          .gte("starts_at", sixMonthsStart.toISOString())
          .lte("starts_at", endOfMonth(new Date()).toISOString()),
        // Últimos 6 meses (para histórico) - transações manuais
        supabase
          .from("transactions")
          .select("id, status, occurred_at, amount_cents")
          .gte("occurred_at", sixMonthsStart.toISOString())
          .lte("occurred_at", endOfMonth(new Date()).toISOString()),
        // Transações do range (lançamentos manuais)
        supabase
          .from("transactions")
          .select(
            "id, amount_cents, method, status, description, occurred_at, customers(full_name)",
          )
          .gte("occurred_at", bounds.start.toISOString())
          .lte("occurred_at", bounds.end.toISOString())
          .order("occurred_at", { ascending: false }),
      ]);

      return {
        rangeAppts: rangeApptsRes.data ?? [],
        prevMonthAppts: prevMonthApptsRes.data ?? [],
        monthAppts: monthApptsRes.data ?? [],
        sixMonthAppts: sixMonthApptsRes.data ?? [],
        sixMonthTx: sixMonthTxRes.data ?? [],
        rangeTx: rangeTxRes.data ?? [],
      };
    },
  });

  // === Cálculos do RANGE selecionado ===
  const rangeStats = useMemo(() => {
    const appts = data?.rangeAppts ?? [];
    const activeAppts = appts.filter((a) => a.status !== "cancelled");
    const completed = appts.filter((a) => a.status === "completed");
    const cancelled = appts.filter((a) => a.status === "cancelled");
    
    // Faturamento continua sendo apenas dos concluídos para manter consistência financeira
    const total = completed.reduce((s, a) => {
      const svc = Array.isArray(a.services) ? a.services[0] : a.services;
      return s + (svc?.price_cents ?? 0);
    }, 0);
    
    const avg = completed.length > 0 ? Math.round(total / completed.length) : 0;
    const totalTracked = completed.length + cancelled.length;
    const cancelRate =
      totalTracked > 0 ? Math.round((cancelled.length / totalTracked) * 100) : 0;
    
    const byService: Record<string, number> = {};
    activeAppts.forEach((a) => {
      const svc = Array.isArray(a.services) ? a.services[0] : a.services;
      if (!svc?.name) return;
      // Para o gráfico de pizza (operacional), usamos o preço para dar peso, 
      // mas considerando todos não cancelados
      byService[svc.name] = (byService[svc.name] ?? 0) + (svc.price_cents ?? 0);
    });
    return {
      total,
      count: activeAppts.length, // Agora conta todos os ativos
      completedCount: completed.length,
      cancelled: cancelled.length,
      cancelRate,
      avg,
      byService: Object.entries(byService)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    };
  }, [data]);

  // === Comparação MÊS ATUAL vs MÊS ANTERIOR (sempre baseada no mês ancorado) ===
  const monthCompare = useMemo(() => {
    const sumCompleted = (list: any[]) =>
      list
        .filter((a) => a.status === "completed")
        .reduce((s, a) => {
          const svc = Array.isArray(a.services) ? a.services[0] : a.services;
          return s + (svc?.price_cents ?? 0);
        }, 0);

    const current = sumCompleted(data?.monthAppts ?? []);
    const prev = sumCompleted(data?.prevMonthAppts ?? []);
    const hasPrev = (data?.prevMonthAppts ?? []).length > 0;
    const growth = hasPrev && prev > 0 ? Math.round(((current - prev) / prev) * 100) : null;
    return { current, prev, growth, hasPrev };
  }, [data]);

  // === Histórico mensal — 6 meses preenchidos (zera meses vazios) ===
  const monthlyHistory = useMemo(() => {
    const buckets: Array<{
      key: string;
      label: string;
      revenue: number;
      movements: number;
      avg: number;
      cancelled: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const ref = subMonths(new Date(), i);
      const ws = startOfMonth(ref);
      const we = endOfMonth(ref);

      // Agendamentos do mês
      const inMonthAppts = (data?.sixMonthAppts ?? []).filter((a) => {
        const d = new Date(a.starts_at);
        return d >= ws && d <= we;
      });
      const completed = inMonthAppts.filter((a) => a.status === "completed");
      const cancelled = inMonthAppts.filter((a) => a.status === "cancelled");

      // Transações manuais pagas do mês
      const inMonthTx = (data?.sixMonthTx ?? []).filter((t) => {
        const d = new Date(t.occurred_at);
        return d >= ws && d <= we && t.status === "paid";
      });

      const revenueFromAppts = completed.reduce((s, a) => {
        const svc = Array.isArray(a.services) ? a.services[0] : a.services;
        return s + (svc?.price_cents ?? 0);
      }, 0);
      const revenueFromTx = inMonthTx.reduce((s, t) => s + (t.amount_cents ?? 0), 0);

      const totalRevenue = revenueFromAppts + revenueFromTx;
      const totalMovements = completed.length + inMonthTx.length;

      buckets.push({
        key: format(ws, "yyyy-MM"),
        label: format(ws, "MMM/yy", { locale: ptBR }),
        revenue: totalRevenue,
        movements: totalMovements,
        avg: totalMovements > 0 ? Math.round(totalRevenue / totalMovements) : 0,
        cancelled: cancelled.length,
      });
    }
    return buckets;
  }, [data]);

  // === Linha: faturamento por dia dentro do range ===
  const revenueByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: bounds.start, end: bounds.end });
    if (days.length > 62) {
      // Agrega por mês quando o range é grande (6 meses)
      const map = new Map<string, number>();
      monthlyHistory.forEach((m) => map.set(m.label, m.revenue));
      return Array.from(map.entries()).map(([date, v]) => ({
        date,
        reais: Math.round(v / 100),
      }));
    }
    const map = new Map<string, number>();
    days.forEach((d) => map.set(format(d, "yyyy-MM-dd"), 0));
    (data?.rangeAppts ?? [])
      .filter((a) => a.status !== "cancelled")
      .forEach((a) => {
        const k = a.starts_at.split("T")[0];
        if (map.has(k)) {
          const cur = map.get(k) ?? 0;
          const svc = Array.isArray(a.services) ? a.services[0] : a.services;
          map.set(
            k,
            cur + (svc?.price_cents ?? 0),
          );
        }
      });
    return Array.from(map.entries()).map(([d, v]) => {
      const [year, month, day] = d.split("-");
      return {
        date: `${day}/${month}`,
        reais: Math.round(v / 100),
      };
    });
  }, [data, bounds, monthlyHistory]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.3em] text-gold">FINANCEIRO</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-foreground">
            Gestão financeira
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Faturamento consolidado: atendimentos concluídos + lançamentos pagos · fuso América/São Paulo
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold text-background hover:bg-gold-soft">
              <Plus className="mr-2 h-4 w-4" /> Lançar pagamento
            </Button>
          </DialogTrigger>
          <NewTransactionDialog onClose={() => setOpen(false)} />
        </Dialog>
      </header>

      {/* Navegação entre meses */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface-1 p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAnchorMonth((m) => startOfMonth(subMonths(m, 1)))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Mês de referência
            </p>
            <p className="font-display text-lg font-semibold capitalize text-foreground">
              {format(anchorMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            disabled={!canGoNext}
            onClick={() => {
              const next = startOfMonth(addMonths(anchorMonth, 1));
              if (!isAfter(next, startOfMonth(new Date()))) setAnchorMonth(next);
            }}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Filtros de período */}
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                range === opt.key
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border/60 text-muted-foreground hover:border-gold/40 hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <KpiGridSkeleton count={5} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi
              label="Faturamento"
              value={fmtBRL(rangeStats.total)}
              icon={DollarSign}
              hint={`período: ${RANGE_OPTIONS.find((r) => r.key === range)?.label.toLowerCase()}`}
              tooltip="Soma do preço dos serviços de atendimentos com status concluído no período selecionado."
            />
            <Kpi
              label="Mês atual vs anterior"
              value={
                monthCompare.growth === null
                  ? "—"
                  : `${monthCompare.growth >= 0 ? "+" : ""}${monthCompare.growth}%`
              }
              icon={TrendingUp}
              sub={
                monthCompare.hasPrev
                  ? `Anterior: ${fmtBRL(monthCompare.prev)}`
                  : "Dados insuficientes"
              }
              hint="comparação do mês ancorado"
              tooltip="Diferença percentual entre o faturamento do mês selecionado e o mês anterior. Sem histórico = dados insuficientes."
            />
            <Kpi
              label="Movimento da agenda"
              value={String(rangeStats.count)}
              icon={Wallet}
              hint="agendamentos ativos no período"
              tooltip="Total de agendamentos que não foram cancelados (pendentes, confirmados e concluídos)."
            />
            <Kpi
              label="Ticket médio"
              value={fmtBRL(rangeStats.avg)}
              icon={BarChart3}
              hint="valor médio por atendimento"
              tooltip="Faturamento dividido pelo número de atendimentos concluídos."
            />
            <Kpi
              label="Taxa de cancelamento"
              value={`${rangeStats.cancelRate}%`}
              icon={XCircle}
               sub={`${rangeStats.cancelled} cancelados / ${rangeStats.cancelled + rangeStats.count} totais`}
              hint="cancelados ÷ (concluídos + cancelados)"
            />
          </div>

          {/* Gráficos */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
              <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
                Movimento da agenda — {RANGE_OPTIONS.find((r) => r.key === range)?.label}
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "currentColor", fontSize: 11 }}
                      stroke="hsl(var(--border) / 0.6)"
                    />
                    <YAxis
                      tick={{ fill: "currentColor", fontSize: 11 }}
                      stroke="hsl(var(--border) / 0.6)"
                    />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--surface-1))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        color: "currentColor",
                      }}
                      formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "Valor em agenda"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="reais"
                      stroke="#D4AF37"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: "#D4AF37" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
              <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
                Serviços em agenda por categoria
              </h2>
              {rangeStats.byService.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem agendamentos ativos no período.
                </p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={rangeStats.byService}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        {rangeStats.byService.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--surface-1))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          color: "currentColor",
                        }}
                        formatter={(v: number) => fmtBRL(v)}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        align="center"
                        iconType="circle"
                        layout="horizontal"
                        wrapperStyle={{ paddingTop: "20px" }}
                        formatter={(value) => <span className="text-[11px] font-medium text-muted-foreground">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          {/* Histórico mensal — 6 meses */}
          <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Histórico financeiro
                </h2>
                <p className="text-xs text-muted-foreground">Últimos 6 meses consolidados</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Mês</th>
                    <th className="pb-2 pr-3 font-medium">Faturamento</th>
                    <th className="pb-2 pr-3 font-medium">Movimentações</th>
                    <th className="pb-2 pr-3 font-medium">Ticket médio</th>
                    <th className="pb-2 font-medium">Cancelados</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyHistory.map((m) => (
                    <tr
                      key={m.key}
                      className={cn(
                        "border-b border-border/30 last:border-0",
                        m.key === format(anchorMonth, "yyyy-MM") && "bg-gold/5",
                      )}
                    >
                      <td className="py-3 pr-3 font-medium capitalize text-foreground">
                        {m.label}
                      </td>
                      <td className="py-3 pr-3 text-gold">{fmtBRL(m.revenue)}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{m.movements}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{fmtBRL(m.avg)}</td>
                      <td className="py-3 text-muted-foreground">{m.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Entradas financeiras — Transactions */}
          <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
            <div className="mb-6">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Entradas financeiras
              </h2>
              <p className="text-xs text-muted-foreground">Lançamentos manuais e pagamentos extras no período</p>
            </div>

            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(METHOD_LABEL).map(([method, label]) => {
                const total = (data?.rangeTx ?? [])
                  .filter((t) => t.method === method && t.status === "paid")
                  .reduce((sum, t) => sum + (t.amount_cents ?? 0), 0);
                
                if (total === 0) return null;

                return (
                  <div key={method} className="rounded-md border border-border/40 bg-surface-2 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1 font-display text-xl font-bold text-gold">{fmtBRL(total)}</p>
                  </div>
                );
              })}
              <div className="rounded-md border border-gold/20 bg-gold/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gold">Total Manual</p>
                <p className="mt-1 font-display text-xl font-bold text-gold">
                  {fmtBRL((data?.rangeTx ?? []).filter(t => t.status === "paid").reduce((s, t) => s + (t.amount_cents ?? 0), 0))}
                </p>
              </div>
            </div>

            {(data?.rangeTx?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento manual neste período.
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {data!.rangeTx.map((t) => {
                  const cust = t.customers as { full_name?: string } | null;
                  return (
                    <li key={t.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {cust?.full_name ?? t.description ?? "Pagamento"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.occurred_at), "dd MMM 'às' HH:mm", { locale: ptBR })}{" "}
                          · {METHOD_LABEL[t.method] ?? t.method}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={
                            t.status === "paid"
                              ? "border-gold/40 text-gold"
                              : "border-border text-muted-foreground"
                          }
                        >
                          {t.status === "paid" ? "Pago" : t.status}
                        </Badge>
                        <span className="font-display text-lg font-semibold text-gold">
                          {fmtBRL(t.amount_cents)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  hint,
  tooltip,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  hint?: string;
  tooltip?: string;
  icon: typeof DollarSign;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {tooltip && <KpiHint text={tooltip} />}
        </div>
        <Icon className="h-4 w-4 flex-shrink-0 text-gold" />
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-muted-foreground/80">{hint}</p>}
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function NewTransactionDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState<string>("none");
  const [appointmentId] = useState<string>("none");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("pix");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers-min-finance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, full_name")
        .order("full_name");
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!cents || isNaN(cents) || cents <= 0) {
      toast.error("Valor inválido");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("transactions").insert({
      customer_id: customerId === "none" ? null : customerId,
      appointment_id: appointmentId === "none" ? null : appointmentId,
      amount_cents: cents,
      method: method as any,
      status: "paid",
      description: description.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pagamento registrado");
    qc.invalidateQueries({ queryKey: ["finance-overview-v2"] });
    qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
    onClose();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Lançar pagamento</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Valor (R$) *</Label>
          <Input
            id="amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="80,00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Método *</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(METHOD_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cliente (opcional)</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nenhum —</SelectItem>
              {(customers ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Descrição</Label>
          <Input
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Corte + barba"
          />
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-gold text-background hover:bg-gold-soft"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registrar
        </Button>
      </form>
    </DialogContent>
  );
}
