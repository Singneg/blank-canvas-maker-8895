import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronRight,
  BarChart3,
  CalendarDays,
  History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  Cell,
} from "recharts";
import { KpiGridSkeleton, ListSkeleton, ChartSkeleton } from "@/components/ui/premium-skeletons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/historico")({
  component: HistoryPage,
});

// Nota: Vou usar /dashboard/agenda como rota temporária ou sugerir a criação da rota real se possível.
// O TanStack Router requer que a rota exista no sistema de arquivos.
// O usuário pediu uma NOVA ABA chamada "Histórico".
// No TanStack Router baseado em arquivos, isso significa criar src/routes/dashboard.historico.tsx.

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  rescheduling: "Reagendar",
  no_show: "Não compareceu",
  cancelled: "Cancelado",
};

const STATUS_STYLE: Record<string, string> = {
  scheduled: "border-gold/40 bg-gold/10 text-gold",
  confirmed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  in_progress: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  completed: "border-emerald-600/40 bg-emerald-600/15 text-emerald-300",
  rescheduling: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  no_show: "border-red-500/40 bg-red-500/10 text-red-400",
  cancelled: "border-red-500/40 bg-red-500/10 text-red-400",
};

type FilterType = "today" | "week" | "month" | "all";

export default function HistoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>("month");
  const [search, setSearch] = useState("");

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["history-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          starts_at,
          status,
          customers (full_name),
          services (name, price_cents)
        `)
        .order("starts_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const filteredData = useMemo(() => {
    if (!appointments) return [];
    
    let result = appointments;
    const now = new Date();

    if (filter === "today") {
      result = result.filter(a => isWithinInterval(parseISO(a.starts_at), {
        start: startOfDay(now),
        end: endOfDay(now)
      }));
    } else if (filter === "week") {
      result = result.filter(a => isWithinInterval(parseISO(a.starts_at), {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 })
      }));
    } else if (filter === "month") {
      result = result.filter(a => isWithinInterval(parseISO(a.starts_at), {
        start: startOfMonth(now),
        end: endOfMonth(now)
      }));
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(a => 
        (a.customers as any)?.full_name?.toLowerCase().includes(s) ||
        (a.services as any)?.name?.toLowerCase().includes(s)
      );
    }

    return result;
  }, [appointments, filter, search]);

  const stats = useMemo(() => {
    const total = filteredData.length;
    const completed = filteredData.filter(a => a.status === "completed").length;
    const cancelled = filteredData.filter(a => a.status === "cancelled").length;
    const noShow = filteredData.filter(a => a.status === "no_show").length;
    const revenueCents = filteredData
      .filter(a => a.status === "completed")
      .reduce((acc, a) => acc + ((a.services as any)?.price_cents || 0), 0);

    return { total, completed, cancelled, noShow, revenueCents };
  }, [filteredData]);

  const chartData = useMemo(() => {
    // Agrupa por dia para o gráfico (últimos 7 dias ou conforme filtro)
    const map = new Map<string, { date: string, agendados: number, cancelados: number }>();
    
    // Pegar intervalo do filtro para o gráfico
    const sorted = [...filteredData].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    
    sorted.forEach(a => {
      const date = format(parseISO(a.starts_at), "dd/MM");
      const current = map.get(date) || { date, agendados: 0, cancelados: 0 };
      if (a.status === "cancelled" || a.status === "no_show") {
        current.cancelados += 1;
      } else {
        current.agendados += 1;
      }
      map.set(date, current);
    });

    return Array.from(map.values()).slice(-10); // Mostrar os últimos 10 dias com dados
  }, [filteredData]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <KpiGridSkeleton count={4} />
        <ChartSkeleton />
        <ListSkeleton rows={10} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.3em] text-gold uppercase">Histórico Operacional</p>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Relatório de Atendimentos</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar cliente ou serviço..." 
              className="pl-9 bg-surface-1 border-border/40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[140px] bg-surface-1 border-border/40">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
          label="Total Agendados" 
          value={String(stats.total)} 
          icon={CalendarDays}
          trend={stats.total > 0 ? "Atividade no período" : "Sem dados"}
          color="text-gold"
          indicatorColor="bg-gold"
        />
        <KpiCard 
          label="Concluídos" 
          value={String(stats.completed)} 
          icon={TrendingUp}
          color="text-emerald-400"
        />
        <KpiCard 
          label="Cancelados/Faltas" 
          value={String(stats.cancelled + stats.noShow)} 
          icon={TrendingDown}
          color="text-red-500"
          indicatorColor="bg-red-500"
        />
        <KpiCard 
          label="Faturamento" 
          value={fmtBRL(stats.revenueCents)} 
          icon={DollarSign}
          highlight
        />
      </div>

      {/* Gráfico */}
      <section className="rounded-lg border border-border/60 bg-surface-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gold" />
            Fluxo de Atendimentos
          </h2>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} 
              />
              <RTooltip 
                cursor={{ fill: "hsl(var(--surface-2))" }}
                contentStyle={{ 
                  backgroundColor: "hsl(var(--surface-1))", 
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px"
                }}
              />
              <Legend />
              <Bar dataKey="agendados" name="Agendados" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cancelados" name="Cancelados" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-lg border border-border/60 bg-surface-1 overflow-hidden">
        <div className="p-6 border-b border-border/40 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-gold" />
            Lista de Agendamentos
          </h2>
          <span className="text-xs text-muted-foreground">{filteredData.length} registros encontrados</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-2/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-4 font-medium">Data/Hora</th>
                <th className="px-6 py-4 font-medium">Cliente</th>
                <th className="px-6 py-4 font-medium">Serviço</th>
                <th className="px-6 py-4 font-medium">Valor</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredData.map((a) => {
                const date = parseISO(a.starts_at);
                const customer = (a.customers as any)?.full_name || "Cliente";
                const service = (a.services as any)?.name || "Serviço";
                const price = (a.services as any)?.price_cents || 0;
                
                return (
                  <tr 
                    key={a.id} 
                    className="group hover:bg-surface-2/30 transition-colors cursor-pointer"
                    onClick={() => {
                      // Navegar para a agenda na data correspondente
                      navigate({ 
                        to: "/dashboard/agenda",
                        search: { date: format(date, "yyyy-MM-dd") } 
                      } as any);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{format(date, "dd/MM/yyyy")}</span>
                        <span className="text-xs text-muted-foreground">{format(date, "HH:mm")}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{customer}</td>
                    <td className="px-6 py-4 text-muted-foreground">{service}</td>
                    <td className="px-6 py-4 font-semibold text-gold">{fmtBRL(price)}</td>
                    <td className="px-6 py-4">
                      <Badge className={cn("rounded-full px-2.5 py-0.5 text-[10px]", STATUS_STYLE[a.status || "scheduled"])}>
                        {STATUS_LABEL[a.status || "scheduled"]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum agendamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, trend, highlight, color, indicatorColor }: any) {
  return (
    <div className={cn(
      "premium-card p-6 rounded-lg relative overflow-hidden",
      highlight && "gold-glow-soft"
    )}>
      {indicatorColor && (
        <div className={cn("absolute top-0 left-0 w-1 h-full", indicatorColor)} />
      )}
      <div className="flex items-start justify-between">
        <p className={cn(
          "text-[11px] font-medium uppercase tracking-wider",
          color ? color : "text-muted-foreground"
        )}>
          {label}
        </p>
        <Icon className={cn("h-4 w-4", color ? color : "text-gold")} />
      </div>
      <p className={cn(
        "mt-3 font-display font-bold text-2xl sm:text-3xl",
        highlight ? "text-gradient-gold" : color
      )}>
        {value}
      </p>
      {trend && <p className="mt-1 text-[10px] text-muted-foreground/80">{trend}</p>}
    </div>
  );
}
