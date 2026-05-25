import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Repeat,
  Clock,
  Settings,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KpiGridSkeleton, ListSkeleton } from "@/components/ui/premium-skeletons";
import { KpiHint } from "@/components/ui/kpi-hint";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type LinkTo =
  | "/dashboard/agenda"
  | "/dashboard/clientes"
  | "/dashboard/financeiro"
  | "/dashboard/horarios"
  | "/dashboard/configuracoes";

interface Kpi {
  label: string;
  value: string;
  icon: typeof Calendar;
  to: LinkTo;
  /** Microtexto curto exibido abaixo do valor — explica o KPI em linguagem simples */
  hint?: string;
  /** Texto longo exibido no tooltip do ícone (i) */
  tooltip?: string;
  trend?: { dir: "up" | "down" | "flat"; text: string };
  highlight?: boolean;
}

function DashboardOverview() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const prevWeekStart = startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 });
  const prevWeekEnd = endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-overview", todayStart.toISOString().slice(0, 10)],
    queryFn: async () => {
      // Faz queries individualmente para tolerar tabela transactions ausente
      const todayRes = await supabase
        .from("appointments")
        .select("id, status", { count: "exact" })
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", todayEnd.toISOString());

      const customersRes = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("archived", false);

      const recurringRes = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("archived", false)
        .gte("total_visits", 3);

      const topServicesRes = await supabase
        .from("appointments")
        .select("services(name)")
        .eq("status", "completed")
        .gte("starts_at", monthStart.toISOString());

      const upcomingRes = await supabase
        .from("appointments")
        .select("id, starts_at, status, customers!left(full_name), services!left(name)")
        .gte("starts_at", new Date().toISOString())
        .in("status", ["scheduled", "confirmed"])
        .order("starts_at", { ascending: true })
        .limit(6);

      // Transactions é opcional — se a tabela não existir, segue silenciosamente
      let monthRev = 0;
      let weekRev = 0;
      let prevWeekRev = 0;
      let monthPaidCount = 0;
      try {
        const monthRevRes = await supabase
          .from("transactions")
          .select("amount_cents")
          .gte("occurred_at", monthStart.toISOString())
          .eq("status", "paid");
        const weekRevRes = await supabase
          .from("transactions")
          .select("amount_cents")
          .gte("occurred_at", weekStart.toISOString())
          .lte("occurred_at", weekEnd.toISOString())
          .eq("status", "paid");
        const prevWeekRevRes = await supabase
          .from("transactions")
          .select("amount_cents")
          .gte("occurred_at", prevWeekStart.toISOString())
          .lte("occurred_at", prevWeekEnd.toISOString())
          .eq("status", "paid");
        if (!monthRevRes.error) {
          monthRev = (monthRevRes.data ?? []).reduce((s, t) => s + (t.amount_cents || 0), 0);
          monthPaidCount = (monthRevRes.data ?? []).length;
        }
        if (!weekRevRes.error) {
          weekRev = (weekRevRes.data ?? []).reduce((s, t) => s + (t.amount_cents || 0), 0);
        }
        if (!prevWeekRevRes.error) {
          prevWeekRev = (prevWeekRevRes.data ?? []).reduce((s, t) => s + (t.amount_cents || 0), 0);
        }
      } catch {
        // tabela ausente — KPIs financeiros zerados
      }

      const todayCount = todayRes.count ?? 0;
      const noShows = (todayRes.data ?? []).filter((a) => a.status === "no_show").length;

      const counts = new Map<string, number>();
      for (const r of (topServicesRes.data ?? []) as Array<{ services: { name?: string } | null }>) {
        const n = r.services?.name;
        if (!n) continue;
        counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      const topServices = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const weekGrowth =
        prevWeekRev > 0 ? Math.round(((weekRev - prevWeekRev) / prevWeekRev) * 100) : 0;

      return {
        todayCount,
        noShows,
        monthRev,
        weekRev,
        weekGrowth,
        avgTicket: monthPaidCount > 0 ? Math.round(monthRev / monthPaidCount) : 0,
        customers: customersRes.count ?? 0,
        recurring: recurringRes.count ?? 0,
        topServices,
        upcoming: upcomingRes.data ?? [],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <header>
          <p className="text-xs font-medium tracking-[0.3em] text-gold">PAINEL EXECUTIVO</p>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Visão geral</h1>
        </header>
        <KpiGridSkeleton count={8} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  const weekGrowth = data?.weekGrowth ?? 0;
  const noShowPct =
    (data?.todayCount ?? 0) > 0
      ? Math.round(((data?.noShows ?? 0) / (data?.todayCount || 1)) * 100)
      : 0;

  const presencePct = 100 - noShowPct;
  const recurringPct =
    (data?.customers ?? 0) > 0
      ? Math.round(((data?.recurring ?? 0) / (data?.customers || 1)) * 100)
      : 0;

  const kpis: Kpi[] = [
    {
      label: "Faturamento do mês",
      value: fmtBRL(data?.monthRev ?? 0),
      icon: DollarSign,
      to: "/dashboard/financeiro",
      highlight: true,
      hint: "total recebido neste mês",
      tooltip:
        "Soma de todos os pagamentos confirmados desde o dia 1º deste mês.",
      trend:
        (data?.monthRev ?? 0) > 0
          ? { dir: "up", text: "Mês em andamento" }
          : undefined,
    },
    {
      label: "Faturamento da semana",
      value: fmtBRL(data?.weekRev ?? 0),
      icon: TrendingUp,
      to: "/dashboard/financeiro",
      hint: "recebido nos últimos 7 dias",
      tooltip:
        "Comparado automaticamente com a semana anterior para mostrar se você está crescendo.",
      trend:
        weekGrowth !== 0
          ? {
              dir: weekGrowth > 0 ? "up" : "down",
              text: `${weekGrowth > 0 ? "+" : ""}${weekGrowth}% comparado à semana passada`,
            }
          : undefined,
    },
    {
      label: "Valor médio por atendimento",
      value: fmtBRL(data?.avgTicket ?? 0),
      icon: DollarSign,
      to: "/dashboard/financeiro",
      hint: "média por serviço realizado",
      tooltip:
        "Quanto cada cliente gasta em média por visita. Subir esse número significa vender combos ou serviços de maior valor.",
    },
    {
      label: "Agendamentos hoje",
      value: String(data?.todayCount ?? 0),
      icon: Calendar,
      to: "/dashboard/agenda",
      hint: "clientes marcados para hoje",
      trend:
        (data?.todayCount ?? 0) > 0
          ? { dir: "flat", text: `${data?.todayCount} horários ocupados` }
          : undefined,
    },
    {
      label: "Clientes cadastrados",
      value: String(data?.customers ?? 0),
      icon: Users,
      to: "/dashboard/clientes",
      hint: "base ativa da barbearia",
    },
    {
      label: "Clientes que voltam sempre",
      value: String(data?.recurring ?? 0),
      icon: Repeat,
      to: "/dashboard/clientes",
      hint: "fizeram 3 ou mais visitas",
      tooltip:
        "Quantos clientes já voltaram pelo menos 3 vezes. Esse é o coração do seu faturamento — quanto maior, mais previsível seu mês.",
      trend:
        (data?.customers ?? 0) > 0
          ? { dir: "flat", text: `${recurringPct}% da sua base` }
          : undefined,
    },
    {
      label: "Comparecimento hoje",
      value: (data?.todayCount ?? 0) === 0 ? "—" : `${presencePct}%`,
      icon: presencePct >= 80 ? TrendingUp : TrendingDown,
      to: "/dashboard/agenda",
      hint:
        (data?.todayCount ?? 0) === 0
          ? "sem agendamentos para hoje"
          : "presença confirmada dos clientes",
      tooltip:
        "Percentual de clientes que apareceram entre os agendados de hoje. 100% = ninguém faltou.",
      trend:
        (data?.todayCount ?? 0) === 0
          ? undefined
          : presencePct === 100
            ? { dir: "up", text: "Nenhuma ausência registrada" }
            : presencePct >= 80
              ? { dir: "flat", text: `${data?.noShows} ausência(s) hoje` }
              : { dir: "down", text: `${data?.noShows} ausência(s) — acima do normal` },
    },
    {
      label: "Configurações",
      value: "Gerenciar",
      icon: Settings,
      to: "/dashboard/configuracoes",
      hint: "perfil, serviços e equipe",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium tracking-[0.3em] text-gold">PAINEL EXECUTIVO</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe a operação em tempo real. Clique em qualquer card para ver detalhes.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const TrendIcon =
            k.trend?.dir === "up" ? TrendingUp : k.trend?.dir === "down" ? TrendingDown : null;
          return (
            <Link
              key={k.label}
              to={k.to}
              className={cn(
                "group relative overflow-hidden rounded-lg p-6 transition",
                k.highlight
                  ? "premium-card gold-glow-soft"
                  : "premium-card",
              )}
            >
              {k.highlight && (
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/10 blur-2xl" />
              )}
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {k.label}
                  </p>
                  {k.tooltip && <KpiHint text={k.tooltip} />}
                </div>
                <k.icon className="h-4 w-4 flex-shrink-0 text-gold" />
              </div>
              <p
                className={cn(
                  "mt-3 font-display font-bold leading-none",
                  k.highlight ? "text-3xl sm:text-4xl text-gradient-gold" : "text-2xl sm:text-3xl",
                )}
              >
                {k.value}
              </p>
              {k.hint && (
                <p className="mt-1.5 text-[11px] text-muted-foreground/80">{k.hint}</p>
              )}
              {k.trend ? (
                <div
                  className={cn(
                    "mt-3 flex items-center gap-1.5 text-[11px] font-medium",
                    k.trend.dir === "up"
                      ? "text-emerald-400"
                      : k.trend.dir === "down"
                        ? "text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  {TrendIcon && <TrendIcon className="h-3 w-3" />}
                  {k.trend.text}
                </div>
              ) : (
                <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 transition group-hover:text-gold">
                  Abrir detalhes →
                </p>
              )}
            </Link>
          );
        })}
      </div>

      {(data?.topServices.length ?? 0) > 0 && (
        <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
          <h2 className="mb-1 font-display text-xl font-semibold">Serviços mais procurados no mês</h2>
          <p className="mb-4 text-xs text-muted-foreground">o que seus clientes mais pedem</p>
          <ul className="space-y-2">
            {data!.topServices.map(([name, count]) => {
              const max = data!.topServices[0][1] || 1;
              const pct = (count / max) * 100;
              return (
                <li key={name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full bg-gradient-to-r from-gold-deep to-gold" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Próximos agendamentos</h2>
          <Link
            to="/dashboard/agenda"
            className="text-xs font-medium uppercase tracking-wider text-gold hover:underline"
          >
            Ver agenda →
          </Link>
        </div>
        {(data?.upcoming?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agendamento futuro.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {data?.upcoming.map((a) => {
              const d = new Date(a.starts_at);
              const customer = (a.customers as { full_name?: string } | null)?.full_name ?? "Cliente";
              const service = (a.services as { name?: string } | null)?.name ?? "Serviço";
              return (
                <li key={a.id}>
                  <Link
                    to="/dashboard/agenda"
                    search={{ date: format(d, "yyyy-MM-dd") }}
                    className="flex items-center justify-between py-3 transition hover:text-gold"
                  >
                    <div>
                      <p className="font-medium">{customer}</p>
                      <p className="text-xs text-muted-foreground">{service}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gold">
                        {format(d, "dd MMM", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">{format(d, "HH:mm")}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
