import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, FileText, MessageSquare, PhoneCall, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_company/contracts")({
  head: () => ({ meta: [{ title: "Contratos — Umbrella" }] }),
  component: Contracts,
});

type Contract = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  contract_services?: { id: string; service_type: string; hours_per_day: number; min_workers: number; price_per_hour: number }[];
};

const ICONS = { chat: MessageSquare, voice: PhoneCall, visit: MapPin } as const;

function Contracts() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<"1" | "3" | "6">("3");
  const [serviceType, setServiceType] = useState<"chat" | "voice" | "visit">("chat");
  const [hoursPerDay, setHoursPerDay] = useState<"4" | "12" | "24">("12");
  const [minWorkers, setMinWorkers] = useState(1);
  const [price, setPrice] = useState(35);
  const [weekend, setWeekend] = useState(true);
  const [parity, setParity] = useState<"none" | "odd" | "even">("none");
  const [nightShift, setNightShift] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: clients } = await supabase.from("clients").select("id");
    const ids = (clients ?? []).map((c) => c.id);
    if (!ids.length) return;
    const { data } = await supabase
      .from("contracts")
      .select("id, name, start_date, end_date, status, contract_services(id, service_type, hours_per_day, min_workers, price_per_hour)")
      .in("client_id", ids)
      .order("created_at", { ascending: false });
    setContracts((data as Contract[]) ?? []);
  };

  useEffect(() => {
    load();
  }, [user]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const { data: clients } = await supabase.from("clients").select("id").limit(1);
    const clientId = clients?.[0]?.id;
    if (!clientId) {
      toast.error("Empresa não encontrada.");
      return;
    }
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + Number(duration));

    const { data: contract, error } = await supabase
      .from("contracts")
      .insert({
        client_id: clientId,
        name,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        billing_cycle: "monthly",
      })
      .select("id")
      .single();

    if (error || !contract) {
      toast.error(error?.message ?? "Erro ao criar contrato");
      return;
    }

    const { error: svcErr } = await supabase.from("contract_services").insert({
      contract_id: contract.id,
      service_type: serviceType,
      hours_per_day: Number(hoursPerDay),
      min_workers: minWorkers,
      price_per_hour: price,
      rules: { weekend, parity, night_shift: nightShift || hoursPerDay === "24" },
    });
    if (svcErr) {
      toast.error(svcErr.message);
      return;
    }

    toast.success("Contrato criado.");
    setOpen(false);
    setName("");
    load();
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Acordos ativos
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Contratos</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="lg">
              <Plus className="h-4 w-4" /> Novo contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Novo contrato</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome do contrato</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Operação SAC Q2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Duração</Label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as "1" | "3" | "6")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="1">1 mês</option>
                    <option value="3">3 meses</option>
                    <option value="6">6 meses</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as "chat" | "voice" | "visit")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="chat">Chat</option>
                    <option value="voice">Voz</option>
                    <option value="visit">Visita</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Horas/dia</Label>
                  <select
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(e.target.value as "4" | "12" | "24")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="4">4h</option>
                    <option value="12">12h</option>
                    <option value="24">24h</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Profissionais mínimos</Label>
                  <Input
                    type="number"
                    min={1}
                    value={minWorkers}
                    onChange={(e) => setMinWorkers(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço por hora (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" variant="hero">Criar contrato</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">Nenhum contrato ainda</h3>
          <p className="mt-1 text-muted-foreground">Crie seu primeiro contrato para começar a gerar plantões.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {contracts.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card-elevated p-6 shadow-elevate">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-xl font-semibold">{c.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.start_date} → {c.end_date}
                  </p>
                </div>
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
                  {c.status}
                </span>
              </div>
              <div className="mt-5 space-y-2">
                {c.contract_services?.map((s) => {
                  const Icon = ICONS[s.service_type as keyof typeof ICONS];
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-accent" />
                        <span className="font-medium capitalize">{s.service_type}</span>
                        <span className="text-muted-foreground">· {s.hours_per_day}h/dia · {s.min_workers} pro</span>
                      </div>
                      <span className="font-mono text-xs">R$ {Number(s.price_per_hour).toFixed(2)}/h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
