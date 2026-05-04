import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Calendar, Clock, MessageSquare, PhoneCall, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_company/schedule")({
  head: () => ({ meta: [{ title: "Agenda — Umbrella" }] }),
  component: Schedule,
});

const ICONS = { chat: MessageSquare, voice: PhoneCall, visit: MapPin } as const;
const STATUS_COLORS: Record<string, string> = {
  open: "bg-warning/15 text-warning-foreground border-warning/30",
  partially_filled: "bg-accent/15 text-accent border-accent/30",
  filled: "bg-success/15 text-success border-success/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
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
};

function Schedule() {
  const { user } = useAuth();
  const [demands, setDemands] = useState<Demand[]>([]);

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
      .select("id, date, start_time, end_time, job_type, slots_required, status, contract_service_id")
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

      for (const svc of services) {
        const rules = (svc.rules ?? {}) as { weekend?: boolean };
        if (isWeekend && rules.weekend === false) continue;
        const start = new Date(day);
        start.setHours(8, 0, 0, 0);
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
          shift_type: svc.hours_per_day >= 24 ? "night" : "day",
        });
      }
    }

    const { error, data } = await supabase.from("demands").insert(inserts).select("id");
    if (error) return toast.error(error.message);

    // create offers for each new demand
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

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
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

      {demands.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">Nenhum plantão na agenda</h3>
          <p className="mt-1 text-muted-foreground">Use o botão acima para gerar plantões a partir dos contratos ativos.</p>
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
              </tr>
            </thead>
            <tbody>
              {demands.map((d) => {
                const Icon = ICONS[d.job_type];
                return (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
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
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[d.status]}`}>
                        {d.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
