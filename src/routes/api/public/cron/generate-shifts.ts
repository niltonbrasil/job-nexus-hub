import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron-callable endpoint: generates shifts for the next 7 days from active contracts.
export const Route = createFileRoute("/api/public/cron/generate-shifts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || token !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const fmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const todaySP = fmt.format(new Date());
        const [y, m, dd] = todaySP.split("-").map(Number);
        const results: { date: string; created: number }[] = [];
        for (let i = 0; i < 7; i++) {
          const base = new Date(Date.UTC(y, m - 1, dd + i, 12, 0, 0));
          const dateStr = fmt.format(base);
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
