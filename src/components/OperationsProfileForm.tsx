import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Info } from "lucide-react";

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
  max_hours_per_day: 12,
};

const ROUTE_OPTIONS = [
  { value: "any", label: "Qualquer dia elegível", hint: "Recebo ofertas de dias pares e ímpares" },
  { value: "odd", label: "Rota ímpar", hint: "Dias 1, 3, 5… do mês" },
  { value: "even", label: "Rota par", hint: "Dias 2, 4, 6… do mês" },
] as const;

const HOURS_OPTIONS = [12, 8, 6, 4] as const;

const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

  // Heurística MVP de elegibilidade próximos 7 dias:
  //  - aplica weekday/weekend toggles
  //  - paridade pelo dia do MÊS (1,3,5 = odd / 2,4,6 = even), não dia da semana
  //  - "só fds" -> apenas sáb/dom contam
  //  - folguista ignora rota par/ímpar (segue regra própria)
  const next7 = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const dayParity: "odd" | "even" = d.getDate() % 2 === 1 ? "odd" : "even";

      let eligible = true;
      if (v.weekends_only && !isWeekend) eligible = false;
      else {
        if (isWeekend && !v.accepts_weekends) eligible = false;
        if (!isWeekend && !v.accepts_weekdays) eligible = false;
      }
      if (eligible && v.crew_role === "line" && v.parity_scope !== "any" && v.parity_scope !== dayParity) {
        eligible = false;
      }
      return { date: d, eligible, isWeekend };
    });
  }, [v]);

  const submit = async () => {
    if (!v.accepts_weekdays && !v.accepts_weekends) {
      toast.error("Você precisa aceitar pelo menos dias úteis ou finais de semana.");
      return;
    }
    if (v.max_hours_per_day < 1 || v.max_hours_per_day > 12) {
      toast.error("Carga diária deve estar entre 1 e 12 horas.");
      return;
    }
    setSaving(true);
    // Folguista: paridade não se aplica — força 'any' para evitar inconsistência.
    const parityScope = v.crew_role === "reserve" ? "any" : v.parity_scope;
    const payload = {
      ...v,
      parity_scope: parityScope,
      line_parity_preference: parityScope, // mantém em sync, evita confusão
      operations_profile_completed: true,
    };
    const { error } = await supabase.from("workers").update(payload).eq("id", workerId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil operacional salvo.");
    onSaved?.();
  };

  return (
    <div className="space-y-6">
      {/* Disponibilidade */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Disponibilidade
        </h3>
        <Row label="Aceito dias úteis (seg–sex)">
          <Switch
            checked={v.accepts_weekdays}
            disabled={v.weekends_only}
            onCheckedChange={(b) => set("accepts_weekdays", b)}
          />
        </Row>
        <Row label="Aceito finais de semana (sáb–dom)">
          <Switch checked={v.accepts_weekends} onCheckedChange={(b) => set("accepts_weekends", b)} />
        </Row>
        <Row label="Apenas finais de semana">
          <Switch checked={v.weekends_only} onCheckedChange={toggleWeekendsOnly} />
        </Row>
      </section>

      {/* Papel no time */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Papel no time
        </h3>
        <SegSelect
          value={v.crew_role}
          onChange={(x) => set("crew_role", x)}
          options={["line", "reserve"] as const}
          labelMap={{ line: "Linha (Start)", reserve: "Folguista (reserva)" }}
        />
        {v.crew_role === "reserve" && (
          <>
            <p className="flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Folguistas seguem regra própria de distribuição. A rota par/ímpar não se aplica.
              Você pode receber ofertas de fim de semana com antecedência.
            </p>
            <Row label="Receber ofertas de fim de semana com antecedência">
              <Switch
                checked={v.weekend_offer_advance}
                onCheckedChange={(b) => set("weekend_offer_advance", b)}
              />
            </Row>
          </>
        )}
      </section>

      {/* Rota (somente para Linha) */}
      {v.crew_role === "line" && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Rota
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              A paridade segue o <strong>dia do mês</strong> (não o dia da semana).
            </p>
          </div>
          <div className="space-y-2">
            {ROUTE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => set("parity_scope", o.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  v.parity_scope === o.value
                    ? "border-accent bg-accent/10"
                    : "border-border bg-background hover:border-accent/40"
                }`}
              >
                <p className="text-sm font-semibold">{o.label}</p>
                <p className="text-xs text-muted-foreground">{o.hint}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Preview 7 dias */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Próximos 7 dias
        </h3>
        <div className="grid grid-cols-7 gap-1.5">
          {next7.map(({ date, eligible, isWeekend }, i) => (
            <div
              key={i}
              className={`flex flex-col items-center rounded-lg border px-1 py-2 text-center ${
                eligible
                  ? "border-success/40 bg-success/10"
                  : "border-border bg-secondary/40 text-muted-foreground"
              }`}
            >
              <span className={`text-[10px] uppercase ${isWeekend ? "text-accent" : ""}`}>
                {WEEKDAY_LABEL[date.getDay()]}
              </span>
              <span className="font-mono text-base font-bold leading-tight">{date.getDate()}</span>
              <span className={`text-xs ${eligible ? "text-success" : "text-muted-foreground"}`}>
                {eligible ? "✓" : "—"}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          ✓ elegível para receber ofertas · — fora das suas regras
        </p>
      </section>

      {/* Carga máxima */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <Label>Carga máxima por dia</Label>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            Padrão Umbrella: 12h
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {HOURS_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => set("max_hours_per_day", h)}
              className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                v.max_hours_per_day === h
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-background hover:border-accent/40"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
        {v.max_hours_per_day < 12 && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            Reduzir horas pode diminuir ofertas compatíveis. Contratos com janelas longas podem
            precisar de mais profissionais.
          </p>
        )}
      </section>

      {/* TODO (empresa): quando demanda exigir mais horas/dia do que a rede comporta,
          painel da empresa deve alertar para aumentar slots/mínimos. */}

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
