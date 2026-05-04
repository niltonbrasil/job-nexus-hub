import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Runs on the 1st of each month: consolidates last month's executions into billings.
export const Route = createFileRoute("/api/public/cron/monthly-billing")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstOfLastMonth = new Date(firstOfThisMonth);
        firstOfLastMonth.setMonth(firstOfLastMonth.getMonth() - 1);
        const periodStart = firstOfLastMonth.toISOString().slice(0, 10);

        const { data, error } = await supabaseAdmin.rpc("generate_monthly_billing", {
          _period_start: periodStart,
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return Response.json({ ok: true, period_start: periodStart, billings_created: data });
      },
    },
  },
});
