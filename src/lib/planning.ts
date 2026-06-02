// Shared planning types — used by both server and client code.

import type { Conference, Region, Vertical } from "./conferences";

export type PlanItemStatus = "must_go" | "shortlist" | "considering" | "approved" | "dropped";
export type CostConfidence = "estimated" | "quoted" | "actual";

export const PLAN_ITEM_STATUSES: PlanItemStatus[] = [
  "must_go",
  "shortlist",
  "considering",
  "approved",
  "dropped",
];

export const PLAN_ITEM_STATUS_LABEL: Record<PlanItemStatus, string> = {
  must_go: "Must-go",
  shortlist: "Shortlist",
  considering: "Considering",
  approved: "Approved",
  dropped: "Dropped",
};

// Status order — leftmost is "most committed", rightmost is "out".
export const PLAN_ITEM_STATUS_ORDER: PlanItemStatus[] = [
  "must_go",
  "approved",
  "shortlist",
  "considering",
  "dropped",
];

/** Counted toward committed budget (will-attend). */
export function isCommitted(s: PlanItemStatus): boolean {
  return s === "must_go" || s === "approved";
}

/** Counted toward "what if we approve everything reasonable" projection. */
export function isInPipeline(s: PlanItemStatus): boolean {
  return s === "must_go" || s === "approved" || s === "shortlist";
}

export interface Plan {
  id: string;
  name: string;
  year: number;
  annualBudgetUsd: number;
  plannedRepsPerConference: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PlanItem {
  id: string;
  planId: string;
  conferenceId: string;
  planStatus: PlanItemStatus;
  plannedRepsOverride: number | null;
  estimatedCostOverride: number | null;
  mustGoLockedAt: string | null;
  notes: string | null;
}

export interface PlanItemWithConference extends PlanItem {
  conference: Conference & { estimatedCostUsd: number | null; costConfidence: CostConfidence | null };
}

/** Effective per-conference cost = override or base × reps. */
export function effectiveItemCost(
  item: PlanItemWithConference,
  plan: Pick<Plan, "plannedRepsPerConference">,
): number {
  const baseCost = item.estimatedCostOverride ?? item.conference.estimatedCostUsd;
  if (baseCost == null) return 0;
  const reps = item.plannedRepsOverride ?? plan.plannedRepsPerConference;
  return baseCost * reps;
}

export interface PlanTotals {
  mustGo: number;
  committed: number; // must-go + approved
  pipeline: number; // committed + shortlist
  remaining: number; // budget - committed
  pipelineOverrun: number; // pipeline - budget (positive = over budget)
  itemsMissingCost: number; // count of in-pipeline items with no cost
}

export function computePlanTotals(items: PlanItemWithConference[], plan: Plan): PlanTotals {
  let mustGo = 0;
  let committed = 0;
  let pipeline = 0;
  let itemsMissingCost = 0;

  for (const item of items) {
    const cost = effectiveItemCost(item, plan);
    if (item.planStatus === "must_go") {
      mustGo += cost;
      committed += cost;
      pipeline += cost;
    } else if (item.planStatus === "approved") {
      committed += cost;
      pipeline += cost;
    } else if (item.planStatus === "shortlist") {
      pipeline += cost;
    }
    if (isInPipeline(item.planStatus)) {
      const hasCost = (item.estimatedCostOverride ?? item.conference.estimatedCostUsd) != null;
      if (!hasCost) itemsMissingCost++;
    }
  }

  return {
    mustGo,
    committed,
    pipeline,
    remaining: plan.annualBudgetUsd - committed,
    pipelineOverrun: pipeline - plan.annualBudgetUsd,
    itemsMissingCost,
  };
}

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `${n < 0 ? "-" : ""}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  }
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}

/** Buckets for region coverage. Travel/SaaS-specific sub-grouping isn't needed here. */
export interface CoverageBucket {
  key: string;
  committed: number;
  pipeline: number;
  total: number;
}

export function regionCoverage(
  items: PlanItemWithConference[],
  allRegions: Region[],
): CoverageBucket[] {
  return allRegions.map((r) => {
    let committed = 0;
    let pipeline = 0;
    let total = 0;
    for (const it of items) {
      if (it.conference.region !== r) continue;
      total++;
      if (isCommitted(it.planStatus)) committed++;
      if (isInPipeline(it.planStatus)) pipeline++;
    }
    return { key: r, committed, pipeline, total };
  });
}

export function verticalCoverage(
  items: PlanItemWithConference[],
  allVerticals: Vertical[],
): CoverageBucket[] {
  return allVerticals.map((v) => {
    let committed = 0;
    let pipeline = 0;
    let total = 0;
    for (const it of items) {
      if (it.conference.vertical !== v) continue;
      total++;
      if (isCommitted(it.planStatus)) committed++;
      if (isInPipeline(it.planStatus)) pipeline++;
    }
    return { key: v, committed, pipeline, total };
  });
}
