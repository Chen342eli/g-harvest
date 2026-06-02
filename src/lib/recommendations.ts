// Coverage-gap recommendations for the planning workspace.
// Pure functions over plan items + catalog. No I/O, no AI.

import type { Conference, Region, Vertical } from "./conferences";
import { REGIONS, VERTICALS } from "./conferences";
import {
  isCommitted,
  isInPipeline,
  type Plan,
  type PlanItemWithConference,
} from "./planning";



export interface GapRecommendation {
  id: string;
  // Why we're suggesting this — region/vertical/calendar/budget-friendly
  kind: "region_gap" | "vertical_gap" | "calendar_gap" | "budget_friendly";
  title: string;
  detail: string;
  conferenceIds: string[];
}

export interface CalendarConflict {
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  overlapStart: string;
  overlapEnd: string;
}

const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"] as const;

function quarterOf(date: string): 0 | 1 | 2 | 3 {
  const m = new Date(date).getUTCMonth();
  return Math.floor(m / 3) as 0 | 1 | 2 | 3;
}

function fitScore(c: Conference): number {
  // Higher icp + cheaper = better.
  return c.icpScore;
}

function sortByFitThenCost(
  conferences: (Conference & { estimatedCostUsd: number | null })[],
): (Conference & { estimatedCostUsd: number | null })[] {
  return [...conferences].sort((a, b) => {
    const f = fitScore(b) - fitScore(a);
    if (f !== 0) return f;
    const ac = a.estimatedCostUsd ?? Number.POSITIVE_INFINITY;
    const bc = b.estimatedCostUsd ?? Number.POSITIVE_INFINITY;
    return ac - bc;
  });
}

/**
 * Build the "what should I add next?" list.
 *
 * Input: every conference in the catalog + the current plan items + the plan config.
 * Output: a ranked list of gap recommendations. Conferences already in the plan
 * (any status) are excluded from suggestions.
 */
export function buildRecommendations(args: {
  allConferences: (Conference & { estimatedCostUsd: number | null })[];
  items: PlanItemWithConference[];
  plan: Plan;
  planYear: number;
}): GapRecommendation[] {
  const { allConferences, items, planYear } = args;

  const inPlanIds = new Set(items.map((i) => i.conferenceId));
  const candidates = allConferences.filter(
    (c) =>
      !inPlanIds.has(c.id) &&
      new Date(c.startDate).getUTCFullYear() === planYear,
  );

  const committed = items.filter((i) => isCommitted(i.planStatus));


  const recommendations: GapRecommendation[] = [];

  // 1. Region gaps — regions with 0 committed coverage
  const committedRegions = new Set(committed.map((i) => i.conference.region));
  for (const region of REGIONS) {
    if (committedRegions.has(region)) continue;
    const inRegion = candidates.filter((c) => c.region === region);
    if (inRegion.length === 0) continue;
    const top = sortByFitThenCost(inRegion).slice(0, 3);
    recommendations.push({
      id: `region_gap:${region}`,
      kind: "region_gap",
      title: `Recommendations to close the gap in ${region}`,
      detail: `${inRegion.length} candidate${inRegion.length === 1 ? "" : "s"} available. Top picks below.`,
      conferenceIds: top.map((c) => c.id),
    });
  }

  // 2. Vertical gaps — verticals where the catalog has options but plan has 0 committed
  const committedVerticals = new Set(committed.map((i) => i.conference.vertical));
  const catalogVerticals = new Set(allConferences.map((c) => c.vertical));
  for (const vertical of VERTICALS) {
    if (!catalogVerticals.has(vertical)) continue;
    if (committedVerticals.has(vertical)) continue;
    const inVertical = candidates.filter((c) => c.vertical === vertical);
    if (inVertical.length === 0) continue;
    const top = sortByFitThenCost(inVertical).slice(0, 3);
    recommendations.push({
      id: `vertical_gap:${vertical}`,
      kind: "vertical_gap",
      title: `No coverage for ${vertical}`,
      detail: `${inVertical.length} candidate${inVertical.length === 1 ? "" : "s"} in the catalog.`,
      conferenceIds: top.map((c) => c.id),
    });
  }

  // 3. Calendar gaps — quarters with no committed conferences
  const committedQuarters = new Set(committed.map((i) => quarterOf(i.conference.startDate)));
  for (let q = 0; q < 4; q++) {
    if (committedQuarters.has(q as 0 | 1 | 2 | 3)) continue;
    const inQuarter = candidates.filter((c) => quarterOf(c.startDate) === q);
    if (inQuarter.length === 0) continue;
    const top = sortByFitThenCost(inQuarter).slice(0, 3);
    recommendations.push({
      id: `calendar_gap:${q}`,
      kind: "calendar_gap",
      title: `Quiet quarter — ${QUARTER_LABELS[q]} ${planYear}`,
      detail: `No committed conferences in ${QUARTER_LABELS[q]}. ${inQuarter.length} option${inQuarter.length === 1 ? "" : "s"} to fill the gap.`,
      conferenceIds: top.map((c) => c.id),
    });
  }


  return recommendations;
}

/** Pairs of in-pipeline conferences with overlapping date ranges. */
export function findCalendarConflicts(items: PlanItemWithConference[]): CalendarConflict[] {
  const inPipeline = items.filter((i) => isInPipeline(i.planStatus));
  const conflicts: CalendarConflict[] = [];
  for (let i = 0; i < inPipeline.length; i++) {
    for (let j = i + 1; j < inPipeline.length; j++) {
      const a = inPipeline[i].conference;
      const b = inPipeline[j].conference;
      const aStart = new Date(a.startDate).getTime();
      const aEnd = new Date(a.endDate).getTime();
      const bStart = new Date(b.startDate).getTime();
      const bEnd = new Date(b.endDate).getTime();
      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);
      if (overlapStart > overlapEnd) continue;
      conflicts.push({
        aId: a.id,
        bId: b.id,
        aName: a.name,
        bName: b.name,
        overlapStart: new Date(overlapStart).toISOString().slice(0, 10),
        overlapEnd: new Date(overlapEnd).toISOString().slice(0, 10),
      });
    }
  }
  return conflicts;
}

// Re-export so consumers don't need to import from two places
export type { Region, Vertical } from "./conferences";
