import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HeartPulse, Plus, X, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_company/patients")({
  head: () => ({ meta: [{ title: "Pacientes — Umbrella" }] }),
  component: PatientsPage,
});

type Client = { id: string; name: string };
type Patient = {
  id: string;
  client_id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  notes: string | null;
};

function PatientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      const list = (data as Client[]) ?? [];
      setClients(list);
      if (list.length && !clientId) setClientId(list[0].id);
    })();
  }, [user]);

  const reload = async () => {
    if (!clientId) return setPatients([]);
    const { data } = await supabase
      .from("patients")
      .select("id, client_id, full_name, cpf, birth_date, notes")
      .eq("client_id", clientId)
      .order("full_name");
    setPatients((data as Patient[]) ?? []);
  };
  useEffect(() => {
    reload();
  }, [clientId]);

  const newPatient = () => {
    setEditing({ id: "", client_id: clientId, full_name: "", cpf: "", birth_date: "", notes: "" });
    setOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.full_name.trim()) return toast.error("Nome é obrigatório.");
    const payload = {
      client_id: clientId,
      full_name: editing.full_name.trim(),
      cpf: editing.cpf?.trim() || null,
      birth_date: editing.birth_date || null,
      notes: editing.notes?.trim() || null,
    };
    if (editing.id) {
      const { error } = await supabase.from("patients").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Paciente atualizado.");
    } else {
      const { error } = await supabase.from("patients").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Paciente cadastrado.");
    }
    setOpen(false);
    setEditing(null);
    reload();
  };

  const remove = async (p: Patient) => {
    if (!confirm(`Excluir ${p.full_name}?`)) return;
    const { error } = await supabase.from("patients").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Paciente removido.");
    reload();
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Atendimento Prova de Vida
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Pacientes</h1>
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
          <Button onClick={newPatient} variant="hero" disabled={!clientId}>
            <Plus className="h-4 w-4" /> Novo paciente
          </Button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <HeartPulse className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">Crie um cliente primeiro</h3>
          <p className="mt-1 text-muted-foreground">
            Pacientes ficam vinculados a um cliente da empresa.
          </p>
        </div>
      ) : patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <HeartPulse className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">Nenhum paciente</h3>
          <p className="mt-1 text-muted-foreground">Cadastre o primeiro paciente para gerar visitas.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {patients.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-elevate"
            >
              <button
                onClick={() => {
                  setEditing(p);
                  setOpen(true);
                }}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-ivory font-semibold">
                  {p.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.cpf ? `CPF ${p.cpf}` : (
                      <span className="text-warning-foreground">Sem CPF · não pode gerar visita</span>
                    )}
                  </p>
                </div>
              </button>
              <button
                onClick={() => remove(p)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {open && editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-card p-6 shadow-elevate sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">
                {editing.id ? "Editar paciente" : "Novo paciente"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Nome completo</Label>
                <Input
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>CPF (opcional)</Label>
                <Input
                  value={editing.cpf ?? ""}
                  onChange={(e) => setEditing({ ...editing, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Sem CPF, esse paciente não poderá ser usado para gerar visita.
                </p>
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={editing.birth_date ?? ""}
                  onChange={(e) => setEditing({ ...editing, birth_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Observações</Label>
                <textarea
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button onClick={save} variant="hero" className="w-full">
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
