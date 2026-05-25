import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { GoldWatermark } from "@/components/brand/watermark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Scissors, Award, MapPin, Clock, Sparkles, Phone, Star, Instagram } from "lucide-react";
import { formatPhone } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LÉO MORAES BARBER — Barbearia Premium" },
      {
        name: "description",
        content:
          "Cortes de assinatura, barba clássica, tratamentos premium. Agende agora na LÉO MORAES BARBER.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [landingSettings, setLandingSettings] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { user, isAuthenticated, hasAnyRole } = useAuth();
  const dashHref = hasAnyRole(["owner", "barber", "master_admin"]) ? "/dashboard" : "/cliente";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { data: pData },
          { data: sData },
          { data: servData },
          { data: profData }
        ] = await Promise.all([
          supabase
            .from("portfolio")
            .select("id, title, image_url")
            .eq("show_on_landing", true),
          supabase
            .from("landing_settings")
            .select("*")
            .eq("user_id", "46a9ce9b-ffc9-48ae-9f04-b61e2ccb4300")
            .maybeSingle(),
          supabase
            .from("services")
            .select("*")
            .order("created_at", { ascending: true }),
          supabase
            .from("barbers")
            .select("full_name, phone")
            .eq("active", true)
            .limit(1)
            .maybeSingle()
        ]);

        setPortfolio(pData || []);
        setLandingSettings(sData || null);
        setServices(servData || []);
        setProfile(profData || null);
      } catch (error) {
        console.error("ERRO NO FETCH:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const data = landingSettings;

  const whatsappUrl = profile?.phone 
    ? `https://wa.me/55${profile.phone.replace(/\D/g, "")}`
    : "#";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm tracking-widest uppercase">Carregando experiência premium...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div className="max-w-lg space-y-4">
          <h1 className="font-display text-3xl font-bold text-destructive">
            Ops! Algo deu errado.
          </h1>
          <p className="text-sm text-muted-foreground">
            Não conseguimos carregar as configurações da barbearia.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 border-gold/40 text-gold">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6">
          <Logo size={72} />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#servicos" className="transition hover:text-gold">Serviços</a>
            <a href="#portfolio" className="transition hover:text-gold">Portfólio</a>
            <a href="#sobre" className="transition hover:text-gold">Sobre</a>
            <a href="#contato" className="transition hover:text-gold">Contato</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button asChild variant="outline" size="sm" className="border-gold/40 text-gold hover:bg-gold hover:text-background">
                <Link to={dashHref}>Minha conta</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="border-gold/40 text-gold hover:bg-gold hover:text-background">
                <Link to="/auth">Entrar</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* HERO com watermark da logo oficial */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-24">
        <div className="absolute inset-0 bg-gradient-to-b from-surface-1 via-background to-background" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, var(--gold) 0%, transparent 40%), radial-gradient(circle at 80% 70%, var(--gold) 0%, transparent 40%)",
          }}
        />
        <GoldWatermark />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-12 flex justify-center md:mb-14">
            <LogoMark size={320} />
          </div>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-surface-1/60 px-4 py-1.5 text-xs font-medium tracking-[0.25em] text-gold backdrop-blur">
            <Sparkles className="h-3 w-3" />
            EXPERIÊNCIA PREMIUM
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
            {data.hero_highlight_word ? (
              data.hero_title.split(new RegExp(`(\\b${data.hero_highlight_word}\\b)`, 'gi')).map((part: string, i: number) => 
                part.toLowerCase() === data.hero_highlight_word.toLowerCase() ? (
                  <span key={i} className="italic text-gradient-gold">{part}</span>
                ) : (
                  part
                )
              )
            ) : (
              data.hero_title
            )}
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {data.hero_subtitle}
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-gold px-8 text-sm font-semibold tracking-wider text-background hover:bg-gold-soft"
            >
              <Link to="/agendar">{data.hero_button_text}</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 px-8 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <a href="#portfolio">Ver portfólio →</a>
            </Button>
          </div>
        </div>
      </section>

      {/* SERVIÇOS */}
      <section id="servicos" className="border-t border-border/40 bg-surface-1/50 py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-4 text-xs font-medium tracking-[0.3em] text-gold">SERVIÇOS</p>
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              {data.services_highlight_word ? (
                data.services_title.split(new RegExp(`(\\b${data.services_highlight_word}\\b)`, 'gi')).map((part: string, i: number) => 
                  part.toLowerCase() === data.services_highlight_word.toLowerCase() ? (
                    <span key={i} className="italic text-gradient-gold">{part}</span>
                  ) : (
                    part
                  )
                )
              ) : (
                data.services_title
              )}
            </h2>
            <div className="editorial-rule mx-auto mt-6 w-24" />
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {services?.map((s: any, i: number) => {
              const ServiceIcon = [Scissors, Award, Sparkles][i % 3] || Scissors;

              return (
              <div
                key={s.id}
                className="group relative overflow-hidden rounded-xl border-2 border-yellow-500/50 bg-black/40 p-8 backdrop-blur-sm transition-all duration-300 shadow-[0_0_10px_rgba(234,179,8,0.15)] before:absolute before:inset-0 before:rounded-xl before:border before:border-yellow-500/20 before:opacity-50"
              >
                <div className="relative z-10">
                  <ServiceIcon className="mb-6 h-8 w-8 text-gold" />
                  <h3 className="font-display text-xl font-semibold">{s.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                  <p className="mt-1 text-[10px] tracking-widest text-muted-foreground/60">{s.duration_minutes} MINUTOS</p>
                  <div className="mt-6 flex items-baseline justify-between border-t border-border/40 pt-4">
                    <span className="text-xs font-medium tracking-widest text-muted-foreground">VALOR</span>
                    <span className="font-display text-2xl font-bold text-gold">R$ {(s.price_cents / 100).toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          <div className="mt-16 flex justify-center">
            <Button
              asChild
              size="lg"
              className="h-14 bg-gold px-12 text-sm font-bold tracking-[0.2em] text-background hover:bg-gold-soft"
            >
              <Link to="/agendar">AGENDAR AGORA</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* PORTFÓLIO REAL */}
      <section id="portfolio" className="relative border-t border-border/40 py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-4 text-xs font-medium tracking-[0.3em] text-gold">PORTFÓLIO</p>
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              {data.portfolio_title}
            </h2>
            <div className="editorial-rule mx-auto mt-6 w-24" />
            <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground">
              {data.portfolio_description}
            </p>
          </div>
          {portfolio.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {portfolio.map((item: any) => (
                <div 
                  key={item.id} 
                  className="group relative overflow-hidden rounded-xl border-2 border-yellow-500/50 transition-all duration-300 hover:border-yellow-500 hover:shadow-[0_0_20px_rgba(234,179,8,0.25)] cursor-pointer"
                  onClick={() => setSelectedImage(item)}
                >
                  <img
                    src={item.image_url}
                    alt={item.title || ""}
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* overlay leve */}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all duration-300" />
                  
                  {/* título */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[16px] font-medium text-white tracking-wide">
                      {item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-sm tracking-widest text-muted-foreground uppercase">Sem imagens disponíveis</p>
            </div>
          )}
          
          <div className="mt-12 flex items-center justify-center gap-3 text-yellow-500/90 hover:text-yellow-400 transition-all duration-300">
            <Instagram className="w-7 h-7" />
            <span className="text-[16px] tracking-wide">
              {data.instagram ? `@${data.instagram}` : "@barbeiro_leomoraes"}
            </span>
          </div>
        </div>
      </section>

      {/* PERFIL DO BARBEIRO */}
      <section id="sobre" className="border-t border-border/40 bg-surface-1/50 py-28 px-6">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-center md:gap-20">
          {/* Foto compacta editorial */}
          <div className="mx-auto w-full max-w-[340px]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-gold/25 bg-surface-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              {data.barber_image_url ? (
                <img
                  src={data.barber_image_url}
                  alt={data.about_barber_name}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : data.barber_photo_url ? (
                <img
                  src={data.barber_photo_url}
                  alt={data.about_barber_name}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <img
                  src="/placeholder-barber.png"
                  alt={data.about_barber_name}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Se o placeholder falhar, mostra a logo
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center');
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[10px] font-medium tracking-[0.3em] text-gold">
                  {data.barber_title}
                </p>
                <p className="mt-1.5 font-display text-xl font-bold leading-tight">
                  {data.about_barber_name}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-3 w-3 ${i < Math.floor(data.rating || 5) ? 'fill-gold text-gold' : 'text-muted-foreground'}`} />
                  ))}
                  <span className="ml-1.5 text-[10px] tracking-wider text-muted-foreground">
                    {data.rating || "5.0"} · +{data.clients_count || "200"} avaliações
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Texto + métricas */}
          <div>
            <p className="mb-4 text-xs font-medium tracking-[0.3em] text-gold">
              SOBRE O PROFISSIONAL
            </p>
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              {data.about_title}
            </h2>
            <div className="editorial-rule mt-6 w-16" />
            <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
              {data.about_description}
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 border-l border-gold/40 bg-surface-2/40 px-4 py-3">
                <Award className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <div>
                  <p className="font-display text-[13px] font-semibold tracking-wide">
                    Especialidades
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {data.specialties}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 border-l border-gold/40 bg-surface-2/40 px-4 py-3">
                <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <div>
                  <p className="font-display text-[13px] font-semibold tracking-wide">
                    Experiência
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    +{data.years_experience} anos · reputação por indicação
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border/40 pt-8">
              {[
                { n: `+${data.years_experience || "10"}`, l: "anos de experiência" },
                { n: `${data.rating || "5"}★`, l: "avaliação média" },
                { n: `${data.clients_count || "1k"}+`, l: "clientes fiéis" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display text-3xl font-bold text-gold">{s.n}</div>
                  <div className="mt-1 text-[11px] tracking-wide text-muted-foreground">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTATO */}
      <section id="contato" className="border-t border-border/40 py-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 text-xs font-medium tracking-[0.3em] text-gold">VISITE</p>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            {data.cta_title}
          </h2>
          <p className="mt-4 text-muted-foreground">{data.cta_subtitle}</p>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center gap-3">
              <MapPin className="h-6 w-6 text-gold" />
              <p className="text-sm text-muted-foreground">{data.address}</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Clock className="h-6 w-6 text-gold" />
              <p className="text-sm text-muted-foreground whitespace-pre-line">{data.opening_hours || "Horário não informado"}</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Phone className="h-6 w-6 text-gold" />
              <a href={data?.whatsapp ? `https://wa.me/55${data.whatsapp.replace(/\D/g, "")}` : whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-gold transition">
                {data?.phone || (data?.whatsapp ? formatPhone(data.whatsapp) : "(11) 99999-9999")}
              </a>
            </div>
          </div>
          <Button
            asChild
            size="lg"
            className="mt-12 h-12 bg-gold px-12 text-sm font-semibold tracking-wider text-background hover:bg-gold-soft"
          >
            <Link to="/agendar">{data.cta_button_text || data.hero_button_text}</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/40 py-12 px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <Logo size={72} />
          <p className="text-xs tracking-wider text-muted-foreground">
            © {new Date().getFullYear()} {data.footer_text} · Todos os direitos reservados
          </p>
        </div>
      </footer>
      {/* MODAL DE IMAGEM */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage.image_url}
              alt={selectedImage.title}
              className="w-full max-h-[80vh] object-contain rounded-lg border border-gold/20 shadow-2xl"
            />
            <p className="mt-4 text-center text-white text-lg font-medium tracking-wide">
              {selectedImage.title}
            </p>
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors text-sm tracking-widest uppercase font-medium"
            >
              FECHAR [X]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
