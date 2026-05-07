TRUNCATE TABLE
  public.execution_events,
  public.shift_executions,
  public.shift_acceptances,
  public.shift_offers,
  public.demand_logs,
  public.demands,
  public.contract_services,
  public.billing_items,
  public.billings,
  public.contracts,
  public.clients,
  public.worker_capacity,
  public.worker_metrics,
  public.workers,
  public.user_roles,
  public.profiles
RESTART IDENTITY CASCADE;

DELETE FROM auth.users;