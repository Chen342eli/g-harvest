import { createFileRoute } from "@tanstack/react-router";
import { runDiscoveryAgent } from "@/lib/agent.server";

// Public endpoint hit by pg_cron weekly. Auth = Supabase anon `apikey`
// header is checked by the edge layer for /api/public/*; we still log
// the call for traceability.
export const Route = createFileRoute("/api/public/agent/run")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runDiscoveryAgent("cron");
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
