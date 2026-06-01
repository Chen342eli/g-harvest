import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDiscoveryAgent } from "./agent.server";

export const runAgentNow = createServerFn({ method: "POST" }).handler(async () => {
  return runDiscoveryAgent("manual");
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
