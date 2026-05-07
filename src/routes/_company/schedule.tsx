import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Calendar, Clock, MessageSquare, PhoneCall, MapPin, X, Users, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_company/schedule")({
  head: () => ({ meta: [{ title: "Agenda — Umbrella" }] }),
  component: Schedule,
});

const ICONS = { chat: MessageSquare, voice: PhoneCall, visit: MapPin } as const;
const STATUS_COLORS: Record<string, string> = {
  open: "bg-destructive/15 text-destructive border-destructive/30",
  partially_filled: "bg-warning/15 text-warning-foreground border-warning/30",
  filled: "bg-success/15 text-success border-success/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Descoberto",
  partially_filled: "Parcial",
  filled: "Completo",
  completed: "Concluído",
  cancelled: "Cancelado",
};

type Demand = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  job_type: "chat" | "voice" | "visit";
  slots_required: number;
  status: keyof typeof STATUS_COLORS;
  contract_service_id: string;
  priority: string;
  block_index: number;
  plan_snapshot: Record<string, unknown> | null;
};

type OfferDetail = {
  id: string;
  slots_total: number;
  slots_filled: number;
  status: string;
  wave: number;
  eligible_teams: string[];
  opens_at: string;
};

function Schedule() {
  const { user } = useAuth();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "partially_filled" | "filled">("all");
  const [selected, setSelected] = useState<Demand | null>(null);
  const [offer, setOffer] = useState<OfferDetail | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: clients } = await supabase.from("clients").select("id");
    const cIds = (clients ?? []).map((c) => c.id);
    if (!cIds.length) return setDemands([]);
    const { data: contracts } = await supabase.from("contracts").select("id").in("client_id", cIds);
    const ctIds = (contracts ?? []).map((c) => c.id);
    if (!ctIds.length) return setDemands([]);
    const { data: services } = await supabase.from("contract_services").select("id").in("contract_id", ctIds);
    const sIds = (services ?? []).map((s) => s.id);
    if (!sIds.length) return setDemands([]);
    const { data } = await supabase
      .from("demands")
      .select("id, date, start_time, end_time, job_type, slots_required, status, contract_service_id, priority, block_index, plan_snapshot")
      .in("contract_service_id", sIds)
      .order("date", { ascending: true });
    setDemands((data as Demand[]) ?? []);
  };

  useEffect(() => {
    load();
  }, [user]);

  const generateNextWeek = async () => {
    if (!user) return;
    const { data: clients } = await supabase.from("clients").select("id");
    const cIds = (clients ?? []).map((c) => c.id);
    const { data: contracts } = await supabase.from("contracts").select("id").in("client_id", cIds).eq("status", "active");
    const ctIds = (contracts ?? []).map((c) => c.id);
    const { data: services } = await supabase
      .from("contract_services")
      .select("id, service_type, hours_per_day, min_workers, rules")
      .in("contract_id", ctIds);

    if (!services?.length) {
      toast.error("Nenhum contrato ativo. Crie um contrato antes.");
      return;
    }

    type DemandInsert = {
      contract_service_id: string;
      date: string;
      start_time: string;
      end_time: string;
      job_type: "chat" | "voice" | "visit";
      hours_required: number;
      slots_required: number;
      weekend: boolean;
      shift_type: "day" | "night";
    };
    const inserts: DemandInsert[] = [];
    const now = new Date();
    for (let d = 0; d < 7; d++) {
      const day = new Date(now);
      day.setDate(now.getDate() + d);
      const dateStr = day.toISOString().slice(0, 10);
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const isOdd = day.getDate() % 2 === 1;

      for (const svc of services) {
        const rules = (svc.rules ?? {}) as {
          weekend?: boolean;
          parity?: "none" | "odd" | "even";
          night_shift?: boolean;
        };
        if (isWeekend && rules.weekend === false) continue;
        if (rules.parity === "odd" && !isOdd) continue;
        if (rules.parity === "even" && isOdd) continue;

        const start = new Date(day);
        start.setHours(rules.night_shift ? 20 : 8, 0, 0, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + svc.hours_per_day);

        inserts.push({
          contract_service_id: svc.id,
          date: dateStr,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          job_type: svc.service_type as "chat" | "voice" | "visit",
          hours_required: svc.hours_per_day,
          slots_required: svc.min_workers,
          weekend: isWeekend,
          shift_type: rules.night_shift || svc.hours_per_day >= 24 ? "night" : "day",
        });
      }
    }

    if (!inserts.length) {
      toast.info("As regras dos contratos não geraram plantões para os próximos 7 dias.");
      return;
    }

    const { error, data } = await supabase.from("demands").insert(inserts).select("id");
    if (error) return toast.error(error.message);

    if (data?.length) {
      const offers = data.map((d, i) => ({
        demand_id: d.id,
        slots_total: inserts[i].slots_required,
      }));
      await supabase.from("shift_offers").insert(offers);
    }

    toast.success(`${inserts.length} plantões gerados.`);
    load();
  };

  const [offers, setOffers] = useState<OfferDetail[]>([]);
  const openDetail = async (d: Demand) => {
    setSelected(d);
    const { data } = await supabase
      .from("shift_offers")
      .select("id, slots_total, slots_filled, status, wave, eligible_teams, opens_at")
      .eq("demand_id", d.id)
      .order("wave");
    const list = (data as OfferDetail[]) ?? [];
    setOffers(list);
    setOffer(list[0] ?? null);
  };

  const reinforceOffer = async () => {
    if (!offer || !selected) return;
    const { error } = await supabase
      .from("shift_offers")
      .update({ slots_total: offer.slots_total + 1, status: "open" })
      .eq("id", offer.id);
    if (error) return toast.error(error.message);
    toast.success("Oferta reforçada (+1 vaga).");
    setOffer({ ...offer, slots_total: offer.slots_total + 1, status: "open" });
    load();
  };

  const setPriorityHigh = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("demands")
      .update({ priority: "high" })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Prioridade definida como alta.");
    setSelected({ ...selected, priority: "high" });
    load();
  };

  const filtered = useMemo(
    () => (filter === "all" ? demands : demands.filter((d) => d.status === filter)),
    [demands, filter],
  );

  const counts = useMemo(() => {
    return {
      all: demands.length,
      filled: demands.filter((d) => d.status === "filled").length,
      partially_filled: demands.filter((d) => d.status === "partially_filled").length,
      open: demands.filter((d) => d.status === "open").length,
    };
  }, [demands]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Plantões automáticos
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Agenda</h1>
        </div>
        <Button variant="hero" onClick={generateNextWeek}>
          <Calendar className="h-4 w-4" /> Gerar próximos 7 dias
        </Button>
      </div>

      <div className="mb-4 inline-flex flex-wrap gap-2 rounded-lg border border-border bg-card p-1">
        {(
          [
            { k: "all", label: `Todos (${counts.all})` },
            { k: "filled", label: `Completos (${counts.filled})` },
            { k: "partially_filled", label: `Parciais (${counts.partially_filled})` },
            { k: "open", label: `Descobertos (${counts.open})` },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              filter === t.k ? "bg-navy text-ivory" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">Nenhum plantão</h3>
          <p className="mt-1 text-muted-foreground">
            Use o botão acima para gerar plantões a partir dos contratos ativos.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevate">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Horário</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Slots</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const Icon = ICONS[d.job_type];
                return (
                  <tr
                    key={d.id}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-secondary/40 last:border-0"
                    onClick={() => openDetail(d)}
                  >
                    <td className="px-5 py-3 font-medium">{d.date}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(d.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} →{" "}
                        {new Date(d.end_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2 capitalize">
                        <Icon className="h-4 w-4 text-accent" />
                        {d.job_type}
                      </span>
                    </td>
                    <td className="px-5 py-3">{d.slots_required}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[d.status]}`}
                      >
                        {STATUS_LABEL[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-accent">Detalhes →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-2xl bg-card p-6 shadow-elevate sm:rounded-2xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Plantão · {selected.date}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold capitalize">{selected.job_type}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(selected.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} →{" "}
                  {new Date(selected.end_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs uppercase text-muted-foreground">Necessários</p>
                <p className="mt-1 font-display text-xl font-bold">{offer?.slots_total ?? selected.slots_required}</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs uppercase text-muted-foreground">Aceitos</p>
                <p className="mt-1 font-display text-xl font-bold text-success">
                  {offer?.slots_filled ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs uppercase text-muted-foreground">Prioridade</p>
                <p className="mt-1 font-display text-xl font-bold capitalize">{selected.priority}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button variant="hero" className="flex-1" onClick={reinforceOffer}>
                <Megaphone className="h-4 w-4" /> Reforçar oferta
              </Button>
              <Button variant="outline" className="flex-1" onClick={setPriorityHigh}>
                <Users className="h-4 w-4" /> Marcar prioridade alta
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Status atual:{" "}
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[selected.status]}`}
              >
                {STATUS_LABEL[selected.status]}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
