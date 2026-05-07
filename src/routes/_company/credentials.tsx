import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Check, X, Ban } from "lucide-react";

export const Route = createFileRoute("/_company/credentials")({
  head: () => ({ meta: [{ title: "Credenciados — Umbrella" }] }),
  component: CredentialsPage,
});

type Client = { id: string; name: string };
type Profession = { id: string; name: string };
type Worker = { id: string; name: string; email: string | null };
type Membership = {
  id: string;
  worker_id: string;
  client_id: string;
  profession_id: string | null;
  status: "invited" | "requested" | "active" | "revoked" | "rejected";
  certification_valid_until: string | null;
  invited_at: string;
  responded_at: string | null;
  workers: Worker | null;
  professions: Profession | null;
};

const STATUS_LABEL: Record<Membership["status"], string> = {
  invited: "Convidado",
  requested: "Solicitou ingresso",
  active: "Ativo",
  revoked: "Revogado",
  rejected: "Recusado",
};

const STATUS_COLOR: Record<Membership["status"], string> = {
  invited: "bg-warning/15 text-warning-foreground",
  requested: "bg-accent/15 text-accent",
  active: "bg-success/15 text-success",
  revoked: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

function CredentialsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    worker_id: "",
    profession_id: "",
    valid_until: "",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [c, p, w] = await Promise.all([
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("professions").select("id, name").eq("active", true).order("name"),
        supabase.from("workers").select("id, name, email").order("name"),
      ]);
      const list = (c.data as Client[]) ?? [];
      setClients(list);
      setProfessions((p.data as Profession[]) ?? []);
      setWorkers((w.data as Worker[]) ?? []);
      if (list.length && !clientId) setClientId(list[0].id);
    })();
  }, [user]);

  const reload = async () => {
    if (!clientId) return setMemberships([]);
    const { data } = await supabase
      .from("company_worker_memberships")
      .select(
        "id, worker_id, client_id, profession_id, status, certification_valid_until, invited_at, responded_at, workers(id, name, email), professions(id, name)"
      )
      .eq("client_id", clientId)
      .order("invited_at", { ascending: false });
    setMemberships((data as Membership[]) ?? []);
  };
  useEffect(() => {
    reload();
  }, [clientId]);

  const invite = async () => {
    if (!form.worker_id) return toast.error("Selecione um profissional.");
    const payload = {
      client_id: clientId,
      worker_id: form.worker_id,
      profession_id: form.profession_id || null,
      certification_valid_until: form.valid_until || null,
      status: "invited" as const,
      invited_by: user!.id,
    };
    const { error } = await supabase.from("company_worker_memberships").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Convite enviado.");
    setOpen(false);
    setForm({ worker_id: "", profession_id: "", valid_until: "" });
    reload();
  };

  const updateStatus = async (m: Membership, status: Membership["status"]) => {
    const { error } = await supabase
      .from("company_worker_memberships")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado.");
    reload();
  };

  const updateCert = async (m: Membership, valid_until: string) => {
    const { error } = await supabase
      .from("company_worker_memberships")
      .update({ certification_valid_until: valid_until || null })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Certificação atualizada.");
    reload();
  };

  const availableWorkers = workers.filter(
    (w) => !memberships.some((m) => m.worker_id === w.id && m.status !== "revoked" && m.status !== "rejected")
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Rede credenciada
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Credenciados</h1>
        </div>
        <div className="flex items-center gap-3">
          {clients.length > 1 && (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <Button onClick={() => setOpen(true)} variant="hero" disabled={!clientId}>
            <UserPlus className="h-4 w-4" /> Convidar profissional
          </Button>
        </div>
      </div>

      {memberships.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">Nenhum credenciado</h3>
          <p className="mt-1 text-muted-foreground">
            Convide profissionais para que possam ver suas demandas.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {memberships.map((m) => {
            const certExpired =
              m.certification_valid_until && new Date(m.certification_valid_until) < new Date();
            return (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-card p-4 shadow-elevate"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-ivory font-semibold">
                      {m.workers?.name.charAt(0).toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="font-semibold">{m.workers?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.workers?.email ?? "—"} · {m.professions?.name ?? "Sem profissão"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLOR[m.status]}`}
                  >
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Cert. válida até</Label>
                    <input
                      type="date"
                      defaultValue={m.certification_valid_until ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (m.certification_valid_until ?? ""))
                          updateCert(m, e.target.value);
                      }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    />
                    {certExpired && (
                      <span className="text-[10px] font-semibold uppercase text-destructive">
                        Expirada
                      </span>
                    )}
                  </div>

                  <div className="ml-auto flex flex-wrap gap-2">
                    {m.status === "requested" && (
                      <Button size="sm" variant="hero" onClick={() => updateStatus(m, "active")}>
                        <Check className="h-3.5 w-3.5" /> Aprovar
                      </Button>
                    )}
                    {m.status === "requested" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(m, "rejected")}>
                        <X className="h-3.5 w-3.5" /> Recusar
                      </Button>
                    )}
                    {m.status === "invited" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(m, "revoked")}>
                        <Ban className="h-3.5 w-3.5" /> Cancelar convite
                      </Button>
                    )}
                    {m.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(m, "revoked")}>
                        <Ban className="h-3.5 w-3.5" /> Revogar
                      </Button>
                    )}
                    {(m.status === "revoked" || m.status === "rejected") && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(m, "invited")}>
                        Reconvidar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-card p-6 shadow-elevate sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Convidar profissional</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Profissional</Label>
                <select
                  value={form.worker_id}
                  onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione…</option>
                  {availableWorkers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.email ? `· ${w.email}` : ""}
                    </option>
                  ))}
                </select>
                {availableWorkers.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Todos os profissionais já têm vínculo com esta empresa.
                  </p>
                )}
              </div>
              <div>
                <Label>Profissão</Label>
                <select
                  value={form.profession_id}
                  onChange={(e) => setForm({ ...form, profession_id: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— sem profissão —</option>
                  {professions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Certificação válida até</Label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                />
              </div>
              <Button onClick={invite} variant="hero" className="w-full">
                Enviar convite
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
