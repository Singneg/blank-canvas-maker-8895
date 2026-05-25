import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  Scissors,
  Clock,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/servicos" as any)({
  head: () => ({ meta: [{ title: "Gerenciar Serviços — LÉO MORAES BARBER" }] }),
  component: ServicesManager,
});

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  active: boolean | null;
  created_at: string | null;
}

function ServicesManager() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_minutes: 30,
    price_brl: "",
    active: true
  });

  const fetchServices = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setServices((data as Service[]) || []);
    } catch (err: any) {
      console.error("Erro ao carregar serviços:", err);
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [user]);

  const handleOpenModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || "",
        duration_minutes: service.duration_minutes,
        price_brl: (service.price_cents / 100).toFixed(2).replace(".", ","),
        active: service.active ?? true,
      });
    } else {
      setEditingService(null);
      setFormData({
        name: "",
        description: "",
        duration_minutes: 30,
        price_brl: "",
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name || !formData.price_brl) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const priceCents = Math.round(
        parseFloat(formData.price_brl.replace(",", ".")) * 100
      );

      const payload = {
        user_id: user.id,
        name: formData.name,
        description: formData.description,
        duration_minutes: formData.duration_minutes,
        price_cents: priceCents,
        active: formData.active
      };

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(payload)
          .eq("id", editingService.id);
        if (error) throw error;
        toast.success("Serviço atualizado!");
      } else {
        const { error } = await supabase
          .from("services")
          .insert(payload);
        if (error) throw error;
        toast.success("Serviço criado!");
      }

      setIsModalOpen(false);
      fetchServices();
    } catch (err: any) {
      console.error("Erro ao salvar serviço:", err);
      toast.error("Erro ao salvar serviço");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (service: Service) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("services")
        .update({ 
          active: !service.active,
          user_id: user.id 
        })
        .eq("id", service.id);

      if (error) throw error;
      
      setServices(prev => 
        prev.map(s => s.id === service.id ? { ...s, active: !s.active } : s)
      );
      toast.success(service.active ? "Serviço desativado" : "Serviço ativado");
    } catch (err: any) {
      console.error("Erro ao alterar status:", err);
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;

    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== id));
      toast.success("Serviço excluído");
    } catch (err: any) {
      console.error("Erro ao excluir serviço:", err);
      toast.error("Erro ao excluir serviço");
    }
  };

  if (loading && services.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl pb-20">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.3em] text-gold uppercase">GESTÃO</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Serviços</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie o catálogo de serviços que aparece na sua landing page.
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-gold hover:bg-gold/90 text-black font-bold">
          <Plus className="mr-2 h-4 w-4" />
          Novo Serviço
        </Button>
      </header>

      <div className="premium-card rounded-lg overflow-hidden border border-border/40 bg-surface-1/50">
        <Table>
          <TableHeader className="bg-surface-2/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40%] text-foreground">Serviço</TableHead>
              <TableHead className="text-foreground">Duração</TableHead>
              <TableHead className="text-foreground">Preço</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
              <TableHead className="text-right text-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Nenhum serviço cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              services.map((service) => (
                <TableRow key={service.id} className="hover:bg-surface-2/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{service.name}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {service.description || "Sem descrição"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-gold" />
                      {service.duration_minutes} min
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-medium text-foreground">
                      <span className="text-xs text-gold">R$</span>
                      {(service.price_cents / 100).toFixed(2).replace(".", ",")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={service.active ?? true} 
                        onCheckedChange={() => handleToggleActive(service)}
                      />
                      <Badge variant={service.active ?? true ? "outline" : "secondary"} className={service.active ?? true ? "border-gold/50 text-gold bg-gold/5" : ""}>
                        {service.active ?? true ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-gold hover:bg-gold/10"
                        onClick={() => handleOpenModal(service)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(service.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-border/40 bg-surface-1">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-bold">
                {editingService ? "Editar Serviço" : "Novo Serviço"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações do serviço para exibição na landing page.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-6">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-sm font-medium">Nome do Serviço *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Corte Clássico"
                  required
                  className="bg-surface-2"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description" className="text-sm font-medium">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o que está incluído no serviço..."
                  rows={3}
                  className="bg-surface-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="duration" className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-gold" />
                    Duração (min)
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                    min="1"
                    className="bg-surface-2"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price" className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-gold" />
                    Preço (R$) *
                  </Label>
                  <Input
                    id="price"
                    value={formData.price_brl}
                    onChange={(e) => setFormData({ ...formData, price_brl: e.target.value })}
                    placeholder="0,00"
                    required
                    className="bg-surface-2"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border/40 p-4 bg-surface-2/30">
                <Switch 
                  id="active"
                  checked={formData.active ?? true}
                  onCheckedChange={(val) => setFormData({ ...formData, active: val })}
                />
                <div className="grid gap-1">
                  <Label htmlFor="active" className="text-sm font-semibold">Serviço Ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Se desativado, o serviço não aparecerá na landing page.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={saving}
                className="bg-gold hover:bg-gold/90 text-black font-bold"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  editingService ? "Salvar Alterações" : "Criar Serviço"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
