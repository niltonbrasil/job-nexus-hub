import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_company/professionals")({
  head: () => ({ meta: [{ title: "Profissionais — Umbrella" }] }),
  component: Pros,
});

type Worker = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  type: string;
};

function Pros() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("workers").select("id, name, email, phone, status, type").order("name");
      setWorkers(data ?? []);
      const ids = (data ?? []).map((w) => w.id);
      if (ids.length) {
        const { data: m } = await supabase.from("worker_metrics").select("worker_id, reliability_score").in("worker_id", ids);
        const map: Record<string, number> = {};
        (m ?? []).forEach((row) => (map[row.worker_id] = Number(row.reliability_score)));
        setMetrics(map);
      }
    })();
  }, [user]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Rede operacional
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Profissionais</h1>
      </div>

      {workers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">Nenhum profissional ainda</h3>
          <p className="mt-1 text-muted-foreground">
            Profissionais cadastrados na plataforma aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {workers.map((w) => {
            const score = metrics[w.id] ?? 1;
            const pct = Math.round(score * 100);
            return (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-elevate"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-ivory font-semibold">
                    {w.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.email ?? w.phone ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{w.type}</span>
                  <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                    <ShieldCheck className="h-3.5 w-3.5" /> {pct}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
