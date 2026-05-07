import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { OperationsProfileForm, type OperationsProfile } from "@/components/OperationsProfileForm";
import { BrandMark } from "@/components/BrandMark";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app_/profile/operations")({
  head: () => ({ meta: [{ title: "Perfil operacional — Umbrella" }] }),
  component: OperationsPage,
});

function OperationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [initial, setInitial] = useState<Partial<OperationsProfile> | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    (async () => {
      let { data: w } = await supabase
        .from("workers")
        .select("id, accepts_weekdays, accepts_weekends, weekends_only, parity_scope, crew_role, line_parity_preference, weekend_offer_advance, max_hours_per_day, operations_profile_completed, name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!w) {
        const { data: created } = await supabase
          .from("workers")
          .insert({
            user_id: user.id,
            name: user.user_metadata?.full_name ?? user.email ?? "Profissional",
            email: user.email,
          })
          .select("id, accepts_weekdays, accepts_weekends, weekends_only, parity_scope, crew_role, line_parity_preference, weekend_offer_advance, max_hours_per_day, operations_profile_completed")
          .maybeSingle();
        w = created as typeof w;
      }
      if (w) {
        setWorkerId(w.id);
        setCompleted(w.operations_profile_completed);
        setInitial({
          accepts_weekdays: w.accepts_weekdays,
          accepts_weekends: w.accepts_weekends,
          weekends_only: w.weekends_only,
          parity_scope: w.parity_scope as OperationsProfile["parity_scope"],
          crew_role: w.crew_role as OperationsProfile["crew_role"],
          line_parity_preference: w.line_parity_preference as OperationsProfile["parity_scope"],
          weekend_offer_advance: w.weekend_offer_advance,
          max_hours_per_day: w.max_hours_per_day,
        });
      }
    })();
  }, [user, loading, navigate]);

  if (loading || !user || !workerId || !initial) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <BrandMark />
      <div className="mt-6">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          {completed ? "Editar perfil" : "Onboarding"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Perfil operacional</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina sua disponibilidade. Isso filtra as ofertas que você verá.
        </p>
      </div>
      <div className="mt-6">
        <OperationsProfileForm
          workerId={workerId}
          initial={initial}
          submitLabel={completed ? "Salvar alterações" : "Concluir e ir para o hub"}
          onSaved={() => navigate({ to: "/app" })}
        />
      </div>
    </div>
  );
}
