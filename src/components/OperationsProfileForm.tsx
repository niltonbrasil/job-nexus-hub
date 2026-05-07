import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type OperationsProfile = {
  accepts_weekdays: boolean;
  accepts_weekends: boolean;
  weekends_only: boolean;
  parity_scope: "odd" | "even" | "any";
  crew_role: "line" | "reserve";
  line_parity_preference: "odd" | "even" | "any";
  weekend_offer_advance: boolean;
  max_hours_per_day: number;
};

export const DEFAULT_OPS_PROFILE: OperationsProfile = {
  accepts_weekdays: true,
  accepts_weekends: true,
  weekends_only: false,
  parity_scope: "any",
  crew_role: "line",
  line_parity_preference: "any",
  weekend_offer_advance: true,
  max_hours_per_day: 8,
};

const PARITY_LABEL = { odd: "Dias ímpares", even: "Dias pares", any: "Indiferente" } as const;

export function OperationsProfileForm({
  workerId,
  initial,
  onSaved,
  submitLabel = "Salvar",
}: {
  workerId: string;
  initial?: Partial<OperationsProfile>;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const [v, setV] = useState<OperationsProfile>({ ...DEFAULT_OPS_PROFILE, ...initial });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof OperationsProfile>(k: K, val: OperationsProfile[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  const toggleWeekendsOnly = (val: boolean) => {
    setV((s) => ({
      ...s,
      weekends_only: val,
      accepts_weekdays: val ? false : s.accepts_weekdays,
      accepts_weekends: val ? true : s.accepts_weekends,
    }));
  };

  const submit = async () => {
    if (!v.accepts_weekdays && !v.accepts_weekends) {
      toast.error("Você precisa aceitar pelo menos dias úteis ou finais de semana.");
      return;
    }
    if (v.max_hours_per_day < 1 || v.max_hours_per_day > 24) {
      toast.error("Carga diária deve estar entre 1 e 24 horas.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("workers")
      .update({ ...v, operations_profile_completed: true })
      .eq("id", workerId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil operacional salvo.");
    onSaved?.();
  };

  const reduces = !v.accepts_weekdays || !v.accepts_weekends || v.parity_scope !== "any";

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Disponibilidade</h3>
        <Row label="Aceito dias úteis (seg–sex)">
          <Switch checked={v.accepts_weekdays} disabled={v.weekends_only} onCheckedChange={(b) => set("accepts_weekdays", b)} />
        </Row>
        <Row label="Aceito finais de semana (sáb–dom)">
          <Switch checked={v.accepts_weekends} onCheckedChange={(b) => set("accepts_weekends", b)} />
        </Row>
        <Row label="Apenas finais de semana">
          <Switch checked={v.weekends_only} onCheckedChange={toggleWeekendsOnly} />
        </Row>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Paridade do calendário</h3>
        <SegSelect
          value={v.parity_scope}
          onChange={(x) => set("parity_scope", x)}
          options={["odd", "even", "any"] as const}
          labelMap={PARITY_LABEL}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Papel no time</h3>
        <SegSelect
          value={v.crew_role}
          onChange={(x) => set("crew_role", x)}
          options={["line", "reserve"] as const}
          labelMap={{ line: "Linha (Start)", reserve: "Folguista (reserva)" }}
        />
        {v.crew_role === "line" && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preferência de paridade da linha</Label>
            <SegSelect
              value={v.line_parity_preference}
              onChange={(x) => set("line_parity_preference", x)}
              options={["odd", "even", "any"] as const}
              labelMap={PARITY_LABEL}
            />
          </div>
        )}
        {v.crew_role === "reserve" && (
          <Row label="Receber ofertas de fim de semana com antecedência">
            <Switch checked={v.weekend_offer_advance} onCheckedChange={(b) => set("weekend_offer_advance", b)} />
          </Row>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <Label htmlFor="mh">Carga máxima por dia (horas)</Label>
        <Input
          id="mh"
          type="number"
          min={1}
          max={24}
          value={v.max_hours_per_day}
          onChange={(e) => set("max_hours_per_day", Number(e.target.value) || 0)}
        />
      </section>

      {reduces && (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          Suas escolhas podem reduzir o número de ofertas exibidas.
        </p>
      )}

      <Button onClick={submit} variant="hero" className="w-full" disabled={saving}>
        {saving ? "Salvando..." : submitLabel}
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function SegSelect<T extends string>({
  value,
  onChange,
  options,
  labelMap,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  labelMap: Record<T, string>;
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-background p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o ? "bg-navy text-ivory" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {labelMap[o]}
        </button>
      ))}
    </div>
  );
}
