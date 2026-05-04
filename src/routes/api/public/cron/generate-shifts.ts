import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron-callable endpoint: generates shifts for the next 7 days from active contracts.
export const Route = createFileRoute("/api/public/cron/generate-shifts")({
  server: {
    handlers: {
      POST: async () => {
        const today = new Date();
        const results: { date: string; created: number }[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const dateStr = d.toISOString().slice(0, 10);
          const { data, error } = await supabaseAdmin.rpc("generate_shifts_for_date", { _date: dateStr });
          if (error) {
            return new Response(JSON.stringify({ error: error.message, date: dateStr }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          results.push({ date: dateStr, created: (data as number) ?? 0 });
        }
        return Response.json({ ok: true, results });
      },
    },
  },
});
