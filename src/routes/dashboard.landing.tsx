import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Layout, User, MessageSquare, MapPin, Scissors, Award, Upload, X, ImageIcon, Eye, Star as StarIcon, ArrowUpNarrowWide, Pencil, Check, Clock, DollarSign, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { optimizeImage } from "@/lib/image-optimization";


export const Route = createFileRoute("/dashboard/landing" as any)({
  head: () => ({ meta: [{ title: "Landing Page — LÉO MORAES BARBER" }] }),
  component: LandingEditor,
});

function LandingEditor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [data, setData] = useState<any>({
    hero_title: "",
    hero_highlight_word: "",
    hero_subtitle: "",
    hero_button_text: "",
    services_title: "",
    services_highlight_word: "",
    portfolio_title: "",
    portfolio_description: "",
    portfolio_item_subtitle: "",
    about_barber_name: "",
    about_title: "",
    about_description: "",
    barber_title: "",
    barber_photo_url: "",
    barber_image_url: "",
    years_experience: "",
    rating: 5,
    clients_count: "",
    specialties: "",
    instagram: "",
    address: "",
    phone: "",
    whatsapp: "",
    opening_hours: ""
  });
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;
      try {
        const { data: settings, error } = await supabase
          .from("landing_settings")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log("Registro de landing_settings não encontrado. Criando padrão...");
            const defaultData = {
              user_id: user.id,
              hero_title: "Estilo que define quem você é",
              hero_subtitle: "LÉO MORAES BARBER é mais que uma barbearia. É o ritual exclusivo dos homens que entendem que cada detalhe importa.",
              hero_button_text: "AGENDAR AGORA",
              services_title: "Assinatura LMB — Serviços Premium",
              services_highlight_word: "LMB",
              portfolio_title: "Trabalhos Recentes",
              portfolio_description: "Leonardo Moraes construiu sua reputação na obsessão pelo detalhe. Mais de uma década dedicada à arte da barbearia masculina.",
              portfolio_item_subtitle: "CORTE DE ASSINATURA",
              about_barber_name: "Leonardo Moraes",
              about_title: "A precisão é nossa assinatura",
              about_description: "Leonardo Moraes construiu sua reputação na obsessão pelo detalhe. Mais de uma década dedicada à arte da barbearia masculina.",
              barber_title: "MASTER BARBER",
              barber_photo_url: "",
              barber_image_url: "",
              years_experience: "10",
              rating: 5,
              clients_count: 2000,
              specialties: "Cortes de Assinatura, Barba Clássica, Visagismo",
              address: "Rua Exemplo, 123 - Centro",
              phone: "",
              whatsapp: "",
              instagram: "leomoraesbarber",
              opening_hours: "Segunda a Sexta: 09h às 19h\nSábado: 09h às 14h"
            };
            
            const { data: newData, error: insertError } = await supabase
              .from("landing_settings")
              .upsert(defaultData as any, { onConflict: 'user_id' })
              .select()
              .single();
              
            if (insertError) {
              console.error("Erro ao criar registro padrão:", insertError);
              setData(defaultData);
            } else if (newData) {
              setData(newData);
            }
          } else {
            throw error;
          }
        } else if (settings) {
          setData(settings);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.id]);

  useEffect(() => {
    const fetchServices = async () => {
      setServicesLoading(true);
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Erro ao buscar serviços:", error);
          toast.error("Erro ao carregar serviços");
        } else if (data) {
          setServices(data);
        }
      } catch (err) {
        console.error("Erro inesperado ao buscar serviços:", err);
      } finally {
        setServicesLoading(false);
      }
    };

    fetchServices();
  }, []);

  const formatSpecialties = (val: string) => {
    if (!val) return "";
    
    // Divide por vírgula, enter ou pelo próprio separador visual (•)
    // Preserva espaços internos para palavras compostas
    return val
      .split(/[,\n•]/)
      .map(item => item.trim()) // Limpa espaços extras ao redor
      .filter(item => item !== "")
      .join(" • ");
  };

  const handleServiceChange = (id: string, field: string, value: any) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleAddService = () => {
    const newService = {
      id: crypto.randomUUID(),
      name: "Novo Serviço",
      description: "Descrição do serviço",
      duration_minutes: 30,
      price_cents: "50,00",
      active: true
    };
    setServices(prev => [...prev, newService]);
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    
    try {
      // Tentar deletar do banco (se existir)
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id);
        
      if (error) {
        console.error("Erro ao deletar do banco:", error);
        // Se der erro, verificamos se o serviço existe localmente mas não no banco (ex: recém criado)
        // Se for erro de RLS ou algo real, o toast mostrará
      }
      
      setServices(prev => prev.filter(s => s.id !== id));
      toast.success("Serviço removido");
      
      // Invalidar caches
      queryClient.invalidateQueries({ queryKey: ["public-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    } catch (err: any) {
      console.error("Erro ao excluir serviço:", err);
      toast.error("Erro ao excluir serviço");
    }
  };

  async function save() {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error("Usuário não autenticado");
      return;
    }
    
    setSaving(true);
    try {
      // Formatar especialidades antes de salvar
      const formattedSpecialties = formatSpecialties(data.specialties);
      
      // Remover campos que não devem ser enviados ou que podem causar conflito indesejado
      const { id, created_at, updated_at, user_id, services_display, ...rest } = data;
      
      const payload = { 
        ...rest, 
        specialties: formattedSpecialties,
        user_id: currentUser.id
      };
      
      const { error } = await supabase
        .from("landing_settings")
        .upsert(payload as any, { onConflict: "user_id" });

      if (error) throw error;
      
      // Salvar serviços - sempre com user_id do usuário autenticado
      if (services.length > 0) {
        const servicesToUpsert = services.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          duration_minutes: parseInt(s.duration_minutes) || 0,
          price_cents: typeof s.price_cents === 'string' 
            ? Math.round(parseFloat(s.price_cents.replace(/\./g, "").replace(",", ".")) * 100) || 0 
            : s.price_cents,
          active: s.active !== undefined ? s.active : true
        }));

        const { error: sError } = await supabase
          .from("services")
          .upsert(servicesToUpsert as any);
            
        if (sError) {
          console.error("Erro ao salvar serviços durante save global:", sError);
          throw sError;
        }
      }

      // Forçar atualização local
      const { data: refreshed, error: refreshError } = await supabase
        .from("landing_settings")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();
      
      if (refreshError) throw refreshError;
      if (refreshed) setData(refreshed);

      // Recarregar serviços para pegar IDs reais do banco
      const { data: updatedServices, error: fetchError } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: true });
        
      if (!fetchError && updatedServices) {
        setServices(updatedServices);
      }

      toast.success("Tudo salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["landing-settings"] });
      queryClient.invalidateQueries({ queryKey: ["landing-settings-public"] });
      queryClient.invalidateQueries({ queryKey: ["public-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const handleChange = (field: string, value: string) => {
    setData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo (adicionado HEIC via optimizeImage se suportado pelo navegador)
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
      toast.error("Formato inválido. Use JPG, PNG, WEBP ou HEIC.");
      return;
    }

    // Validar tamanho (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("Imagem muito grande. Máximo 10MB.");
      return;
    }

    try {
      setSaving(true);
      
      // Otimizar imagem antes do upload
      const optimizedFile = await optimizeImage(file);
      
      const fileExt = optimizedFile.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `barbers/${fileName}`;

      // 1. Upload para o Storage (usando optimizedFile)
      const { error: uploadError } = await supabase.storage
        .from("barber-images")
        .upload(filePath, optimizedFile);


      if (uploadError) throw uploadError;

      // 2. Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("barber-images")
        .getPublicUrl(filePath);

      // 3. Atualizar estado local
      handleChange("barber_image_url", publicUrl);
      toast.success("Foto carregada com sucesso!");
    } catch (err: any) {
      console.error("Erro no upload:", err);
      toast.error("Erro ao carregar imagem: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-20">
      <header>
        <p className="text-xs font-medium tracking-[0.3em] text-gold uppercase">CMS INTERNO</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Conteúdo da Landing Page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize os textos e informações da sua página principal em tempo real.
        </p>
      </header>

      <div className="grid gap-8">
        {/* HERO SECTION */}
        <section className="premium-card rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Layout className="h-5 w-5 text-gold" />
            <h2 className="font-display text-xl font-bold">[ HERO ]</h2>
          </div>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Título Principal</Label>
              <Input 
                value={data.hero_title} 
                onChange={e => handleChange("hero_title", e.target.value)} 
                placeholder="Ex: Estilo que define quem você é"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Palavra destacada do título</Label>
              <Input 
                value={data.hero_highlight_word || ""} 
                onChange={e => handleChange("hero_highlight_word", e.target.value)} 
                placeholder="Ex: define"
              />
              <p className="text-[10px] text-muted-foreground italic">
                A palavra informada aqui aparecerá com a cor dourada no título principal.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Subtítulo / Descrição</Label>
              <Textarea 
                value={data.hero_subtitle} 
                onChange={e => handleChange("hero_subtitle", e.target.value)} 
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Texto do Botão Principal</Label>
              <Input 
                value={data.hero_button_text} 
                onChange={e => handleChange("hero_button_text", e.target.value)} 
              />
            </div>
          </div>
        </section>
        
        {/* SERVICES SECTION */}
        <section className="premium-card rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Scissors className="h-5 w-5 text-gold" />
            <h2 className="font-display text-xl font-bold">[ SERVIÇOS ]</h2>
          </div>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Título da Seção de Serviços</Label>
              <Input 
                value={data.services_title} 
                onChange={e => handleChange("services_title", e.target.value)} 
                placeholder="Ex: Assinatura LMB — Serviços Premium"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Palavra destacada do título de serviços</Label>
              <Input 
                value={data.services_highlight_word || ""} 
                onChange={e => handleChange("services_highlight_word", e.target.value)} 
                placeholder="Ex: LMB"
              />
              <p className="text-[10px] text-muted-foreground italic">
                A palavra informada aqui aparecerá com o estilo premium no título da seção de serviços.
              </p>
            </div>

            {/* Lista de serviços editáveis */}
            <div className="mt-4 space-y-4 border-t border-border/40 pt-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gold flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  Edição de Serviços
                </h3>
                <Button 
                  onClick={handleAddService} 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] border-gold/50 text-gold hover:bg-gold hover:text-background"
                >
                  <Scissors className="h-3 w-3 mr-1" />
                  ADICIONAR SERVIÇO
                </Button>
              </div>
              
              {servicesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando serviços...
                </div>
              ) : services.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum serviço encontrado no banco de dados.</p>
              ) : (
                services.map(service => (
                  <div key={service.id} className="p-4 rounded-lg bg-surface-2 border border-border/40 space-y-3 relative">
                    <button 
                      onClick={() => handleDeleteService(service.id)}
                      className="absolute top-3 right-3 p-2 text-red-500 hover:text-white hover:bg-red-500 border border-red-500/40 rounded-md transition-colors"
                      title="Excluir serviço"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <div>
                      <label className="block text-[10px] font-medium uppercase text-muted-foreground mb-1">Nome do Serviço</label>
                      <Input 
                        value={service.name} 
                        onChange={e => handleServiceChange(service.id, "name", e.target.value)}
                        className="bg-surface-3 border-border/50 focus:border-gold/50 h-9"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium uppercase text-muted-foreground mb-1">Descrição</label>
                      <Textarea 
                        value={service.description || ""} 
                        onChange={e => handleServiceChange(service.id, "description", e.target.value)}
                        className="bg-surface-3 border-border/50 focus:border-gold/50 min-h-[60px] text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-medium uppercase text-muted-foreground mb-1">Duração (min)</label>
                        <Input 
                          type="number"
                          value={service.duration_minutes} 
                          onChange={e => handleServiceChange(service.id, "duration_minutes", e.target.value)}
                          className="bg-surface-3 border-border/50 focus:border-gold/50 h-9"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium uppercase text-muted-foreground mb-1">Preço (R$)</label>
                        <Input 
                          type="text"
                          value={typeof service.price_cents === 'number' 
                            ? (service.price_cents / 100).toFixed(2).replace(".", ",") 
                            : service.price_cents} 
                          onChange={e => handleServiceChange(service.id, "price_cents", e.target.value)}
                          className="bg-surface-3 border-border/50 focus:border-gold/50 h-9"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </section>


        {/* PORTFOLIO SECTION */}
        <section className="premium-card rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-5 w-5 text-gold" />
            <h2 className="font-display text-xl font-bold">[ PORTFÓLIO ]</h2>
          </div>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Título da Seção de Portfólio</Label>
              <Input 
                value={data.portfolio_title} 
                onChange={e => handleChange("portfolio_title", e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição do Portfólio</Label>
              <Textarea 
                value={data.portfolio_description} 
                onChange={e => handleChange("portfolio_description", e.target.value)} 
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subtítulo dos Itens (Ex: CORTE DE ASSINATURA)</Label>
              <Input 
                value={data.portfolio_item_subtitle} 
                onChange={e => handleChange("portfolio_item_subtitle", e.target.value)} 
              />
            </div>
          </div>
        </section>

        {/* ABOUT SECTION */}
        <section className="premium-card rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-5 w-5 text-gold" />
            <h2 className="font-display text-xl font-bold">[ SOBRE ]</h2>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome do Profissional</Label>
                <Input 
                  value={data.about_barber_name} 
                  onChange={e => handleChange("about_barber_name", e.target.value)} 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Título Profissional (Ex: MASTER BARBER)</Label>
                <Input 
                  value={data.barber_title} 
                  onChange={e => handleChange("barber_title", e.target.value)} 
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Foto do Barbeiro (Upload)</Label>
                <div className="flex flex-col gap-4">
                  <div className="relative aspect-[3/4] w-32 overflow-hidden rounded-md border border-border bg-surface-2 flex items-center justify-center">
                    {data.barber_image_url ? (
                      <>
                        <img 
                          src={data.barber_image_url} 
                          alt="Preview" 
                          className="h-full w-full object-cover"
                        />
                        <button
                          onClick={() => handleChange("barber_image_url", "")}
                          className="absolute top-1 right-1 bg-background/80 p-1 rounded-full hover:bg-destructive hover:text-white transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("barber-photo-upload")?.click()}
                      disabled={saving}
                      className="cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {data.barber_image_url ? "Alterar foto" : "Selecionar foto"}
                    </Button>
                    <input
                      id="barber-photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      JPG, PNG, WEBP ou HEIC. Máx 10MB (Otimizado).
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Foto do Profissional (URL de fallback)</Label>
                <Input 
                  value={data.barber_photo_url} 
                  onChange={e => handleChange("barber_photo_url", e.target.value)} 
                  placeholder="URL externa caso não use upload"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Anos de Experiência</Label>
                <Input 
                  value={data.years_experience} 
                  onChange={e => handleChange("years_experience", e.target.value)} 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Avaliação Média (1-5)</Label>
                <Input 
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={data.rating} 
                  onChange={e => handleChange("rating", e.target.value)} 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade de Clientes (+1000)</Label>
                <Input 
                  value={data.clients_count} 
                  onChange={e => handleChange("clients_count", e.target.value)} 
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label>Especialidades (separe por vírgula ou enter)</Label>
              <Input 
                value={data.specialties} 
                onChange={e => handleChange("specialties", e.target.value)} 
                onBlur={e => handleChange("specialties", formatSpecialties(e.target.value))}
                placeholder="Ex: Barba, Fade, Degradê"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Título da Seção Sobre</Label>
              <Input 
                value={data.about_title} 
                onChange={e => handleChange("about_title", e.target.value)} 
                placeholder="Ex: A precisão é nossa assinatura"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição do Profissional</Label>
              <Textarea 
                value={data.about_description} 
                onChange={e => handleChange("about_description", e.target.value)} 
                rows={4}
              />
            </div>
          </div>
        </section>


        {/* CONTACT SECTION */}
        <section className="premium-card rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-5 w-5 text-gold" />
            <h2 className="font-display text-xl font-bold">[ CONTATO ]</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Endereço</Label>
              <Input 
                value={data.address} 
                onChange={e => handleChange("address", e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input 
                value={data.phone} 
                onChange={e => handleChange("phone", e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp (apenas números)</Label>
              <Input 
                value={data.whatsapp} 
                onChange={e => handleChange("whatsapp", e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <Label>Instagram (usuário)</Label>
              <Input 
                value={data.instagram} 
                onChange={e => handleChange("instagram", e.target.value)} 
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Horário de funcionamento</Label>
              <Textarea 
                value={data.opening_hours} 
                onChange={e => handleChange("opening_hours", e.target.value)} 
                placeholder="Ex: Segunda a Sexta: 09h às 19h"
                rows={3}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-6 right-6 md:right-10 z-50">
        <Button 
          onClick={save} 
          disabled={saving} 
          size="lg"
          className="bg-gold text-background hover:bg-gold-soft shadow-xl scale-110"
        >
          {saving ? <Loader2 className="animate-spin mr-2 h-5 w-5"/> : <Save className="mr-2 h-5 w-5"/>}
          Salvar todas as alterações
        </Button>
      </div>
    </div>
  );
}
