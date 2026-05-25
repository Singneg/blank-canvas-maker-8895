import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gold">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LÉO MORAES BARBER — Experiência Premium em Barbearia" },
      {
        name: "description",
        content:
          "Barbearia premium LÉO MORAES BARBER. Cortes de assinatura, barba, tratamentos e atendimento exclusivo. Agende online.",
      },
      { name: "theme-color", content: "#0A0A0A" },
      { property: "og:title", content: "LÉO MORAES BARBER — Experiência Premium em Barbearia" },
      { property: "og:description", content: "Léo Moraes Barber Suite is a premium SaaS application for barbershops, managing appointments, clients, and finances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "LÉO MORAES BARBER — Experiência Premium em Barbearia" },
      { name: "description", content: "Léo Moraes Barber Suite is a premium SaaS application for barbershops, managing appointments, clients, and finances." },
      { name: "twitter:description", content: "Léo Moraes Barber Suite is a premium SaaS application for barbershops, managing appointments, clients, and finances." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e944fd5b-6cea-41a9-aa85-153cf9336fe8/id-preview-2d2d9203--3b757fdc-8254-4968-b7ab-0fe18188fd72.lovable.app-1777221304400.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e944fd5b-6cea-41a9-aa85-153cf9336fe8/id-preview-2d2d9203--3b757fdc-8254-4968-b7ab-0fe18188fd72.lovable.app-1777221304400.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          // Aplica tema salvo antes da hidratação para evitar flash.
          // Dark é o padrão (:root). Light é ativado isoladamente via .light.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lmb-theme');var isLight=t==='light';var r=document.documentElement;r.classList.toggle('light',isLight);r.classList.toggle('dark',!isLight);r.style.colorScheme=isLight?'light':'dark';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
