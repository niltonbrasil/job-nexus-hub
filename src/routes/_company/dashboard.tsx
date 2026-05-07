import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  TrendingUp,
  ShieldCheck,
  CalendarCheck,
  AlertTriangle,
  Activity,
  Users,
  Receipt,
  Calendar,
  ArrowRight,
  CircleDot,
} from "lucide-react";

export const Route = createFileRoute("/_company/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Umbrella" }] }),
  component: Dashboard,
});

type Stats = {
  contracts: number;
  todayTotal: number;
  todayFilled: number;
  todayPartial: number;
  todayUncovered: number;
  reliabilityAvg: number;
  monthBilling: number;
};

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    contracts: 0,
    todayTotal: 0,
    todayFilled: 0,
    todayPartial: 0,
    todayUncovered: 0,
    reliabilityAvg: 1,
    monthBilling: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const { data: clients } = await supabase.from("clients").select("id");
      const clientIds = (clients ?? []).map((c) => c.id);
      if (!clientIds.length) {
        setLoading(false);
        return;
      }

      const { data: contractsData, count: contracts } = await supabase
        .from("contracts")
        .select("id", { count: "exact" })
        .in("client_id", clientIds)
        .eq("status", "active");
      const contractIds = (contractsData ?? []).map((c) => c.id);

      let todayTotal = 0,
        todayFilled = 0,
        todayPartial = 0,
        todayUncovered = 0,
        monthBilling = 0;

      if (contractIds.length) {
        const { data: services } = await supabase
          .from("contract_services")
          .select("id")
          .in("contract_id", contractIds);
        const sIds = (services ?? []).map((s) => s.id);

        if (sIds.length) {
          const { data: todayDemands } = await supabase
            .from("demands")
            .select("status")
            .in("contract_service_id", sIds)
            .eq("date", today);

          (todayDemands ?? []).forEach((d) => {
            todayTotal++;
            if (d.status === "filled") todayFilled++;
            else if (d.status === "partially_filled") todayPartial++;
            else todayUncovered++;
          });
        }

        const { data: bills } = await supabase
          .from("billings")
          .select("total_amount, period_start")
          .in("contract_id", contractIds)
          .gte("period_start", monthStartStr);
        monthBilling = (bills ?? []).reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
      }

      const { data: metrics } = await supabase
        .from("worker_metrics")
        .select("reliability_score");
      const reliabilityAvg =
        metrics && metrics.length
          ? metrics.reduce((s, m) => s + Number(m.reliability_score), 0) / metrics.length
          : 1;

      setStats({
        contracts: contracts ?? 0,
        todayTotal,
        todayFilled,
        todayPartial,
        todayUncovered,
        reliabilityAvg,
        monthBilling,
      });
      setLoading(false);
    })();
  }, [user]);

  const cards = [
    { icon: CalendarCheck, label: "Plantões hoje", value: stats.todayTotal, tone: "text-accent" },
    { icon: ShieldCheck, label: "Preenchidos", value: stats.todayFilled, tone: "text-success" },
    { icon: AlertTriangle, label: "Em risco (parcial)", value: stats.todayPartial, tone: "text-warning" },
    { icon: CircleDot, label: "Descobertos", value: stats.todayUncovered, tone: "text-destructive" },
    {
      icon: TrendingUp,
      label: "Confiabilidade média",
      value: `${Math.round(stats.reliabilityAvg * 100)}%`,
      tone: "text-accent",
    },
    {
      icon: Activity,
      label: "Faturamento do mês",
      value: `R$ ${stats.monthBilling.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      tone: "text-accent",
    },
  ];

  const quickActions = [
    { to: "/schedule", label: "Ver agenda", icon: Calendar },
    { to: "/professionals", label: "Ver profissionais", icon: Users },
    { to: "/billing", label: "Ver faturamento", icon: Receipt },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Visão geral
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Operação em tempo real · {stats.contracts} contrato(s) ativo(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent"
            >
              <a.icon className="h-4 w-4" />
              {a.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card-elevated p-6 shadow-elevate"
          >
            <c.icon className={`h-6 w-6 ${c.tone}`} />
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-2 font-display text-3xl font-bold">{loading ? "—" : c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-elevate lg:col-span-2">
          <h3 className="font-display text-lg font-semibold">Cobertura de hoje</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Distribuição de status dos plantões agendados para hoje.
          </p>
          <div className="mt-6 space-y-4">
            {[
              { label: "Preenchidos", v: stats.todayFilled, color: "bg-success" },
              { label: "Parciais", v: stats.todayPartial, color: "bg-warning" },
              { label: "Descobertos", v: stats.todayUncovered, color: "bg-destructive" },
            ].map((row) => {
              const pct = stats.todayTotal ? (row.v / stats.todayTotal) * 100 : 0;
              return (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground">{row.v}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full ${row.color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {stats.todayTotal === 0 && (
              <p className="rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">
                Nenhum plantão para hoje. Gere a agenda em <strong>Agenda</strong>.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-6">
          <AlertTriangle className="h-6 w-6 text-warning-foreground" />
          <h3 className="mt-3 font-display font-semibold">Próximos passos</h3>
          <ol className="mt-3 space-y-2 text-sm">
            <li>1. Crie contratos com regras (turno, weekend)</li>
            <li>2. Gere a agenda automática</li>
            <li>3. Acompanhe parciais/descobertos aqui</li>
            <li>4. Reforce ofertas em risco direto na Agenda</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
