import { createServerFn } from "@tanstack/react-start";

/**
 * Hard-deletes every row from the conference-related tables so the user can
 * re-run the discovery agent from a clean slate. Used by Settings → "State A".
 */
export const wipeConferences = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Order matters: children before parents.
  const tables = [
    "plan_items",
    "conference_change_flags",
    "agent_candidates",
    "agent_runs",
    "conferences",
  ] as const;
  for (const table of tables) {
    const { error } = await supabaseAdmin.from(table).delete().not("id", "is", null);
    if (error) throw new Error(`Failed to wipe ${table}: ${error.message}`);
  }
  return { ok: true };
});
