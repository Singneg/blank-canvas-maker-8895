import { Link, useLocation } from "@tanstack/react-router";
import { Calendar, Users, LayoutDashboard, DollarSign, Settings, History } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/dashboard" | "/dashboard/agenda" | "/dashboard/clientes" | "/dashboard/financeiro" | "/dashboard/configuracoes" | "/dashboard/historico";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};
const items: ReadonlyArray<NavItem> = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/agenda", label: "Agenda", icon: Calendar },
  { to: "/dashboard/historico", label: "Histórico", icon: History },
  { to: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/dashboard/configuracoes", label: "Mais", icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = it.exact
            ? location.pathname === it.to
            : location.pathname.startsWith(it.to);
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium uppercase tracking-wider transition",
                  active ? "text-gold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <it.icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_rgba(201,162,75,0.5)]")} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
