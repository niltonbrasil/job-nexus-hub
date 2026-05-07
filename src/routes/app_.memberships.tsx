import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Check, X, Loader2, ArrowLeft, Send } from "lucide-react";

export const Route = createFileRoute("/app_/memberships")({
  head: () => ({ meta: [{ title: "Vínculos com empresas — Umbrella" }] }),
  component: WorkerMemberships,
});

type Profession = { id: string; name: string };
type Membership = {
  id: string;
  client_id: string;
  status: "invited" | "requested" | "active" | "revoked";
  certification_valid_until: string | null;
  invited_at: string;
  clients: { id: string; name: string } | null;
  professions: Profession | null;
};
type ClientOption = { id: string; name: string };

const STATUS_LABEL: Record<Membership["status"], string> = {
  invited: "Convite recebido",
  requested: "Aguardando aprovação",
  active: "Ativo",
  revoked: "Encerrado",
};

const STATUS_COLOR: Record<Membership["status"], string> = {
  invited: "bg-warning/15 text-warning-foreground",
  requested: "bg-accent/15 text-accent",
  active: "bg-success/15 text-success",
  revoked: "bg-muted text-muted-foreground",
};

function WorkerMemberships() {
  const { user, loading } = useAuth();
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [allClients, setAllClients] = useState<ClientOption[]>([]);
  const [requestClientId, setRequestClientId] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: w } = await supabase
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!w) return;
      setWorkerId(w.id);
      reload(w.id);
    })();
  }, [user]);

  const reload = async (wid: string) => {
    const { data } = await supabase
      .from("company_worker_memberships")
      .select(
        "id, client_id, status, certification_valid_until, invited_at, clients(id, name), professions(id, name)"
      )
      .eq("worker_id", wid)
      .order("invited_at", { ascending: false });
    setMemberships((data as Membership[]) ?? []);

    // For "request to join", list clients we're not already linked to
    const { data: cs } = await supabase.from("clients").select("id, name").order("name");
    setAllClients((cs as ClientOption[]) ?? []);
  };

  const respond = async (m: Membership, status: "active" | "revoked") => {
    const { error } = await supabase
      .from("company_worker_memberships")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success(status === "active" ? "Convite aceito!" : "Convite recusado.");
    if (workerId) reload(workerId);
  };

  const requestJoin = async () => {
    if (!workerId || !requestClientId) return;
    const { error } = await supabase.from("company_worker_memberships").insert({
      worker_id: workerId,
      client_id: requestClientId,
      status: "requested",
    });
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada à empresa.");
    setRequestClientId("");
    reload(workerId);
  };

  const linkedClientIds = new Set(memberships.map((m) => m.client_id));
  const availableClients = allClients.filter((c) => !linkedClientIds.has(c.id));

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = memberships.filter((m) => m.status === "invited");
  const others = memberships.filter((m) => m.status !== "invited");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-5 py-4">
        <Link
          to="/app"
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-lg font-bold">Vínculos com empresas</h1>
      </header>

      <main className="flex-1 space-y-6 p-5">
        {pending.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Convites pendentes
            </h2>
            {pending.map((m) => (
              <div key={m.id} className="rounded-2xl border border-warning/40 bg-card p-4 shadow-elevate">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{m.clients?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.professions?.name ?? "Sem profissão definida"}
                    </p>
                    {m.certification_valid_until && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Cert. válida até {new Date(m.certification_valid_until).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="hero" className="flex-1" onClick={() => respond(m, "active")}>
                    <Check className="h-3.5 w-3.5" /> Aceitar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => respond(m, "revoked")}>
                    <X className="h-3.5 w-3.5" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Meus vínculos
          </h2>
          {others.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto mb-2 h-6 w-6" />
              Nenhum vínculo ativo ainda.
            </div>
          ) : (
            others.map((m) => (
              <div key={m.id} className="rounded-2xl border border-border bg-card p-4 shadow-elevate">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{m.clients?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{m.professions?.name ?? "Sem profissão"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLOR[m.status]}`}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-elevate">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Solicitar ingresso
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Peça para entrar em uma empresa. Ela ainda precisa aprovar.
          </p>
          <div className="mt-3 space-y-2">
            <Label className="text-xs">Empresa</Label>
            <select
              value={requestClientId}
              onChange={(e) => setRequestClientId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione…</option>
              {availableClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button onClick={requestJoin} variant="hero" className="w-full" disabled={!requestClientId}>
              <Send className="h-3.5 w-3.5" /> Enviar solicitação
            </Button>
            {availableClients.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Nenhuma empresa disponível para solicitar.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
