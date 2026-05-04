import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Users, ShieldCheck, Trophy, TrendingUp } from "lucide-react";

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

type Metric = {
  worker_id: string;
  reliability_score: number;
  total_accepted: number;
  total_worked: number;
  total_no_show: number;
};

function Pros() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [metrics, setMetrics] = useState<Record<string, Metric>>({});
  const [view, setView] = useState<"all" | "ranking">("ranking");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("workers")
        .select("id, name, email, phone, status, type")
        .order("name");
      setWorkers(data ?? []);
      const ids = (data ?? []).map((w) => w.id);
      if (ids.length) {
        const { data: m } = await supabase
          .from("worker_metrics")
          .select("worker_id, reliability_score, total_accepted, total_worked, total_no_show")
          .in("worker_id", ids);
        const map: Record<string, Metric> = {};
        (m ?? []).forEach((row) => (map[row.worker_id] = { ...row, reliability_score: Number(row.reliability_score) }));
        setMetrics(map);
      }
    })();
  }, [user]);

  const ranked = useMemo(() => {
    return [...workers]
      .map((w) => ({ w, m: metrics[w.id] }))
      .sort((a, b) => {
        const sa = a.m?.reliability_score ?? 0;
        const sb = b.m?.reliability_score ?? 0;
        if (sb !== sa) return sb - sa;
        return (b.m?.total_worked ?? 0) - (a.m?.total_worked ?? 0);
      });
  }, [workers, metrics]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Rede operacional
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Profissionais</h1>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {(
            [
              { k: "ranking", label: "Ranking" },
              { k: "all", label: "Todos" },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setView(t.k)}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                view === t.k ? "bg-navy text-ivory" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">Nenhum profissional ainda</h3>
          <p className="mt-1 text-muted-foreground">
            Profissionais cadastrados na plataforma aparecerão aqui.
          </p>
        </div>
      ) : view === "ranking" ? (
        <div className="grid gap-3">
          {ranked.map(({ w, m }, idx) => {
            const score = m?.reliability_score ?? 1;
            const pct = Math.round(score * 100);
            const accepted = m?.total_accepted ?? 0;
            const worked = m?.total_worked ?? 0;
            const noShow = m?.total_no_show ?? 0;
            const medalColor =
              idx === 0 ? "text-warning" : idx === 1 ? "text-muted-foreground" : idx === 2 ? "text-warning/60" : "text-muted-foreground/40";
            return (
              <div
                key={w.id}
                className={`flex items-center gap-4 rounded-xl border bg-card p-4 shadow-elevate ${
                  idx < 3 ? "border-accent/40" : "border-border"
                }`}
              >
                <div className="flex w-10 items-center justify-center">
                  {idx < 3 ? (
                    <Trophy className={`h-6 w-6 ${medalColor}`} />
                  ) : (
                    <span className="font-display text-xl font-bold text-muted-foreground">#{idx + 1}</span>
                  )}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-ivory font-semibold">
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {worked} executados · {accepted} aceitos {noShow > 0 && `· ${noShow} faltas`}
                  </p>
                </div>
                <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {worked}
                </div>
                <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-sm font-bold text-success">
                  <ShieldCheck className="h-4 w-4" /> {pct}%
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3">
          {workers.map((w) => {
            const m = metrics[w.id];
            const score = m?.reliability_score ?? 1;
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
