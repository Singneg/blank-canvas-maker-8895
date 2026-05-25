import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { optimizeImage } from "@/lib/image-optimization";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Image as ImageIcon,
  Save,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/portfolio" as any)({
  head: () => ({ meta: [{ title: "Portfólio — LÉO MORAES BARBER" }] }),
  component: PortfolioPage,
});

interface PortfolioItem {
  id: string;
  title: string;
  image_url: string;
  is_active: boolean;
  show_on_landing: boolean;
}

function PortfolioPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [open, setOpen] = useState(false);
  const [localItems, setLocalItems] = useState<PortfolioItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-portfolio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio" as any)
        .select("*")
        .order("created_at" as any, { ascending: false });
      
      // Se a tabela não existir ainda (primeiro acesso), o Supabase retornará erro.
      // Em um ambiente real, as migrações cuidariam disso.
      if (error) {
        return [];
      }
      return (data || []) as any as PortfolioItem[];
    },
  });

  useEffect(() => {
    if (items) {
      setLocalItems(items);
      setHasChanges(false);
    }
  }, [items]);

  async function handleSaveAll() {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Preparamos as atualizações
      // O Supabase não suporta bulk update de colunas diferentes por ID nativamente via .update() 
      // de forma simples como um INSERT, então faremos um loop ou usaremos rpc se disponível.
      // Dado o contexto, faremos updates individuais ou uma estratégia de upsert se possível.
      
      const updates = localItems.map(item => ({
        id: item.id,
        show_on_landing: item.show_on_landing,
        user_id: user.id, // Conforme solicitado: id + show_on_landing + user_id
        // Mantemos os outros campos para o upsert não os sobrescrever com null se a tabela for strict
        title: item.title,
        image_url: item.image_url,
        is_active: item.is_active
      }));

      const { error } = await supabase
        .from("portfolio")
        .upsert(updates as any, { onConflict: 'id' });

      if (error) throw error;

      toast.success("Alterações do portfólio salvas com sucesso!");
      setHasChanges(false);
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      qc.invalidateQueries({ queryKey: ["public-portfolio"] });
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar alterações: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleLocalLandingVisibility(itemId: string) {
    const newItems = localItems.map(item => {
      if (item.id === itemId) {
        if (!item.show_on_landing) {
          const currentCount = localItems.filter(i => i.show_on_landing).length;
          if (currentCount >= 6) {
            toast.warning("Limite atingido: você só pode destacar até 6 fotos.");
            return item;
          }
        }
        return { ...item, show_on_landing: !item.show_on_landing };
      }
      return item;
    });
    
    setLocalItems(newItems);
    setHasChanges(true);
  }

  function toggleLocalStatus(itemId: string) {
    const newItems = localItems.map(item => 
      item.id === itemId ? { ...item, is_active: !item.is_active } : item
    );
    setLocalItems(newItems);
    setHasChanges(true);
  }


  async function deleteItem(id: string) {
    if (!confirm("Deseja realmente excluir esta imagem?")) return;

    const { error } = await supabase
      .from("portfolio" as any)
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir item");
    } else {
      toast.success("Item removido com sucesso");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-portfolio"] }),
        qc.invalidateQueries({ queryKey: ["public-portfolio"] })
      ]);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.3em] text-gold">PORTFÓLIO</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Galeria de trabalhos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as fotos que aparecem na vitrine do seu site.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button 
              onClick={handleSaveAll} 
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar alterações do portfólio
            </Button>
          )}
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-gold text-background hover:bg-gold-soft">
                <Plus className="mr-2 h-4 w-4" /> Adicionar foto
              </Button>
            </DialogTrigger>
            <PortfolioDialog
              key={editing?.id ?? "new"}
              initial={editing}
              onClose={() => { setOpen(false); setEditing(null); }}
            />
          </Dialog>
        </div>
      </header>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (localItems?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface-1/40 py-20 text-center">
          <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Sua galeria está vazia.</p>
          <Button
            variant="link"
            className="mt-2 text-gold"
            onClick={() => setOpen(true)}
          >
            Clique para adicionar sua primeira foto
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {localItems.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-lg border border-border/40 bg-surface-1 transition hover:border-gold/40"
            >
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
              </div>
              <div className="p-4">
                <h3 className="truncate font-medium">{item.title}</h3>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={() => toggleLocalStatus(item.id)}
                      />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Status: {item.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.show_on_landing}
                        onCheckedChange={() => toggleLocalLandingVisibility(item.id)}
                      />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Destacar: {item.show_on_landing ? "Sim" : "Não"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-gold"
                      onClick={() => { setEditing(item); setOpen(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortfolioDialog({
  initial,
  onClose,
}: {
  initial: PortfolioItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial?.image_url ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Sync state if initial changes
  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setImageUrl(initial.image_url);
      setPreviewUrl(initial.image_url);
    } else {
      setTitle("");
      setImageUrl("");
      setFile(null);
      setPreviewUrl(null);
    }
    setImageError(false);
  }, [initial]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validar tamanho (10MB)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (selectedFile.size > MAX_SIZE) {
        toast.error("Imagem muito grande. Máximo 10MB.");
        e.target.value = ""; // Limpa o input
        return;
      }
      
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      setImageError(false);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const trimmedTitle = title.trim();

    if (!trimmedTitle || (!file && !imageUrl)) {
      toast.error("Por favor, preencha o título e selecione uma imagem");
      return;
    }

    setSubmitting(true);
    
    try {
      let finalImageUrl = imageUrl;

      // Se houver um novo arquivo, faz o upload
      if (file) {
        // Otimizar imagem antes do upload
        const optimizedFile = await optimizeImage(file);
        
        const fileExt = optimizedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('portfolio')
          .upload(filePath, optimizedFile);

        if (uploadError) {
          if (uploadError.message?.includes('Bucket not found') || (uploadError as any).error === 'Bucket not found') {
            throw new Error("Não foi possível enviar a imagem. Tente novamente em instantes.");
          }
          throw new Error("Falha ao fazer upload da imagem.");
        }

        const { data: { publicUrl } } = supabase.storage
          .from('portfolio')
          .getPublicUrl(filePath);

        finalImageUrl = publicUrl;
      }

      const payload = {
        title: trimmedTitle,
        image_url: finalImageUrl,
        is_active: initial ? initial.is_active : true,
        show_on_landing: initial ? initial.show_on_landing : false,
      };

      const { error } = initial
        ? await supabase.from("portfolio" as any).update(payload).eq("id", initial.id)
        : await supabase.from("portfolio" as any).insert(payload);

      if (error) {
        throw new Error("Não foi possível salvar o item.");
      }

      toast.success(initial ? "Item atualizado com sucesso" : "Item adicionado ao portfólio");
      
      // Forçar atualização imediata e garantir que os dados reflitam no UI
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-portfolio"] }),
        qc.invalidateQueries({ queryKey: ["public-portfolio"] })
      ]);
      
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{initial ? "Editar item" : "Nova foto"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <Label>Título do trabalho *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Degradê com barba lenhador"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Imagem do trabalho *</Label>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="cursor-pointer bg-surface-2 border-border/40 file:bg-gold file:text-background file:border-0 file:rounded-md file:px-4 file:py-1 file:mr-4 file:hover:bg-gold-soft transition-colors"
                required={!initial}
              />
              <Upload className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Formatos aceitos: JPG, PNG, WEBP, HEIC. Máx 10MB (Otimizado).
            </p>
            {imageUrl && !file && (
              <p className="text-[10px] text-muted-foreground italic">
                * Uma imagem já existe. Selecione uma nova apenas se desejar trocá-la.
              </p>
            )}
          </div>
        </div>

        {previewUrl && (
          <div className="mt-4 aspect-video overflow-hidden rounded-md border border-border/40 bg-muted/20 relative group">
            {!imageError ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="h-full w-full object-cover transition-opacity duration-300"
                onLoad={() => setImageError(false)}
                onError={() => {
                  setImageError(true);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full bg-destructive/5 text-destructive p-4 text-center">
                <ImageIcon className="mb-2 h-8 w-8 opacity-50" />
                <p className="text-xs font-medium">Não foi possível carregar a imagem</p>
                <p className="text-[10px] opacity-70 mt-1">Verifique se a URL está correta e é pública</p>
              </div>
            )}
            
            {/* Overlay sutil para indicar que é um preview */}
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-[10px] px-2 py-0.5 rounded text-white uppercase tracking-wider font-bold">
              Preview
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-gold text-background hover:bg-gold-soft"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {initial ? "Salvar alterações" : "Adicionar à galeria"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
