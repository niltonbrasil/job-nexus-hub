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
} from "lucide-react";

// TODO: quando o schema tiver endereço da visita (em demands ou clients),
// substituir o placeholder abaixo. Hoje não há coluna address — usamos fallback.
const VISIT_ADDRESS_PLACEHOLDER = "Endereço não cadastrado para esta visita";

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
  shift_acceptances: {
    shift_offers: {
      demands: { date: string; job_type: "chat" | "voice" | "visit"; hours_required: number } | null;
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
  const [visitNotes, setVisitNotes] = useState("");

  const mapHref = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(VISIT_ADDRESS_PLACEHOLDER)}`;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("shift_executions")
        .select(
          "id, status, checkin_time, hours_worked, acceptance_id, shift_acceptances(shift_offers(demands(date, job_type, hours_required)))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) toast.error(error.message);
      setExec(data as ExecutionRow | null);
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
    toast.success("Job finalizado. Confiabilidade atualizada.");
    setTimeout(() => navigate({ to: "/app" }), 800);
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg: Msg = { id: crypto.randomUUID(), from: "me", text: input, at: new Date().toISOString() };
    setMessages((m) => [...m, newMsg]);
    setInput("");
    // simulate client reply
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
  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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

      <main className="flex flex-1 flex-col">
        {/* CHAT MODE */}
        {jobType === "chat" && exec.status === "in_progress" && (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.from === "me"
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-foreground"
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
            <div className={`flex h-32 w-32 items-center justify-center rounded-full ${callActive ? "bg-success/20" : "bg-secondary"}`}>
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
                      visitChecks[k]
                        ? "border-success bg-success text-white"
                        : "border-border"
                    }`}
                  >
                    {visitChecks[k] && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              ))}
              <textarea
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                placeholder="Observações (opcional)"
                rows={3}
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
                  <div className="flex items-center gap-3">
                    <Navigation className="h-5 w-5 text-accent" />
                    <p className="font-semibold">Check-in com GPS</p>
                  </div>
                  {coords ? (
                    <p className="mt-2 font-mono text-xs text-success">
                      GPS pronto: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-warning-foreground">
                      Aguardando GPS… autorize a localização para registrar a chegada.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    O check-in registra suas coordenadas como prova de chegada antes de iniciar o turno.
                  </p>
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
              disabled={jobType === "visit" && !coords}
            >
              {jobType === "visit" && !coords ? "Aguardando GPS para check-in" : "Fazer check-in"}
            </Button>
          ) : (
            <Button
              variant="navy"
              size="lg"
              className="w-full"
              onClick={checkout}
            >
              Finalizar e fazer checkout
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}
