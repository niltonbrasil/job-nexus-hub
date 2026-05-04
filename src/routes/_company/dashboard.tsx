import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  TrendingUp,
  ShieldCheck,
  CalendarCheck,
  AlertTriangle,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/_company/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Umbrella" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ contracts: 0, demands: 0, filled: 0, billing: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: clients } = await supabase.from("clients").select("id");
      const clientIds = (clients ?? []).map((c) => c.id);
      if (clientIds.length === 0) return;

      const { count: contracts } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .in("client_id", clientIds)
        .eq("status", "active");

      const { data: contractsData } = await supabase
        .from("contracts")
        .select("id")
        .in("client_id", clientIds);
      const contractIds = (contractsData ?? []).map((c) => c.id);

      let demands = 0;
      let filled = 0;
      if (contractIds.length) {
        const { data: services } = await supabase
          .from("contract_services")
          .select("id")
          .in("contract_id", contractIds);
        const serviceIds = (services ?? []).map((s) => s.id);
        if (serviceIds.length) {
          const { count: dCount } = await supabase
            .from("demands")
            .select("*", { count: "exact", head: true })
            .in("contract_service_id", serviceIds);
          const { count: fCount } = await supabase
            .from("demands")
            .select("*", { count: "exact", head: true })
            .in("contract_service_id", serviceIds)
            .eq("status", "filled");
          demands = dCount ?? 0;
          filled = fCount ?? 0;
        }

        const { data: bills } = await supabase
          .from("billings")
          .select("total_amount")
          .in("contract_id", contractIds);
        const billing = (bills ?? []).reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
        setStats({ contracts: contracts ?? 0, demands, filled, billing });
        return;
      }
      setStats({ contracts: contracts ?? 0, demands, filled, billing: 0 });
    })();
  }, [user]);

  const fillRate = stats.demands > 0 ? Math.round((stats.filled / stats.demands) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Visão geral
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Acompanhe demanda, execução e faturamento em tempo real.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: ShieldCheck, label: "Contratos ativos", value: stats.contracts, tone: "accent" },
          { icon: CalendarCheck, label: "Plantões gerados", value: stats.demands, tone: "navy" },
          {
            icon: TrendingUp,
            label: "Taxa de cobertura",
            value: `${fillRate}%`,
            tone: "success",
          },
          {
            icon: Activity,
            label: "Faturamento (R$)",
            value: stats.billing.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
            tone: "warning",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card-elevated p-6 shadow-elevate"
          >
            <c.icon className="h-6 w-6 text-accent" />
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-2 font-display text-3xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-elevate lg:col-span-2">
          <h3 className="font-display text-lg font-semibold">Status dos plantões</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Distribuição entre completos, parciais e descobertos.
          </p>
          <div className="mt-6 space-y-4">
            {[
              { label: "Completos", v: stats.filled, color: "bg-success" },
              { label: "Em aberto", v: stats.demands - stats.filled, color: "bg-warning" },
            ].map((row) => {
              const pct = stats.demands ? (row.v / stats.demands) * 100 : 0;
              return (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground">{row.v}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full ${row.color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {stats.demands === 0 && (
              <p className="rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">
                Crie seu primeiro contrato em <strong>Contratos</strong> para começar a gerar plantões.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-6">
          <AlertTriangle className="h-6 w-6 text-warning-foreground" />
          <h3 className="mt-3 font-display font-semibold">Próximos passos</h3>
          <ol className="mt-3 space-y-2 text-sm">
            <li>1. Crie um contrato em <strong>Contratos</strong></li>
            <li>2. Configure os serviços (chat, voz ou visita)</li>
            <li>3. Plantões são gerados automaticamente</li>
            <li>4. Profissionais aceitam pelo app</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
