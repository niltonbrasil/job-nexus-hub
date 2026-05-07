import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  MapPin,
  MessageSquare,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  Loader2,
  CheckCircle2,
  Navigation,
  ExternalLink,
  Check,
  Building2,
  FileText,
  AlertTriangle,
} from "lucide-react";

// TODO(product): adicionar campo `visit_address` em `clients` ou `demands`
// (ou em `contract_services.rules` JSON) para substituir o placeholder abaixo.
// Hoje o schema não tem coluna de endereço de visita.
const VISIT_ADDRESS_PLACEHOLDER = "Endereço não cadastrado para esta visita";

const VISIT_INSTRUCTIONS = [
  "Chegue com 5 minutos de antecedência e identifique-se na recepção.",
  "Confirme presencialmente o responsável indicado pelo cliente.",
  "Execute o atendimento conforme briefing combinado no contrato.",
  "Registre observações relevantes no checkout para gerar prova de vida.",
];

export const Route = createFileRoute("/app/execution/$id")({
  head: () => ({ meta: [{ title: "Execução — Umbrella" }] }),
  component: ExecutionMode,
});

type ExecutionRow = {
  id: string;
  status: string;
  checkin_time: string | null;
  hours_worked: number;
  acceptance_id: string;
  notes: string | null;
  shift_acceptances: {
    shift_offers: {
      demands: {
        date: string;
        job_type: "chat" | "voice" | "visit";
        hours_required: number;
        start_time: string;
        end_time: string;
        priority: string;
        weekend: boolean;
        contract_services: {
          contracts: {
            name: string;
            clients: { name: string; contact_email: string | null } | null;
          } | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

type Msg = { id: string; from: "me" | "client"; text: string; at: string };

function ExecutionMode() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exec, setExec] = useState<ExecutionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [confirmPresence, setConfirmPresence] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState("");

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([
    { id: "1", from: "client", text: "Olá, preciso de ajuda com um pedido.", at: new Date().toISOString() },
  ]);
  const [input, setInput] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  // Voice state
  const [callActive, setCallActive] = useState(false);
  const [muted, setMuted] = useState(false);

  // Visit checklist
  const [visitChecks, setVisitChecks] = useState({ arrived: false, contacted: false });

  const mapHref = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(VISIT_ADDRESS_PLACEHOLDER)}`;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("shift_executions")
        .select(
          "id, status, checkin_time, hours_worked, acceptance_id, notes, shift_acceptances(shift_offers(demands(date, job_type, hours_required, start_time, end_time, priority, weekend, contract_services(contracts(name, clients(name, contact_email))))))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) toast.error(error.message);
      const row = data as ExecutionRow | null;
      setExec(row);
      if (row?.notes) setCheckoutNotes(row.notes);
      setLoading(false);
    })();
  }, [id, user]);

  // Live timer
  useEffect(() => {
    if (!exec?.checkin_time || exec.status !== "in_progress") return;
    const start = new Date(exec.checkin_time).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [exec?.checkin_time, exec?.status]);

  // GPS for visits
  useEffect(() => {
    if (exec?.shift_acceptances?.shift_offers?.demands?.job_type !== "visit") return;
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [exec]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkin = async () => {
    const proof = coords ? { lat: coords.lat, lng: coords.lng } : {};
    const { error } = await supabase.rpc("worker_checkin", { _execution_id: id });
    if (error) return toast.error(error.message);
    if (Object.keys(proof).length) {
      await supabase.from("execution_events").insert({ execution_id: id, type: "geo_checkin", metadata: proof });
    } else {
      await supabase
        .from("execution_events")
        .insert({ execution_id: id, type: "manual_checkin", metadata: { confirmed_presence: true } });
    }
    toast.success("Check-in registrado.");
    setExec((e) => (e ? { ...e, status: "in_progress", checkin_time: new Date().toISOString() } : e));
  };

  const checkout = async () => {
    const hours = elapsed / 3600;
    const proof = coords ? { lat: coords.lat, lng: coords.lng } : {};
    const { error } = await supabase.rpc("worker_checkout", {
      _execution_id: id,
      _hours: hours,
      _proof: proof,
    });
    if (error) return toast.error(error.message);
    if (checkoutNotes.trim()) {
      await supabase.from("shift_executions").update({ notes: checkoutNotes.trim() }).eq("id", id);
    }
    toast.success("Job finalizado. Confiabilidade atualizada.");
    setTimeout(() => navigate({ to: "/app" }), 800);
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg: Msg = { id: crypto.randomUUID(), from: "me", text: input, at: new Date().toISOString() };
    setMessages((m) => [...m, newMsg]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), from: "client", text: "Obrigado pela ajuda!", at: new Date().toISOString() },
      ]);
    }, 1500);
  };

  if (loading || !exec) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const demand = exec.shift_acceptances?.shift_offers?.demands;
  const jobType = demand?.job_type ?? "chat";
  const contract = demand?.contract_services?.contracts;
  const client = contract?.clients;
  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtHour = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

  const canCheckin = jobType !== "visit" || !!coords || confirmPresence;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="bg-navy-deep px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate({ to: "/app" })}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
            {exec.status === "in_progress" ? "Em execução" : exec.status === "completed" ? "Finalizado" : "Agendado"}
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-xs text-white/60">Modo</p>
            <h1 className="font-display text-2xl font-bold capitalize">{jobType}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">Tempo</p>
            <p className="font-mono text-2xl font-bold text-warning">{fmtTime(elapsed)}</p>
          </div>
        </div>
      </header>

      {/* Cliente / Contrato / Plantão */}
      {jobType === "visit" && demand && (
        <section className="border-b border-border bg-card px-5 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-4 w-4 text-accent" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</p>
              <p className="text-sm font-semibold">{client?.name ?? "—"}</p>
              {client?.contact_email && (
                <p className="text-xs text-muted-foreground">{client.contact_email}</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 text-accent" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contrato</p>
              <p className="text-sm font-semibold">{contract?.name ?? "—"}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-secondary/50 p-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Data</p>
              <p className="text-sm font-semibold">{demand.date}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Janela</p>
              <p className="text-sm font-semibold">
                {fmtHour(demand.start_time)}–{fmtHour(demand.end_time)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Horas</p>
              <p className="text-sm font-semibold">{demand.hours_required}h</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider">
            <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">
              Prioridade · {demand.priority}
            </span>
            {demand.weekend && (
              <span className="rounded-full bg-warning/20 px-2 py-1 text-warning-foreground">Fim de semana</span>
            )}
          </div>
        </section>
      )}

      <main className="flex flex-1 flex-col">
        {/* CHAT MODE */}
        {jobType === "chat" && exec.status === "in_progress" && (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.from === "me" ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <div className="flex items-center gap-2 border-t border-border bg-card p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Digite sua resposta..."
                className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
              />
              <Button size="icon" onClick={sendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* VOICE MODE */}
        {jobType === "voice" && exec.status === "in_progress" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
            <div
              className={`flex h-32 w-32 items-center justify-center rounded-full ${callActive ? "bg-success/20" : "bg-secondary"}`}
            >
              <PhoneCall className={`h-14 w-14 ${callActive ? "text-success" : "text-muted-foreground"}`} />
            </div>
            <div className="text-center">
              <p className="font-display text-lg font-bold">{callActive ? "Em ligação" : "Aguardando chamada"}</p>
              <p className="text-sm text-muted-foreground">
                {callActive ? "Atendimento em andamento" : "Toque para iniciar"}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                size="lg"
                variant={muted ? "secondary" : "outline"}
                onClick={() => setMuted((v) => !v)}
                className="h-14 w-14 rounded-full p-0"
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                size="lg"
                onClick={() => setCallActive((v) => !v)}
                className={`h-14 w-14 rounded-full p-0 ${callActive ? "bg-destructive hover:bg-destructive/90" : "bg-success hover:bg-success/90"}`}
              >
                {callActive ? <PhoneOff className="h-5 w-5" /> : <PhoneCall className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        )}

        {/* VISIT MODE */}
        {jobType === "visit" && exec.status === "in_progress" && (
          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="rounded-2xl border border-border bg-card-elevated p-5">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-accent" />
                <p className="font-semibold">Endereço da visita</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{VISIT_ADDRESS_PLACEHOLDER}</p>
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir no mapa
              </a>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="font-semibold text-sm">O que fazer nesta visita</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {VISIT_INSTRUCTIONS.map((it, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <Navigation className="h-5 w-5 text-accent" />
                <p className="font-semibold">GPS</p>
              </div>
              {coords ? (
                <p className="mt-2 font-mono text-xs text-success">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Aguardando GPS…</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <p className="font-semibold text-sm">Checklist da visita</p>
              {(
                [
                  ["arrived", "Cheguei ao local"],
                  ["contacted", "Contato com responsável"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setVisitChecks((s) => ({ ...s, [k]: !s[k] }))}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left text-sm"
                >
                  <span>{label}</span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                      visitChecks[k] ? "border-success bg-success text-white" : "border-border"
                    }`}
                  >
                    {visitChecks[k] && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <p className="font-semibold text-sm">Observações do atendimento</p>
              <p className="text-xs text-muted-foreground">
                Será gravado em <code>shift_executions.notes</code> no checkout.
              </p>
              <textarea
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                placeholder="Como foi o atendimento? Houve intercorrências?"
                rows={4}
                className="w-full resize-none rounded-lg border border-border bg-background p-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {/* PRE-CHECKIN */}
        {exec.status === "scheduled" && (
          <div className="flex flex-1 flex-col gap-5 p-6">
            {jobType === "visit" ? (
              <>
                <div className="rounded-2xl border border-border bg-card-elevated p-5">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-accent" />
                    <p className="font-semibold">Endereço da visita</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{VISIT_ADDRESS_PLACEHOLDER}</p>
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir no mapa
                  </a>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="font-semibold text-sm">O que fazer nesta visita</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {VISIT_INSTRUCTIONS.map((it, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <Navigation className="h-5 w-5 text-accent" />
                    <p className="font-semibold">Check-in</p>
                  </div>
                  {coords ? (
                    <p className="mt-2 font-mono text-xs text-success">
                      GPS pronto: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                    </p>
                  ) : (
                    <>
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          GPS indisponível. Confirme manualmente sua presença para registrar o check-in.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmPresence((v) => !v)}
                        className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left text-sm"
                      >
                        <span>Confirmo que estou presencialmente no local</span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                            confirmPresence ? "border-success bg-success text-white" : "border-border"
                          }`}
                        >
                          {confirmPresence && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                <Clock className="h-16 w-16 text-muted-foreground" />
                <div>
                  <h2 className="font-display text-2xl font-bold">Pronto para começar?</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {jobType === "chat" && "Você atenderá clientes via chat."}
                    {jobType === "voice" && "Você atenderá ligações."}
                  </p>
                </div>
                {jobType === "chat" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MessageSquare className="h-4 w-4" /> Modo chat
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {exec.status === "completed" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-success" />
            <h2 className="font-display text-2xl font-bold">Job finalizado</h2>
            <p className="text-sm text-muted-foreground">
              {Number(exec.hours_worked).toFixed(2)}h registradas. Sua confiabilidade foi atualizada.
            </p>
          </div>
        )}
      </main>

      {/* Action bar */}
      {exec.status !== "completed" && (
        <footer className="border-t border-border bg-card p-4">
          {exec.status === "scheduled" ? (
            <Button
              variant="hero"
              size="lg"
              className="w-full"
              onClick={checkin}
              disabled={!canCheckin}
            >
              {canCheckin
                ? "Fazer check-in"
                : "Aguardando GPS ou confirmação de presença"}
            </Button>
          ) : (
            <Button variant="navy" size="lg" className="w-full" onClick={checkout}>
              Finalizar e fazer checkout
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}
