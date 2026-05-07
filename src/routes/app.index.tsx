import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/app/")({
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
    weekend: boolean;
    patients: { full_name: string } | null;
    contract_services: {
      contracts: {
        name: string;
        clients: { name: string } | null;
      } | null;
    } | null;
  } | null;
};

type Acceptance = {
  id: string;
  accepted_at: string;
  status: string;
  shift_executions: Array<{
    status: string;
    hours_worked: number | null;
    applied_hours: number | null;
    applied_rate_per_hour: number | null;
    applied_amount: number | null;
  }> | null;
  shift_offers: {
    demand_id: string;
    demands: {
      job_type: string;
      date: string;
      hours_required: number;
      contract_services: {
        price_per_hour: number;
        contracts: { name: string; clients: { name: string } | null } | null;
      } | null;
    } | null;
  } | null;
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
  const [confirmOffer, setConfirmOffer] = useState<Offer | null>(null);
  const [accepting, setAccepting] = useState(false);

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
      .select("id, slots_total, slots_filled, demand_id, demands(id, date, start_time, end_time, job_type, hours_required, weekend, patients(full_name), contract_services(contracts(name, clients(name))))")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: accs } = await supabase
      .from("shift_acceptances")
      .select("id, offer_id, accepted_at, status, shift_executions(status, hours_worked, applied_hours, applied_rate_per_hour, applied_amount), shift_offers(demand_id, demands(job_type, date, hours_required, contract_services(price_per_hour, contracts(name, clients(name)))))")
      .eq("worker_id", wid)
      .order("accepted_at", { ascending: false })
      .limit(50);
    const acceptanceList = (accs as (Acceptance & { offer_id: string })[]) ?? [];
    setAcceptances(acceptanceList);

    const acceptedOfferIds = new Set(acceptanceList.filter((a) => a.status === "accepted").map((a) => a.offer_id));
    const acceptedDemandIds = new Set(
      acceptanceList.filter((a) => a.status === "accepted").map((a) => a.shift_offers?.demand_id).filter(Boolean) as string[],
    );
    const filtered = ((openOffers as Offer[]) ?? []).filter(
      (o) => !acceptedOfferIds.has(o.id) && !acceptedDemandIds.has(o.demand_id),
    );
    setOffers(filtered);

    const { data: execs } = await supabase
      .from("shift_executions")
      .select("id, status, shift_acceptances(shift_offers(demands(date, job_type)))")
      .eq("worker_id", wid)
      .in("status", ["scheduled", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(10);
    setActiveExecs((execs as ActiveExec[]) ?? []);
  };

  const confirmAcceptance = async () => {
    if (!workerId || !confirmOffer) return;
    setAccepting(true);
    const { error } = await supabase.from("shift_acceptances").insert({
      offer_id: confirmOffer.id,
      worker_id: workerId,
      source: "manual",
    });
    setAccepting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Promessa de atendimento confirmada.");
    setConfirmOffer(null);
    load(workerId);
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Snapshot-first: usa applied_* da execução completed quando disponível.
  // Fallback (legado): hours_required × price_per_hour atual do contrato.
  const breakdownFor = (a: Acceptance) => {
    const exec = a.shift_executions?.find((e) => e.status === "completed");
    const d = a.shift_offers?.demands;
    const contractRate = Number(d?.contract_services?.price_per_hour ?? 0);
    if (exec && exec.applied_amount != null) {
      return {
        hours: Number(exec.applied_hours ?? exec.hours_worked ?? 0),
        rate: Number(exec.applied_rate_per_hour ?? contractRate),
        total: Number(exec.applied_amount),
        legacy: false,
      };
    }
    const hours = Number(d?.hours_required ?? 0);
    return { hours, rate: contractRate, total: hours * contractRate, legacy: true };
  };
  // Acumulado real: só conta execuções concluídas (com applied_amount).
  const earnings = acceptances
    .filter((a) => a.status === "accepted")
    .reduce((s, a) => {
      const exec = a.shift_executions?.find((e) => e.status === "completed");
      return s + Number(exec?.applied_amount ?? 0);
    }, 0);

  // Filtros derivados do perfil operacional (TODO: otimizar como query Supabase).
  const filteredOffers = offers.filter((o) => {
    const d = o.demands;
    if (!d || !workerProfile) return false;
    const wp = workerProfile;
    if (d.weekend && !wp.accepts_weekends) return false;
    if (!d.weekend && (!wp.accepts_weekdays || wp.weekends_only)) return false;
    const day = new Date(d.date + "T00:00:00").getDate();
    const dayParity: "odd" | "even" = day % 2 === 1 ? "odd" : "even";
    if (wp.parity_scope !== "any" && wp.parity_scope !== dayParity) return false;
    if (wp.crew_role === "line" && wp.line_parity_preference !== "any" && wp.line_parity_preference !== dayParity) return false;
    return true;
  });
  if (workerProfile?.crew_role === "reserve" && workerProfile.weekend_offer_advance) {
    filteredOffers.sort((a, b) => Number(b.demands?.weekend ?? 0) - Number(a.demands?.weekend ?? 0));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      {/* Header */}
      <header className="bg-hero px-5 pb-8 pt-6 text-white">
        <div className="flex items-center justify-between">
          <BrandMark light />
          <div className="flex items-center gap-1">
            <Link
              to="/app/memberships"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white"
            >
              Vínculos
            </Link>
            <Link
              to="/app/profile/operations"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white"
            >
              Perfil
            </Link>
            <button
              onClick={() => signOut().then(() => navigate({ to: "/" }))}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
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
              {filteredOffers.length} oportunidades disponíveis para você agora.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {(["chat", "voice", "visit"] as const).map((k) => {
                const Icon = ICONS[k];
                const count = filteredOffers.filter((o) => o.demands?.job_type === k).length;
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
            {filteredOffers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-display font-semibold">Nenhuma oportunidade aberta</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Novos jobs aparecem aqui assim que empresas publicarem.
                </p>
              </div>
            ) : (
              filteredOffers.map((o) => {
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
                      onClick={() => setConfirmOffer(o)}
                      variant="hero"
                      size="sm"
                      className="mt-4 w-full"
                    >
                      Aceitar plantão
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
                  const b = breakdownFor(a);
                  const tooltip = `${b.hours}h × R$ ${b.rate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/h = R$ ${b.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${b.legacy ? " (estimado · legado)" : ""}`;
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm"
                      title={tooltip}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="truncate text-sm font-medium">
                          {d.contract_services?.contracts?.clients?.name ?? "Cliente"}
                          {d.contract_services?.contracts?.name ? ` · ${d.contract_services.contracts.name}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {d.job_type} · {d.date} · {b.hours}h × R$ {b.rate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/h
                          {b.legacy ? " · estimado" : ""}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-accent">
                        R$ {b.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
