import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-muted-foreground">Umbrella</p>
        <h1 className="mt-4 font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-2 text-xl font-semibold text-foreground">Rota não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O job que você procura foi finalizado, cancelado ou nunca foi publicado.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Umbrella — Hub de Trabalho sob Demanda" },
      {
        name: "description",
        content:
          "Umbrella conecta empresas e profissionais em um marketplace operacional: chat, voz e visitas técnicas com execução controlada.",
      },
      { name: "author", content: "Umbrella" },
      { property: "og:title", content: "Umbrella — Hub de Trabalho sob Demanda" },
      {
        property: "og:description",
        content:
          "Distribua jobs, acompanhe execução em tempo real e fature pelo que foi realmente entregue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Umbrella — Hub de Trabalho sob Demanda" },
      { name: "description", content: "Job Nexus Hub is a job marketplace connecting companies with professionals for on-demand remote and in-person work." },
      { property: "og:description", content: "Job Nexus Hub is a job marketplace connecting companies with professionals for on-demand remote and in-person work." },
      { name: "twitter:description", content: "Job Nexus Hub is a job marketplace connecting companies with professionals for on-demand remote and in-person work." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1837b239-8901-4438-94c5-47c183f3fc36/id-preview-48fb7b2c--71bc4200-c8ea-419c-94e7-eb72d7bb3238.lovable.app-1777907359848.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1837b239-8901-4438-94c5-47c183f3fc36/id-preview-48fb7b2c--71bc4200-c8ea-419c-94e7-eb72d7bb3238.lovable.app-1777907359848.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
