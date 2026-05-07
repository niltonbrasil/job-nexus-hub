import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Users, ShieldCheck, Trophy, TrendingUp, X, Ban, Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_company/professionals")({
  head: () => ({ meta: [{ title: "Profissionais — Umbrella" }] }),
  component: Pros,
});

import { TEAM_LABEL, type Team } from "@/lib/distribution";

type Worker = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  type: string;
  team: Team | null;
};

type Metric = {
  worker_id: string;
  reliability_score: number;
  total_accepted: number;
  total_worked: number;
  total_no_show: number;
};

type RecentExec = {
  id: string;
  status: string;
  hours_worked: number;
  created_at: string;
};

function Pros() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [metrics, setMetrics] = useState<Record<string, Metric>>({});
  const [view, setView] = useState<"all" | "ranking">("ranking");
  const [selected, setSelected] = useState<Worker | null>(null);
  const [recent, setRecent] = useState<RecentExec[]>([]);

  const reload = async () => {
    const { data } = await supabase
      .from("workers")
      .select("id, name, email, phone, status, type, team")
      .order("name");
    setWorkers((data as Worker[]) ?? []);
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
  };

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user]);

  const openDetail = async (w: Worker) => {
    setSelected(w);
    const { data } = await supabase
      .from("shift_executions")
      .select("id, status, hours_worked, created_at")
      .eq("worker_id", w.id)
      .order("created_at", { ascending: false })
      .limit(8);
    setRecent((data as RecentExec[]) ?? []);
  };

  const toggleRestrict = async () => {
    if (!selected) return;
    const next = selected.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("workers").update({ status: next }).eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success(next === "inactive" ? "Profissional restrito." : "Profissional reativado.");
    setSelected({ ...selected, status: next });
    reload();
  };

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
              <button
                key={w.id}
                onClick={() => openDetail(w)}
                className={`flex items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-elevate transition-colors hover:border-accent ${
                  idx < 3 ? "border-accent/40" : "border-border"
                } ${w.status === "inactive" ? "opacity-60" : ""}`}
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
                  <p className="font-semibold">
                    {w.name}
                    {w.status === "inactive" && (
                      <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                        Restrito
                      </span>
                    )}
                  </p>
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
              </button>
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
              <button
                key={w.id}
                onClick={() => openDetail(w)}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-elevate hover:border-accent"
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
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-2xl bg-card p-6 shadow-elevate sm:rounded-2xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-ivory font-semibold">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selected.email ?? selected.phone ?? "—"} · {selected.type}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            {(() => {
              const m = metrics[selected.id];
              const pct = Math.round((m?.reliability_score ?? 1) * 100);
              return (
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Aceites</p>
                    <p className="mt-1 font-display text-xl font-bold">{m?.total_accepted ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Executados</p>
                    <p className="mt-1 font-display text-xl font-bold text-success">{m?.total_worked ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">No-show</p>
                    <p className="mt-1 font-display text-xl font-bold text-destructive">{m?.total_no_show ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-success/10 p-3">
                    <p className="text-[10px] uppercase text-success">Confiabilidade</p>
                    <p className="mt-1 font-display text-xl font-bold text-success">{pct}%</p>
                  </div>
                </div>
              );
            })()}

            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Últimos plantões
              </h3>
              {recent.length === 0 ? (
                <p className="rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">Sem execuções ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {recent.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                      <span className="capitalize">{r.status.replace("_", " ")}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {Number(r.hours_worked).toFixed(2)}h · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Equipe</p>
              <select
                value={selected.team ?? ""}
                onChange={(e) => setTeam((e.target.value || null) as Team | null)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sem equipe</option>
                {(Object.keys(TEAM_LABEL) as Team[]).map((t) => (
                  <option key={t} value={t}>{TEAM_LABEL[t]}</option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => toast.success(`${selected.name} marcado como prioritário no matching.`)}
              >
                <Star className="h-4 w-4" /> Priorizar
              </Button>
              <Button
                variant={selected.status === "active" ? "outline" : "hero"}
                className="flex-1"
                onClick={toggleRestrict}
              >
                {selected.status === "active" ? (
                  <>
                    <Ban className="h-4 w-4" /> Restringir
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Reativar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
