import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  User,
  Scissors,
  Users,
  Clock,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPhone, maskPhoneInput, normalizePhoneForStorage } from "@/lib/phone";

export const Route = createFileRoute("/dashboard/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — LÉO MORAES BARBER" }] }),
  component: SettingsPage,
});

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SettingsPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium tracking-[0.3em] text-gold">CONFIGURAÇÕES</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Preferências da barbearia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie perfil, equipe, serviços e horários de funcionamento.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard />
        <HoursCard />
        <ServicesCard />
        <BarbersCard />
      </div>
    </div>
  );
}

/* ---------- Perfil (persistido em public.barbers) ---------- */
function ProfileCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-settings", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("id, full_name, phone, email, user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setPhone(formatPhone(profile.phone ?? ""));
    } else if (user) {
      setName((user.user_metadata as { full_name?: string } | null)?.full_name ?? "");
      setPhone(formatPhone((user.user_metadata as { phone?: string } | null)?.phone ?? ""));
    }
  }, [profile, user]);

  async function save() {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Informe seu nome completo");
      return;
    }
    setSaving(true);

    const payload = {
      full_name: name.trim(),
      phone: normalizePhoneForStorage(phone),
      email: user.email ?? null,
    };

    let error;
    if (profile?.id) {
      ({ error } = await supabase
        .from("barbers")
        .update(payload)
        .eq("id", profile.id));
    } else {
      ({ error } = await supabase
        .from("barbers")
        .insert({ ...payload, user_id: user.id, active: true }));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedAt(Date.now());
    toast.success("✓ Perfil atualizado com sucesso", {
      description: "Suas informações foram salvas.",
    });
    qc.invalidateQueries({ queryKey: ["profile-settings"] });
    qc.invalidateQueries({ queryKey: ["barbers-min"] });
    setTimeout(() => setSavedAt(null), 3500);
  }

  return (
    <section className="premium-card rounded-lg p-6">
      <div className="mb-4 flex items-center gap-2">
        <User className="h-4 w-4 text-gold" />
        <h2 className="font-display text-lg font-semibold">Perfil do operador</h2>
      </div>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp / Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
              placeholder="(11) 943769788"
              inputMode="tel"
              maxLength={16}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={save}
              disabled={saving}
              className="bg-gold text-background hover:bg-gold-soft"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? "Salvando..." : "Salvar perfil"}
            </Button>
            {savedAt && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gold animate-in fade-in slide-in-from-left-2">
                <CheckCircle2 className="h-4 w-4" />
                Perfil atualizado com sucesso
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Horários (link rápido) ---------- */
function HoursCard() {
  return (
    <section className="premium-card rounded-lg p-6">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-gold" />
        <h2 className="font-display text-lg font-semibold">Horários de funcionamento</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Gerencie o expediente semanal, intervalos e dias ativos. Esses horários alimentam
        automaticamente os slots disponíveis na agenda pública.
      </p>
      <Link
        to="/dashboard/horarios"
        className="mt-5 inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/20"
      >
        Abrir editor de horários →
      </Link>
    </section>
  );
}

/* ---------- Serviços ---------- */
interface ServiceRow {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
}

function ServicesCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [open, setOpen] = useState(false);

  const { data: services, isLoading } = useQuery({
    queryKey: ["settings-services", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description, duration_minutes, price_cents, active")
        .eq("user_id", user!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
  });

  async function toggleActive(s: ServiceRow) {
    if (!user) return;
    const { error } = await supabase
      .from("services")
      .update({ 
        active: !s.active,
        user_id: user.id 
      })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else {
      toast.success(s.active ? "Serviço desativado" : "Serviço ativado");
      qc.invalidateQueries({ queryKey: ["settings-services"] });
      qc.invalidateQueries({ queryKey: ["services-min"] });
    }
  }

  async function deleteService(id: string) {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Serviço excluído");
      qc.invalidateQueries({ queryKey: ["settings-services"] });
      qc.invalidateQueries({ queryKey: ["services-min"] });
    }
  }

  return (
    <section className="premium-card rounded-lg p-6 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-gold" />
          <h2 className="font-display text-lg font-semibold">Serviços</h2>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gold text-background hover:bg-gold-soft">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo
            </Button>
          </DialogTrigger>
          <ServiceDialog
            key={editing?.id ?? "new"}
            initial={editing}
            onClose={() => { setOpen(false); setEditing(null); }}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (services?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {services!.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.duration_minutes} min · {fmtBRL(s.price_cents)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={s.active ? "border-gold/40 text-gold" : "border-border text-muted-foreground"}
                >
                  {s.active ? "Ativo" : "Inativo"}
                </Badge>
                <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:text-gold"
                  onClick={() => { setEditing(s); setOpen(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => deleteService(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ServiceDialog({ initial, onClose }: { initial: ServiceRow | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [duration, setDuration] = useState(String(initial?.duration_minutes ?? 30));
  const [price, setPrice] = useState(((initial?.price_cents ?? 0) / 100).toFixed(2).replace(".", ","));
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    
    const dur = parseInt(duration, 10);
    const numericPrice = parseFloat(price.replace(/[^\d,.-]/g, "").replace(",", "."));
    const cents = Math.round(numericPrice * 100);

    if (!name.trim() || !dur || isNaN(cents)) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }
    
    setSubmitting(true);
    const payload = { 
      user_id: user.id,
      name: name.trim(), 
      description: description?.trim() || null,
      duration_minutes: dur, 
      price_cents: cents, 
      active: initial ? initial.active : true 
    };

    const { error } = initial
      ? await supabase.from("services").update(payload).eq("id", initial.id)
      : await supabase.from("services").insert(payload);

    setSubmitting(false);
    
    if (error) {
      console.error("Erro ao salvar serviço:", error);
      toast.error(error.message || "Erro ao salvar serviço");
      return;
    }
    
    toast.success(initial ? "Serviço atualizado" : "Serviço criado");
    qc.invalidateQueries({ queryKey: ["settings-services"] });
    qc.invalidateQueries({ queryKey: ["services-min"] });
    onClose();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{initial ? "Editar serviço" : "Novo serviço"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Ex: Corte de Cabelo"
            required 
          />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição (opcional)</Label>
          <Input 
            value={description || ""} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="Ex: Corte simples com máquina ou tesoura"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Duração (min) *</Label>
            <Input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$) *</Label>
            <Input 
              value={price} 
              onChange={(e) => setPrice(e.target.value)} 
              placeholder="0,00"
              required 
            />
          </div>
        </div>
        <div className="pt-2">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-gold text-background hover:bg-gold-soft"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Salvar alterações" : "Criar serviço"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

/* ---------- Equipe (Barbeiros) ---------- */
interface BarberRow {
  id: string;
  full_name: string;
  bio: string | null;
  active: boolean;
}

function BarbersCard() {
  const qc = useQueryClient();
  const { data: barbers, isLoading } = useQuery({
    queryKey: ["settings-barbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("id, full_name, bio, active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as BarberRow[];
    },
  });

  async function toggleActive(b: BarberRow) {
    const { error } = await supabase
      .from("barbers")
      .update({ active: !b.active })
      .eq("id", b.id);
    if (error) toast.error(error.message);
    else {
      toast.success(b.active ? "Barbeiro desativado" : "Barbeiro ativado");
      qc.invalidateQueries({ queryKey: ["settings-barbers"] });
      qc.invalidateQueries({ queryKey: ["barbers-min"] });
    }
  }

  return (
    <section className="premium-card rounded-lg p-6 lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-gold" />
        <h2 className="font-display text-lg font-semibold">Equipe</h2>
      </div>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      ) : (barbers?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {barbers!.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{b.full_name}</p>
                {b.bio && <p className="truncate text-xs text-muted-foreground">{b.bio}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={b.active ? "border-gold/40 text-gold" : "border-border text-muted-foreground"}
                >
                  {b.active ? "Ativo" : "Inativo"}
                </Badge>
                <Switch checked={b.active} onCheckedChange={() => toggleActive(b)} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Para adicionar novos barbeiros, crie a conta correspondente e atribua a função apropriada.
      </p>
    </section>
  );
}
