import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rowToConference, type ConferenceRow } from "./conferences-mapper";
import { computeScoring } from "./scoring";
import type { Region, Vertical } from "./conferences";

export const listConferences = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("conferences")
    .select("*")
    .is("deleted_at", null)
    .order("start_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ConferenceRow[]).map(rowToConference);
});

export const setStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["Considering", "Going", "Passed"]),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("conferences")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleRep = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), rep: z.string().min(1) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { data: row, error: e1 } = await supabaseAdmin
      .from("conferences")
      .select("assigned_reps")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    const current = (row?.assigned_reps as string[]) ?? [];
    const next = current.includes(data.rep)
      ? current.filter((r) => r !== data.rep)
      : [...current, data.rep];
    const { error: e2 } = await supabaseAdmin
      .from("conferences")
      .update({ assigned_reps: next })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  city: z.string(),
  country: z.string(),
  region: z.enum(["North America", "Europe", "APAC", "Middle East", "LATAM"]),
  vertical: z.enum(["Payments", "Fintech", "Treasury", "Travel", "SaaS", "General Tech"]),
  estimatedAudienceSize: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  sourceUrl: z.string().url(),
});

export const updateConference = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => UpdateSchema.parse(i))
  .handler(async ({ data }) => {
    const s = computeScoring({
      vertical: data.vertical as Vertical,
      region: data.region as Region,
      audienceSize: data.estimatedAudienceSize,
      tags: data.tags,
    });
    const { error } = await supabaseAdmin
      .from("conferences")
      .update({
        name: data.name,
        start_date: data.startDate,
        end_date: data.endDate,
        city: data.city,
        country: data.country,
        region: data.region,
        vertical: data.vertical,
        estimated_audience_size: data.estimatedAudienceSize,
        tags: data.tags,
        source_url: data.sourceUrl,
        ...s,
        // hand-edited rows become 'verified'
        provenance: "verified",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const softDeleteConference = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), addToBlocklist: z.boolean().default(true) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("conferences")
      .select("name, start_date, city")
      .eq("id", data.id)
      .single();
    if (row && data.addToBlocklist) {
      await supabaseAdmin.from("do_not_resurrect").insert({
        name_lower: row.name.toLowerCase(),
        year: new Date(row.start_date).getUTCFullYear(),
        city_lower: row.city.toLowerCase(),
        reason: "User removed",
      });
    }
    await supabaseAdmin.from("conferences").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });
