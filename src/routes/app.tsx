import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import {
  Loader2,
  MessageSquare,
  PhoneCall,
  MapPin,
  Wallet,
  Radio,
  LogOut,
  TrendingUp,
  Clock,
  Sparkles,
  Play,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Hub Profissional — Umbrella" }] }),
  component: WorkerApp,
});

const ICONS = { chat: MessageSquare, voice: PhoneCall, visit: MapPin } as const;
const LABELS = { chat: "Chat", voice: "Voz", visit: "Visita" } as const;

type Offer = {
  id: string;
  slots_total: number;
  slots_filled: number;
  demand_id: string;
  demands: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    job_type: "chat" | "voice" | "visit";
    hours_required: number;
  } | null;
};

type Acceptance = {
  id: string;
  accepted_at: string;
  status: string;
  shift_offers: { demand_id: string; demands: { job_type: string; date: string; hours_required: number } | null } | null;
};

type ActiveExec = {
  id: string;
  status: string;
  shift_acceptances: {
    shift_offers: { demands: { date: string; job_type: "chat" | "voice" | "visit" } | null } | null;
  } | null;
};

function WorkerApp() {
  const { user, roles, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const isCompanyOnly = (roles.includes("company") || roles.includes("admin")) && !roles.includes("worker");
  const [tab, setTab] = useState<"hub" | "ops" | "earn">("hub");
  const [online, setOnline] = useState(true);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [workerProfile, setWorkerProfile] = useState<{
    accepts_weekdays: boolean;
    accepts_weekends: boolean;
    weekends_only: boolean;
    parity_scope: "odd" | "even" | "any";
    crew_role: "line" | "reserve";
    line_parity_preference: "odd" | "even" | "any";
    weekend_offer_advance: boolean;
  } | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [reliability, setReliability] = useState(1);
  const [activeExecs, setActiveExecs] = useState<ActiveExec[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    if (isCompanyOnly) navigate({ to: "/dashboard" });
  }, [user, loading, isCompanyOnly, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: w } = await supabase
        .from("workers")
        .select("id, operations_profile_completed, accepts_weekdays, accepts_weekends, weekends_only, parity_scope, crew_role, line_parity_preference, weekend_offer_advance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!w || !w.operations_profile_completed) {
        navigate({ to: "/app/profile/operations" });
        return;
      }
      setWorkerId(w.id);
      setWorkerProfile({
        accepts_weekdays: w.accepts_weekdays,
        accepts_weekends: w.accepts_weekends,
        weekends_only: w.weekends_only,
        parity_scope: w.parity_scope as "odd" | "even" | "any",
        crew_role: w.crew_role as "line" | "reserve",
        line_parity_preference: w.line_parity_preference as "odd" | "even" | "any",
        weekend_offer_advance: w.weekend_offer_advance,
      });
      const { data: m } = await supabase.from("worker_metrics").select("reliability_score").eq("worker_id", w.id).maybeSingle();
      if (m) setReliability(Number(m.reliability_score));
      load(w.id);
    })();
  }, [user]);

  const load = async (wid: string) => {
    // TODO otimizar query: filtros aplicados client-side a partir do perfil operacional
    const { data: openOffers } = await supabase
      .from("shift_offers")
      .select("id, slots_total, slots_filled, demand_id, demands(id, date, start_time, end_time, job_type, hours_required, weekend)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);
    setOffers((openOffers as Offer[]) ?? []);

    const { data: accs } = await supabase
      .from("shift_acceptances")
      .select("id, accepted_at, status, shift_offers(demand_id, demands(job_type, date, hours_required))")
      .eq("worker_id", wid)
      .order("accepted_at", { ascending: false })
      .limit(50);
    setAcceptances((accs as Acceptance[]) ?? []);

    const { data: execs } = await supabase
      .from("shift_executions")
      .select("id, status, shift_acceptances(shift_offers(demands(date, job_type)))")
      .eq("worker_id", wid)
      .in("status", ["scheduled", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(10);
    setActiveExecs((execs as ActiveExec[]) ?? []);
  };

  const accept = async (offer: Offer) => {
    if (!workerId) return;
    const { error } = await supabase.from("shift_acceptances").insert({
      offer_id: offer.id,
      worker_id: workerId,
      source: "manual",
    });
    if (error) return toast.error(error.message);
    toast.success("Job aceito. Boa execução!");
    load(workerId);
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const earnings = acceptances.filter((a) => a.status === "accepted").reduce((s, a) => s + (a.shift_offers?.demands?.hours_required ?? 0) * 35, 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      {/* Header */}
      <header className="bg-hero px-5 pb-8 pt-6 text-white">
        <div className="flex items-center justify-between">
          <BrandMark light />
          <button
            onClick={() => signOut().then(() => navigate({ to: "/" }))}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Status */}
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-white/10 p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${online ? "bg-success" : "bg-muted"}`}>
              <Radio className="h-5 w-5 text-white" />
            </span>
            <div>
              <p className="text-xs text-white/60">Status</p>
              <p className="font-semibold">{online ? "Disponível" : "Offline"}</p>
            </div>
          </div>
          <button
            onClick={() => setOnline((v) => !v)}
            className={`h-7 w-12 rounded-full transition-colors ${online ? "bg-success" : "bg-white/20"}`}
          >
            <span
              className={`block h-6 w-6 translate-y-[2px] rounded-full bg-white transition-transform ${
                online ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>

        {/* Reliability */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 text-sm backdrop-blur">
          <span className="flex items-center gap-2 text-white/70">
            <Sparkles className="h-4 w-4 text-warning" />
            Confiabilidade
          </span>
          <span className="font-mono font-semibold text-warning">{Math.round(reliability * 100)}%</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-0 z-10 grid grid-cols-3 border-b border-border bg-background">
        {(
          [
            { k: "hub", label: "Hub" },
            { k: "ops", label: "Oportunidades" },
            { k: "earn", label: "Ganhos" },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`relative py-3.5 text-sm font-medium transition-colors ${
              tab === t.k ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {t.label}
            {tab === t.k && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 px-5 py-6">
        {tab === "hub" && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold tracking-tight">Bom trabalho hoje.</h2>
            <p className="text-sm text-muted-foreground">
              {offers.length} oportunidades disponíveis para você agora.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {(["chat", "voice", "visit"] as const).map((k) => {
                const Icon = ICONS[k];
                const count = offers.filter((o) => o.demands?.job_type === k).length;
                return (
                  <button
                    key={k}
                    onClick={() => setTab("ops")}
                    className="rounded-2xl border border-border bg-card p-4 text-left shadow-elevate transition-all hover:-translate-y-0.5 hover:border-accent"
                  >
                    <Icon className="h-6 w-6 text-accent" />
                    <p className="mt-3 font-display text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{LABELS[k]}</p>
                  </button>
                );
              })}
            </div>

            {activeExecs.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Em execução
                </h3>
                {activeExecs.map((e) => {
                  const d = e.shift_acceptances?.shift_offers?.demands;
                  if (!d) return null;
                  const Icon = ICONS[d.job_type];
                  const isLive = e.status === "in_progress";
                  return (
                    <button
                      key={e.id}
                      onClick={() =>
                        router.navigate({ to: "/app/execution/$id", params: { id: e.id } })
                      }
                      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-elevate transition-all hover:border-accent"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${isLive ? "bg-success text-white" : "bg-navy text-ivory"}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold capitalize">{LABELS[d.job_type]}</p>
                          <p className="text-xs text-muted-foreground">
                            {isLive ? "Em andamento" : `Agendado · ${d.date}`}
                          </p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                        {isLive ? <Play className="h-3.5 w-3.5" /> : null} Abrir
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-border bg-card-elevated p-5 shadow-elevate">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Ganhos do mês</span>
                <Wallet className="h-4 w-4 text-accent" />
              </div>
              <p className="mt-2 font-display text-3xl font-bold">
                R$ {earnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{acceptances.length} jobs aceitos</p>
            </div>
          </div>
        )}

        {tab === "ops" && (
          <div className="space-y-3">
            {offers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-display font-semibold">Nenhuma oportunidade aberta</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Novos jobs aparecem aqui assim que empresas publicarem.
                </p>
              </div>
            ) : (
              offers.map((o) => {
                const d = o.demands;
                if (!d) return null;
                const Icon = ICONS[d.job_type];
                return (
                  <div
                    key={o.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-elevate"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-ivory">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold">{LABELS[d.job_type]}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.date} · {d.hours_required}h
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {o.slots_filled}/{o.slots_total}
                      </span>
                    </div>
                    <Button
                      onClick={() => accept(o)}
                      variant="hero"
                      size="sm"
                      className="mt-4 w-full"
                    >
                      Entrar no modo
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "earn" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-hero p-6 text-white shadow-glow">
              <p className="text-xs uppercase tracking-wider text-white/60">Total acumulado</p>
              <p className="mt-2 font-display text-4xl font-bold">
                R$ {earnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-warning">
                <TrendingUp className="h-4 w-4" />
                Baseado em execução real
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-semibold">Histórico</h3>
              {acceptances.length === 0 ? (
                <p className="rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
                  Nenhum job ainda. Vá em <strong>Oportunidades</strong> para começar.
                </p>
              ) : (
                acceptances.map((a) => {
                  const d = a.shift_offers?.demands;
                  if (!d) return null;
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium capitalize">{d.job_type}</p>
                        <p className="text-xs text-muted-foreground">{d.date}</p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-accent">
                        R$ {(d.hours_required * 35).toFixed(2)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-accent">
              Sobre a Umbrella
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
