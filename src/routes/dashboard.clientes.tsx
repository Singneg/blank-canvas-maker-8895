import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatPhone, maskPhoneInput, normalizePhoneForStorage } from "@/lib/phone";
import {
  Loader2,
  Search,
  AlertTriangle,
  TrendingUp,
  Plus,
  Trash2,
  Info,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/clientes")({
  component: CustomersPage,
});

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizePhone(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

function normalizeEmail(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  total_visits: number;
  total_spent_cents: number;
  last_visit_at: string | null;
  created_at: string | null;
  archived?: boolean;
  platform_logins: number;
  last_login_at: string | null;
  loyalty_points?: number;
}

function computeScores(c: Customer) {
  const now = new Date();
  const last = c.last_visit_at ? new Date(c.last_visit_at) : null;
  const first = c.created_at ? new Date(c.created_at) : null;
  const daysSince = last ? differenceInDays(now, last) : 999;
  const lifespanDays = first ? Math.max(differenceInDays(now, first), 1) : 1;
  const visitsPerMonth = (c.total_visits / lifespanDays) * 30;

  // Churn real: combina recência + frequência + LTV
  let churn = 0;
  if (c.total_visits === 0) {
    // Cliente cadastrado mas nunca veio
    churn = Math.min(100, 30 + Math.min(daysSince, 60));
  } else if (visitsPerMonth >= 1.5) {
    // Cliente recorrente — sensível a recência curta
    churn = Math.min(100, daysSince * 4);
  } else if (visitsPerMonth >= 0.5) {
    churn = Math.min(100, daysSince * 2);
  } else {
    churn = Math.min(100, daysSince);
  }
  // Bonus por LTV: cliente VIP perde menos pontos
  if (c.total_spent_cents >= 50000 && c.total_visits >= 3) {
    churn = Math.max(0, churn - 15);
  }

  return {
    churn: Math.round(churn),
    visitsPerMonth: Number(visitsPerMonth.toFixed(2)),
    daysSince,
  };
}

function CustomersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      console.log("Fetching customers from direct table...");
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching customers:", error);
        throw error;
      }
      console.log("Customers fetched:", data);
      return (data ?? []) as Customer[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.toLowerCase().trim();
    if (!term) return data;
    const termPhone = normalizePhone(term);
    return data.filter(
      (c) =>
        c.full_name.toLowerCase().includes(term) ||
        normalizeEmail(c.email).includes(term) ||
        (termPhone.length > 0 && normalizePhone(c.phone).includes(termPhone)),
    );
  }, [data, q]);

  // Sugestões em tempo real (autocomplete) — top 6 quando há termo
  const suggestions = useMemo(() => {
    if (!q.trim()) return [] as Customer[];
    return filtered.slice(0, 6);
  }, [q, filtered]);

  // Clientes com alto risco de evasão (churn >= 70) — visão IA
  const atRisk = useMemo(() => {
    if (!data) return [] as Array<Customer & { churn: number; daysSince: number }>;
    return data
      .map((c) => {
        const s = computeScores(c);
        return { ...c, churn: s.churn, daysSince: s.daysSince };
      })
      .filter((c) => c.churn >= 70 && (c.total_visits ?? 0) > 0)
      .sort((a, b) => b.churn - a.churn)
      .slice(0, 3);
  }, [data]);

  async function archiveCustomer() {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase
      .from("customers")
      .update({ archived: true })
      .eq("id", toDelete.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cliente arquivado com sucesso");
    qc.invalidateQueries({ queryKey: ["customers-list"] });
    qc.invalidateQueries({ queryKey: ["customers-min"] });
    setToDelete(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.3em] text-gold">CRM</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Veja quem está ativo, quem voltou recente e quem precisa de atenção.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold text-background hover:bg-gold-soft">
              <Plus className="mr-2 h-4 w-4" />
              Novo cliente
            </Button>
          </DialogTrigger>
          <NewCustomerDialog
            existing={data ?? []}
            onClose={() => setOpen(false)}
          />
        </Dialog>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail..."
          className="pl-10"
        />
        {suggestions.length > 0 && q.trim().length > 1 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border/60 bg-surface-1 shadow-lg">
            <ul className="divide-y divide-border/30">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/dashboard/clientes/$id"
                    params={{ id: c.id }}
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-2"
                  >
                    <span className="font-medium">{c.full_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.phone ? formatPhone(c.phone) : (c.email ?? "—")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Hiding atRisk section temporarily */}
      {/* 
      {atRisk.length > 0 && (
        <section className="premium-card gold-glow-soft rounded-lg p-5">
          ...
        </section>
      )} 
      */}

      <div className="rounded-lg border border-border/60 bg-surface-1">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-center">Telefone</th>
                  <th className="px-4 py-3 text-center">Pontos</th>
                  <th className="px-4 py-3 text-center">Histórico</th>
                  <th className="px-4 py-3 w-12 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border/30 last:border-0 hover:bg-surface-2/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to="/dashboard/clientes/$id"
                          params={{ id: c.id }}
                          className="block"
                        >
                          <p className="font-medium hover:text-gold">
                            {c.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.email || "Sem e-mail"}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium">
                          {c.phone ? formatPhone(c.phone) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {c.loyalty_points || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to="/dashboard/clientes/$id"
                          params={{ id: c.id }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
                        >
                          <Search className="h-3 w-3" />
                          Ver tudo
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Arquivar ${c.full_name}`}
                          onClick={(e) => {
                            e.preventDefault();
                            setToDelete(c);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmação de exclusão */}
      <Dialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TEM CERTEZA?</DialogTitle>
            <DialogDescription>
              Deseja remover este cliente da lista ativa? O histórico e agendamentos serão preservados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={archiveCustomer}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Arquivar cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewCustomerDialog({
  existing,
  onClose,
}: {
  existing: Customer[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const phoneNorm = normalizePhone(phone);
    const emailNorm = normalizeEmail(email);

    // Validação de duplicidade local (telefone e email)
    if (phoneNorm) {
      const dup = existing.find(
        (c) => normalizePhone(c.phone) === phoneNorm,
      );
      if (dup) {
        toast.error(`Telefone já cadastrado para ${dup.full_name}`);
        return;
      }
    }
    if (emailNorm) {
      const dup = existing.find(
        (c) => normalizeEmail(c.email) === emailNorm,
      );
      if (dup) {
        toast.error(`E-mail já cadastrado para ${dup.full_name}`);
        return;
      }
    }

    setSubmitting(true);
    const { error } = await supabase.from("customers").insert({
      full_name: name.trim(),
      phone: normalizePhoneForStorage(phone),
      email: email.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cliente cadastrado");
    qc.invalidateQueries({ queryKey: ["customers-list"] });
    qc.invalidateQueries({ queryKey: ["customers-min"] });
    setName("");
    setPhone("");
    setEmail("");
    onClose();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo cliente</DialogTitle>
        <DialogDescription>
          Preencha os dados. Telefone e e-mail são verificados contra duplicatas.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
            placeholder="(11) 943769788"
            inputMode="tel"
            maxLength={16}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-gold text-background hover:bg-gold-soft"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Cadastrar
        </Button>
      </form>
    </DialogContent>
  );
}
