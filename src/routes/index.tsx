import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import {
  ArrowRight,
  MessageSquare,
  PhoneCall,
  MapPin,
  ShieldCheck,
  Activity,
  Gauge,
  Layers,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Umbrella — Hub de Trabalho sob Demanda" },
      {
        name: "description",
        content:
          "Marketplace operacional que conecta empresas e profissionais para chat, voz e visitas. Faturamento por execução real.",
      },
      { property: "og:title", content: "Umbrella — Hub de Trabalho sob Demanda" },
      {
        property: "og:description",
        content: "Distribua jobs, controle execução e fature pelo que foi entregue.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <BrandMark light />
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/70 md:flex">
            <a href="#como-funciona" className="hover:text-white">Como funciona</a>
            <a href="#produto" className="hover:text-white">Produto</a>
            <a href="#planos" className="hover:text-white">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="outlineLight" size="sm">Entrar</Button>
            </Link>
            <Link to="/signup">
              <Button variant="hero" size="sm">
                Começar <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-white">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-x-0 top-0 h-[600px] bg-glow" />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-40 md:pt-48 md:pb-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              Plataforma operacional · marketplace interno
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-balance md:text-7xl">
              O hub de trabalho que entrega <span className="text-warning">execução real</span>, não promessas.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/70 md:text-xl">
              Umbrella distribui jobs de chat, voz e visitas técnicas para uma rede de profissionais qualificados.
              Você acompanha promessa, execução e qualidade — e fatura pelo que foi efetivamente realizado.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/signup" search={{ role: "company" }}>
                <Button variant="hero" size="xl">
                  Sou empresa <ArrowRight />
                </Button>
              </Link>
              <Link to="/signup" search={{ role: "worker" }}>
                <Button variant="outlineLight" size="xl">
                  Sou profissional
                </Button>
              </Link>
            </div>

            <dl className="mt-16 grid grid-cols-3 gap-6 border-t border-white/10 pt-10 md:max-w-xl">
              {[
                { k: "98%", v: "plantões cobertos" },
                { k: "2.4×", v: "ganho de escala" },
                { k: "0%", v: "faturamento sem prova" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="font-display text-3xl font-bold text-warning">{s.k}</dt>
                  <dd className="mt-1 text-xs uppercase tracking-wider text-white/60">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Job Types */}
      <section id="produto" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Tipos de Job
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Um único motor para execução remota e presencial.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: MessageSquare,
              title: "Chat",
              desc: "SAC, suporte e vendas em tempo real. Fila inteligente, respostas rápidas, encerramento com resultado.",
              tag: "Remoto",
            },
            {
              icon: PhoneCall,
              title: "Voz",
              desc: "Televendas e atendimento por ligação. Timer, notas durante a chamada e classificação na finalização.",
              tag: "Remoto",
            },
            {
              icon: MapPin,
              title: "Visita",
              desc: "Instalações, manutenções e visitas técnicas. Check-in com GPS, prova de execução e relato.",
              tag: "Presencial",
            },
          ].map((j) => (
            <div
              key={j.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card-elevated p-7 shadow-elevate transition-all hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-deep text-ivory">
                  <j.icon className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {j.tag}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground">{j.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{j.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="bg-secondary/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 max-w-2xl">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Como funciona
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Da demanda ao faturamento — auditável em cada etapa.
            </h2>
          </div>

          <ol className="grid gap-px overflow-hidden rounded-2xl bg-border md:grid-cols-5">
            {[
              { n: "01", t: "Empresa publica", d: "Contrato vira demanda." },
              { n: "02", t: "Plataforma distribui", d: "Match por confiabilidade." },
              { n: "03", t: "Profissional aceita", d: "Promessa registrada." },
              { n: "04", t: "Executa com prova", d: "GPS, foto ou sistema." },
              { n: "05", t: "Faturamento", d: "Baseado em execução real." },
            ].map((s) => (
              <li key={s.n} className="bg-background p-7">
                <div className="font-display text-3xl font-bold text-accent">{s.n}</div>
                <h3 className="mt-3 font-display font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Por que Umbrella
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Separação absoluta entre <span className="text-accent">aceite</span> e <span className="text-accent">execução</span>.
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              A maioria dos sistemas confunde promessa com entrega. O Umbrella não. Cada job tem demanda, oferta,
              aceite e execução em entidades separadas — auditáveis, versionadas e impossíveis de confundir.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Faturamento só sobre o que foi efetivamente executado",
                "Reputação calculada por execução / aceite",
                "Distribuição priorizada por confiabilidade",
                "Histórico completo de cada plantão",
              ].map((i) => (
                <li key={i} className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, t: "Confiabilidade", d: "Score por execução real, não por avaliação subjetiva." },
              { icon: Activity, t: "Tempo real", d: "Plantões, chats e visitas em um único painel operacional." },
              { icon: Gauge, t: "Escala sem caos", d: "Geração automática de plantões a partir do contrato." },
              { icon: Layers, t: "Marketplace interno", d: "Profissionais escolhem modo: chat, voz ou visita." },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-xl border border-border bg-card p-5 shadow-elevate"
              >
                <c.icon className="h-6 w-6 text-accent" />
                <h4 className="mt-4 font-display font-semibold">{c.t}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="bg-secondary/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Planos com créditos
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Contrate por carga horária diária.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              { h: "4h/dia", p: "Operação enxuta", popular: false },
              { h: "12h/dia", p: "Operação estendida", popular: true },
              { h: "24h/dia", p: "Operação 24×7", popular: false },
            ].map((pl) => (
              <div
                key={pl.h}
                className={`relative rounded-2xl border p-8 ${
                  pl.popular
                    ? "border-accent bg-card shadow-glow"
                    : "border-border bg-card shadow-elevate"
                }`}
              >
                {pl.popular && (
                  <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                    Mais escolhido
                  </span>
                )}
                <h3 className="font-display text-3xl font-bold">{pl.h}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{pl.p}</p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {["1, 3 ou 6 meses", "Distribuição automática", "Regras de plantão (par/ímpar, fds)", "Faturamento por execução"].map(
                    (b) => (
                      <li key={b} className="flex items-center gap-2 text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-accent" /> {b}
                      </li>
                    ),
                  )}
                </ul>
                <Link to="/signup" search={{ role: "company" }} className="mt-7 block">
                  <Button className="w-full" variant={pl.popular ? "hero" : "outline"} size="lg">
                    Falar com vendas
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="overflow-hidden rounded-3xl bg-hero p-12 text-white shadow-glow md:p-16">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <TrendingUp className="h-10 w-10 text-warning" />
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight md:text-4xl">
                Escale operação sem aumentar a equipe de gestão.
              </h2>
              <p className="mt-3 text-white/70">
                Em minutos você publica seu primeiro contrato e o motor cuida do resto.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/signup" search={{ role: "company" }}>
                <Button variant="hero" size="xl">Começar como empresa</Button>
              </Link>
              <Link to="/signup" search={{ role: "worker" }}>
                <Button variant="outlineLight" size="xl">Sou profissional</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center">
          <BrandMark />
          <p>© {new Date().getFullYear()} Umbrella · Hub de trabalho sob demanda</p>
        </div>
      </footer>
    </div>
  );
}
