# Reconciliação Financeira — Ganhos (worker) × Billing (empresa)

Este documento descreve como reconciliar o que o **profissional** vê em
"Ganhos" com o que a **empresa** consolida em `billings` / `billing_items`.

## Modelo

- **Ganhos do worker** = soma das **execuções `completed`** do worker ×
  **taxa aplicada no checkout** (snapshot em `shift_executions.applied_amount`).
- **Billing da empresa** = `generate_monthly_billing()` agrega as mesmas
  execuções por contrato/período em `billing_items.amount`.

Snapshot armazenado em `shift_executions`:

| Coluna                  | Origem                                          |
|-------------------------|-------------------------------------------------|
| `applied_hours`         | `hours_worked` no momento do checkout           |
| `applied_rate_per_hour` | `contract_services.price_per_hour` no checkout  |
| `applied_amount`        | `ROUND(applied_hours * applied_rate_per_hour,2)`|
| `currency`              | `'BRL'` (default)                               |

Itens antigos (sem snapshot) usam fallback `hours_required × price_per_hour`
e aparecem na UI como **estimado · legado**.

## Query de reconciliação

```sql
-- Ganhos worker (snapshot) × billing_items por execução, no período/contrato.
WITH params AS (
  SELECT date '2026-05-01' AS p_start,
         date '2026-05-31' AS p_end,
         '<CONTRACT_UUID>'::uuid AS contract_id   -- troque pelo UUID real
),
execs AS (
  SELECT
    e.id   AS execution_id,
    w.id   AS worker_id,
    w.name AS worker_name,
    COALESCE(
      e.applied_amount,
      COALESCE(e.hours_worked, 0) * COALESCE(cs.price_per_hour, 0)
    ) AS ganho_execucao,
    (e.applied_amount IS NULL) AS legado
  FROM shift_executions e
  JOIN shift_acceptances a  ON a.id  = e.acceptance_id
  JOIN workers w            ON w.id  = a.worker_id
  JOIN shift_offers o       ON o.id  = a.offer_id
  JOIN demands d            ON d.id  = o.demand_id
  JOIN contract_services cs ON cs.id = d.contract_service_id
  JOIN params p ON cs.contract_id = p.contract_id
              AND d.date BETWEEN p.p_start AND p.p_end
  WHERE e.status = 'completed'
),
bi AS (
  SELECT execution_id, SUM(amount) AS billed_amount
  FROM billing_items
  GROUP BY execution_id
)
SELECT
  e.worker_id,
  e.worker_name,
  COUNT(*)                                          AS execucoes,
  SUM(CASE WHEN e.legado THEN 1 ELSE 0 END)         AS execucoes_legado,
  ROUND(SUM(e.ganho_execucao), 2)                   AS ganhos_worker,
  ROUND(COALESCE(SUM(bi.billed_amount), 0), 2)      AS billing_items_amount,
  ROUND(SUM(e.ganho_execucao)
        - COALESCE(SUM(bi.billed_amount), 0), 2)    AS diff
FROM execs e
LEFT JOIN bi ON bi.execution_id = e.execution_id
GROUP BY e.worker_id, e.worker_name
ORDER BY ABS(
  SUM(e.ganho_execucao) - COALESCE(SUM(bi.billed_amount), 0)
) DESC;
```

## Como interpretar

| Situação                                                | Diagnóstico                                                |
|---------------------------------------------------------|-------------------------------------------------------------|
| `diff = 0`                                              | Reconciliado.                                               |
| `diff > 0` e `billing_items_amount = 0`                 | Execuções ainda não foram consolidadas. Rodar `generate_monthly_billing(period_start)`. |
| `diff ≠ 0` e `execucoes_legado > 0`                     | Esperado se `price_per_hour` mudou após o trabalho (sem snapshot na época). |
| `diff ≠ 0` e `execucoes_legado = 0`                     | Bug — investigar `applied_*` ou duplicidade em `billing_items`. |

## Variantes úteis

- **Só o já faturado:** trocar `LEFT JOIN bi` por `JOIN bi` (inner).
- **Reconciliar pelo período do billing** (não `d.date`):

  ```sql
  JOIN billings b
    ON b.contract_id = cs.contract_id
   AND d.date BETWEEN b.period_start AND b.period_end
   AND b.period_start = (SELECT p_start FROM params)
  ```

## Exemplo numérico

- Demand 12h, `hours_worked = 11.5`, `price_per_hour = 35.00` no checkout.
- Snapshot: `applied_hours=11.50`, `applied_rate_per_hour=35.00`,
  `applied_amount=402.50`.
- Se o contrato passar para R$ 40/h depois, o worker continua vendo
  R$ 402,50 e `billing_items.amount = 402,50` para essa execução.
