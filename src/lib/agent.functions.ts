import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDiscoveryAgent } from "./agent.server";

export const runAgentNow = createServerFn({ method: "POST" }).handler(async () => {
  return runDiscoveryAgent("manual");
});

export const cancelRunningAgent = createServerFn({ method: "POST" }).handler(async () => {
  const { data: runningRuns, error: selectError } = await supabaseAdmin
    .from("agent_runs")
    .select("id, started_at")
    .eq("status", "running")
  if (selectError) throw new Error(selectError.message);

  const now = Date.now();
  const finishedAt = new Date(now).toISOString();
  const runs = runningRuns ?? [];

  for (const run of runs) {
    const startedAt = new Date(run.started_at).getTime();
    const { error } = await supabaseAdmin
      .from("agent_runs")
      .update({
        cancel_requested: true,
        status: "cancelled",
        finished_at: finishedAt,
        duration_ms: Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : null,
      })
      .eq("id", run.id);
    if (error) throw new Error(error.message);
  }

  return { cancelled: runs.length };
});

export const listAgentRuns = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("agent_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listRunCandidates = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("agent_candidates")
      .select("*")
      .eq("run_id", data.runId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getLastRun = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("agent_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
});

export const listChangeFlags = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("conference_change_flags")
    .select("*, conferences(name, city)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const resolveFlag = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["accept", "dismiss"]),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    if (data.action === "accept") {
      const { data: flag } = await supabaseAdmin
        .from("conference_change_flags")
        .select("conference_id, field, new_value")
        .eq("id", data.id)
        .single();
      if (flag) {
        const update = { [flag.field as string]: flag.new_value } as never;
        await supabaseAdmin.from("conferences").update(update).eq("id", flag.conference_id);
      }
    }
    await supabaseAdmin
      .from("conference_change_flags")
      .update({ status: data.action === "accept" ? "accepted" : "dismissed" })
      .eq("id", data.id);
    return { ok: true };
  });
