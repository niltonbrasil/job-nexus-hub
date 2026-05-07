// Motor de Distribuição de Ofertas — constantes canônicas (Prova de Vida).
// Mantém os defaults sincronizados com a função generate_shifts_for_date.

export type PlanLevel = "plano1" | "plano2" | "plano3";
export type Team = "start_impar" | "start_par" | "folguista_impar" | "folguista_par";

export const TEAM_LABEL: Record<Team, string> = {
  start_impar: "Start Ímpar",
  start_par: "Start Par",
  folguista_impar: "Folguista Ímpar",
  folguista_par: "Folguista Par",
};

export type PlanConfig = {
  label: string;
  hours_per_day: number;
  blocks: number;
  prio_per_parity: number; // profissionais Start por paridade
  folguistas_ativos: number; // folguistas ativos por dia
  min_workers: number; // soma mínima esperada
};

export const PLAN_CONFIG: Record<PlanLevel, PlanConfig> = {
  plano1: {
    label: "Plano 1 — 12h",
    hours_per_day: 12,
    blocks: 1,
    prio_per_parity: 1,
    folguistas_ativos: 2,
    min_workers: 4, // 1 ímpar + 1 par + 2 folguistas
  },
  plano2: {
    label: "Plano 2 — 24h (2x12h)",
    hours_per_day: 24,
    blocks: 2,
    prio_per_parity: 2,
    folguistas_ativos: 4,
    min_workers: 8,
  },
  plano3: {
    label: "Plano 3 — 4h",
    hours_per_day: 4,
    blocks: 1,
    prio_per_parity: 1,
    folguistas_ativos: 2,
    min_workers: 4,
  },
};

export const CREDITS_OPTIONS = [
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 180, label: "180 dias" },
];

// Wave config — espelha a RPC. Ajuste em conjunto.
export const WAVE_FOLGUISTA_OPENS_AHEAD_DAYS = 7; // antecedência fim de semana
export const WAVE_START_DELAY_HOURS = 1;
