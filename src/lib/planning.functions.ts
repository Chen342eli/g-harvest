import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rowToConference, type ConferenceRow } from "./conferences-mapper";
import type {
  CostConfidence,
  Plan,
  PlanItem,
  PlanItemStatus,
  PlanItemWithConference,
} from "./planning";

interface PlanRow {
  id: string;
  name: string;
  year: number;
  annual_budget_usd: number | string;
  planned_reps_per_conference: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface PlanItemRow {
  id: string;
  plan_id: string;
  conference_id: string;
  plan_status: PlanItemStatus;
  planned_reps_override: number | null;
  estimated_cost_override: number | string | null;
  must_go_locked_at: string | null;
  notes: string | null;
}

function rowToPlan(r: PlanRow): Plan {
  return {
    id: r.id,
    name: r.name,
    year: r.year,
    annualBudgetUsd: Number(r.annual_budget_usd),
    plannedRepsPerConference: r.planned_reps_per_conference,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
  };
}

function rowToPlanItem(r: PlanItemRow): PlanItem {
  return {
    id: r.id,
    planId: r.plan_id,
    conferenceId: r.conference_id,
    planStatus: r.plan_status,
    plannedRepsOverride: r.planned_reps_override,
    estimatedCostOverride: r.estimated_cost_override == null ? null : Number(r.estimated_cost_override),
    mustGoLockedAt: r.must_go_locked_at,
    notes: r.notes,
  };
}

type ConferenceRowWithCost = ConferenceRow & {
  estimated_cost_usd: number | string | null;
  cost_confidence: CostConfidence | null;
  cost_notes: string | null;
};

function rowToConferenceWithCost(r: ConferenceRowWithCost) {
  const base = rowToConference(r);
  return {
    ...base,
    estimatedCostUsd: r.estimated_cost_usd == null ? null : Number(r.estimated_cost_usd),
    costConfidence: r.cost_confidence,
    costNotes: r.cost_notes,
  };
}

export const getActivePlan = createServerFn({ method: "GET" }).handler(async () => {
  const { data: planRow, error: e1 } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!planRow) return null;

  const plan = rowToPlan(planRow as PlanRow);

  const { data: itemRows, error: e2 } = await supabaseAdmin
    .from("plan_items")
    .select("*")
    .eq("plan_id", plan.id);
  if (e2) throw new Error(e2.message);

  const confIds = (itemRows ?? []).map((r) => (r as PlanItemRow).conference_id);
  if (confIds.length === 0) {
    return { plan, items: [] as PlanItemWithConference[] };
  }

  const { data: confRows, error: e3 } = await supabaseAdmin
    .from("conferences")
    .select("*")
    .in("id", confIds);
  if (e3) throw new Error(e3.message);

  const confById = new Map<string, ReturnType<typeof rowToConferenceWithCost>>();
  for (const c of (confRows ?? []) as ConferenceRowWithCost[]) {
    confById.set(c.id, rowToConferenceWithCost(c));
  }

  const items: PlanItemWithConference[] = [];
  for (const r of itemRows ?? []) {
    const item = rowToPlanItem(r as PlanItemRow);
    const conf = confById.get(item.conferenceId);
    if (!conf) continue;
    // The conference type here also carries `provenance` from the mapper, but
    // PlanItemWithConference only requires the cost fields. Extra fields are fine.
    items.push({ ...item, conference: conf } as PlanItemWithConference);
  }

  return { plan, items };
});

export const listAllConferencesWithCost = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("conferences")
    .select("*")
    .is("deleted_at", null)
    .order("start_date", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ConferenceRowWithCost[]).map(rowToConferenceWithCost);
});

const PlanStatusEnum = z.enum(["must_go", "shortlist", "considering", "approved", "dropped"]);

export const setPlanItemStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        conferenceId: z.string().uuid(),
        planStatus: PlanStatusEnum,
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    // Upsert: if item doesn't exist for this conference in this plan, create it.
    const { data: existing } = await supabaseAdmin
      .from("plan_items")
      .select("id")
      .eq("plan_id", data.planId)
      .eq("conference_id", data.conferenceId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("plan_items")
        .update({ plan_status: data.planStatus })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("plan_items")
        .insert({
          plan_id: data.planId,
          conference_id: data.conferenceId,
          plan_status: data.planStatus,
        });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeFromPlan = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ planId: z.string().uuid(), conferenceId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("plan_items")
      .delete()
      .eq("plan_id", data.planId)
      .eq("conference_id", data.conferenceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePlanConfig = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        annualBudgetUsd: z.number().nonnegative().optional(),
        plannedRepsPerConference: z.number().int().min(1).max(20).optional(),
        name: z.string().min(1).max(120).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const patch: {
      annual_budget_usd?: number;
      planned_reps_per_conference?: number;
      name?: string;
    } = {};
    if (data.annualBudgetUsd !== undefined) patch.annual_budget_usd = data.annualBudgetUsd;
    if (data.plannedRepsPerConference !== undefined)
      patch.planned_reps_per_conference = data.plannedRepsPerConference;
    if (data.name !== undefined) patch.name = data.name;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("plans")
      .update(patch)
      .eq("id", data.planId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePlanItemDetails = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        planItemId: z.string().uuid(),
        plannedRepsOverride: z.number().int().min(1).max(20).nullable().optional(),
        estimatedCostOverride: z.number().nonnegative().nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const patch: Record<string, unknown> = {};
    if (data.plannedRepsOverride !== undefined) patch.planned_reps_override = data.plannedRepsOverride;
    if (data.estimatedCostOverride !== undefined) patch.estimated_cost_override = data.estimatedCostOverride;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("plan_items")
      .update(patch)
      .eq("id", data.planItemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateConferenceCost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        conferenceId: z.string().uuid(),
        estimatedCostUsd: z.number().nonnegative().nullable(),
        costConfidence: z.enum(["estimated", "quoted", "actual"]).nullable(),
        costNotes: z.string().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("conferences")
      .update({
        estimated_cost_usd: data.estimatedCostUsd,
        cost_confidence: data.costConfidence,
        cost_notes: data.costNotes ?? null,
      })
      .eq("id", data.conferenceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
