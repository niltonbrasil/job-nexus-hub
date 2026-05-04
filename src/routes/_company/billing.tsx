import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Receipt, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_company/billing")({
  head: () => ({ meta: [{ title: "Faturamento — Umbrella" }] }),
  component: Billing,
});

type Bill = {
  id: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  total_amount: number;
  status: string;
};

function Billing() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: clients } = await supabase.from("clients").select("id");
      const cIds = (clients ?? []).map((c) => c.id);
      if (!cIds.length) return;
      const { data: contracts } = await supabase.from("contracts").select("id").in("client_id", cIds);
      const ctIds = (contracts ?? []).map((c) => c.id);
      if (!ctIds.length) return;
      const { data } = await supabase
        .from("billings")
        .select("id, period_start, period_end, total_hours, total_amount, status")
        .in("contract_id", ctIds)
        .order("period_start", { ascending: false });
      setBills((data as Bill[]) ?? []);
    })();
  }, [user]);

  const total = bills.reduce((s, b) => s + Number(b.total_amount), 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Baseado em execução real
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Faturamento</h1>
        </div>
        <div className="rounded-2xl border border-border bg-card-elevated px-6 py-4 text-right shadow-elevate">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total acumulado</p>
          <p className="mt-1 font-display text-3xl font-bold">
            R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">Sem faturas ainda</h3>
          <p className="mt-1 text-muted-foreground">
            Faturas são geradas a partir das execuções concluídas no período.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevate">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Período</th>
                <th className="px-5 py-3">Horas</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3 font-medium">
                    {b.period_start} → {b.period_end}
                  </td>
                  <td className="px-5 py-3">{Number(b.total_hours).toFixed(1)}h</td>
                  <td className="px-5 py-3 font-mono">
                    R$ {Number(b.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
