import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "gh-export-9q7r2x5k";
const TABLES = [
  "conferences",
  "conference_change_flags",
  "agent_runs",
  "agent_candidates",
  "plans",
  "plan_items",
  "do_not_resurrect",
] as const;

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("t") !== TOKEN) {
          return new Response("Not Found", { status: 404 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const result: Record<string, unknown[]> = {};
        for (const table of TABLES) {
          const { data, error } = await supabaseAdmin
            .from(table)
            .select("*");
          if (error) {
            return new Response(
              JSON.stringify({ table, error: error.message }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
          result[table] = data ?? [];
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
