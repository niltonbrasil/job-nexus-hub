TRUNCATE TABLE
  public.billing_items,
  public.billings,
  public.execution_events,
  public.shift_executions,
  public.shift_acceptances,
  public.shift_offers,
  public.demand_logs,
  public.demands,
  public.contract_services,
  public.contracts,
  public.clients,
  public.worker_capacity,
  public.worker_metrics
RESTART IDENTITY CASCADE;