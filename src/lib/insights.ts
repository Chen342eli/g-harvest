import type { Conference, Vertical, Region } from "./conferences";
import { VERTICALS } from "./conferences";

export const THRESHOLDS = {
  highIcp: 80,
  verticalConcentration: 0.7,
  regionConcentration: 0.8,
  tripDays: 14,
  clusterDays: 30,
  clusterMin: 3,
} as const;

export type InsightSeverity = "warn" | "info";
export type InsightCategory = "ownership" | "coverage" | "concentration" | "trip";

export type InsightAction =
  | { kind: "filter-ids"; ids: string[] }
  | { kind: "filter-vertical"; vertical: Vertical }
  | { kind: "filter-region"; region: Region }
  | { kind: "filter-gaps" };

export interface Insight {
  id: string;
  severity: InsightSeverity;
  category: InsightCategory;
  title: string;
  detail: string;
  conferenceIds: string[];
  action?: InsightAction;
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / 86_400_000);
}

export function evaluateInsights(conferences: Conference[]): Insight[] {
  const insights: Insight[] = [];
  const going = conferences.filter((c) => c.status === "Going");

  // Rule 1 — High-ICP without owner (only for Going, that's the actionable gap)
  for (const c of conferences) {
    if (c.icpScore >= THRESHOLDS.highIcp && c.status === "Going" && c.assignedReps.length === 0) {
      insights.push({
        id: `no-owner:${c.id}`,
        severity: "warn",
        category: "ownership",
        title: `${c.name} has no assigned rep`,
        detail: `High-priority conference (ICP ${c.icpScore}) is marked Going but unstaffed.`,
        conferenceIds: [c.id],
        action: { kind: "filter-ids", ids: [c.id] },
      });
    }
  }

  // Rule 2 — High-ICP not planned
  const notPlanned = conferences.filter(
    (c) => c.icpScore >= THRESHOLDS.highIcp && c.status !== "Going",
  );
  if (notPlanned.length > 0) {
    insights.push({
      id: "high-icp-not-going",
      severity: "warn",
      category: "coverage",
      title: `${notPlanned.length} top-tier conference${notPlanned.length === 1 ? "" : "s"} not planned`,
      detail: `ICP ≥ ${THRESHOLDS.highIcp} but status is not "Going". Review and decide.`,
      conferenceIds: notPlanned.map((c) => c.id),
      action: { kind: "filter-ids", ids: notPlanned.map((c) => c.id) },
    });
  }

  // Rule 3 — Vertical with no planned coverage (only flag verticals present in dataset)
  const presentVerticals = new Set(conferences.map((c) => c.vertical));
  const goingVerticals = new Set(going.map((c) => c.vertical));
  for (const v of VERTICALS) {
    if (!presentVerticals.has(v)) continue;
    if (!goingVerticals.has(v)) {
      const candidates = conferences
        .filter((c) => c.vertical === v)
        .sort((a, b) => b.icpScore - a.icpScore);
      insights.push({
        id: `no-coverage:${v}`,
        severity: "warn",
        category: "coverage",
        title: `No planned coverage for ${v}`,
        detail: `Zero conferences in ${v} are marked Going. ${candidates.length} candidate${candidates.length === 1 ? "" : "s"} available.`,
        conferenceIds: candidates.map((c) => c.id),
        action: { kind: "filter-vertical", vertical: v },
      });
    }
  }

  if (going.length >= 3) {
    // Rule 4 — vertical concentration
    const vCounts = new Map<Vertical, number>();
    going.forEach((c) => vCounts.set(c.vertical, (vCounts.get(c.vertical) ?? 0) + 1));
    for (const [v, n] of vCounts) {
      const share = n / going.length;
      if (share > THRESHOLDS.verticalConcentration) {
        insights.push({
          id: `concentration-vertical:${v}`,
          severity: "info",
          category: "concentration",
          title: `Strategy is concentrated in ${v}`,
          detail: `${Math.round(share * 100)}% of Going conferences are ${v}. Consider diversifying.`,
          conferenceIds: going.filter((c) => c.vertical === v).map((c) => c.id),
          action: { kind: "filter-vertical", vertical: v },
        });
      }
    }

    // Rule 5 — region concentration
    const rCounts = new Map<Region, number>();
    going.forEach((c) => rCounts.set(c.region, (rCounts.get(c.region) ?? 0) + 1));
    for (const [r, n] of rCounts) {
      const share = n / going.length;
      if (share > THRESHOLDS.regionConcentration) {
        insights.push({
          id: `concentration-region:${r}`,
          severity: "warn",
          category: "concentration",
          title: `Planned attendance concentrated in ${r}`,
          detail: `${Math.round(share * 100)}% of Going conferences are in ${r}.`,
          conferenceIds: going.filter((c) => c.region === r).map((c) => c.id),
          action: { kind: "filter-region", region: r },
        });
      }
    }
  }

  // Rule 6 — trip pairs (same city, ≤ tripDays apart, both Going or Considering)
  const tripCandidates = conferences.filter((c) => c.status !== "Passed");
  const seenPairs = new Set<string>();
  for (let i = 0; i < tripCandidates.length; i++) {
    for (let j = i + 1; j < tripCandidates.length; j++) {
      const a = tripCandidates[i];
      const b = tripCandidates[j];
      if (a.city !== b.city || a.country !== b.country) continue;
      const gap = daysBetween(a.endDate, b.startDate);
      const gap2 = daysBetween(b.endDate, a.startDate);
      const d = Math.min(gap, gap2);
      if (d > THRESHOLDS.tripDays) continue;
      const key = [a.id, b.id].sort().join("|");
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      insights.push({
        id: `trip:${key}`,
        severity: "info",
        category: "trip",
        title: `Trip opportunity in ${a.city}`,
        detail: `${a.name} and ${b.name} are ~${d} day${d === 1 ? "" : "s"} apart — combine into a single trip.`,
        conferenceIds: [a.id, b.id],
        action: { kind: "filter-ids", ids: [a.id, b.id] },
      });
    }
  }

  // Rule 7 — country cluster (≥ clusterMin events within clusterDays window)
  const byCountry = new Map<string, Conference[]>();
  conferences.forEach((c) => {
    const arr = byCountry.get(c.country) ?? [];
    arr.push(c);
    byCountry.set(c.country, arr);
  });
  const seenClusters = new Set<string>();
  for (const [country, list] of byCountry) {
    if (list.length < THRESHOLDS.clusterMin) continue;
    const sorted = [...list].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
    for (let i = 0; i <= sorted.length - THRESHOLDS.clusterMin; i++) {
      const window = [sorted[i]];
      for (let j = i + 1; j < sorted.length; j++) {
        if (daysBetween(sorted[i].startDate, sorted[j].startDate) <= THRESHOLDS.clusterDays) {
          window.push(sorted[j]);
        }
      }
      if (window.length >= THRESHOLDS.clusterMin) {
        const key = window.map((c) => c.id).sort().join("|");
        if (seenClusters.has(key)) continue;
        seenClusters.add(key);
        const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long" });
        insights.push({
          id: `cluster:${country}:${key}`,
          severity: "info",
          category: "trip",
          title: `${window.length} events in ${country}`,
          detail: `${country} hosts ${window.length} conferences around ${monthFmt.format(new Date(window[0].startDate))}. Plan a regional swing.`,
          conferenceIds: window.map((c) => c.id),
          action: { kind: "filter-ids", ids: window.map((c) => c.id) },
        });
        break; // one cluster per country is enough
      }
    }
  }

  // sort: warn first, then by category for stability
  return insights.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "warn" ? -1 : 1;
    return a.category.localeCompare(b.category);
  });
}

export interface CoverageMix<T extends string> {
  key: T;
  count: number;
  share: number;
}

export function mixBy<T extends string>(items: Conference[], pick: (c: Conference) => T): CoverageMix<T>[] {
  const counts = new Map<T, number>();
  items.forEach((c) => counts.set(pick(c), (counts.get(pick(c)) ?? 0) + 1));
  const total = items.length || 1;
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, share: count / total }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Deterministic shortlist recommendation:
 * pick top-N by ICP, but force at least one per present vertical and ≥2 regions when possible.
 */
export function recommendShortlist(conferences: Conference[], budget: number): string[] {
  const sorted = [...conferences].sort((a, b) => b.icpScore - a.icpScore);
  const picked: Conference[] = [];
  const seenVerticals = new Set<Vertical>();
  const seenRegions = new Set<Region>();
  const presentVerticals = new Set(conferences.map((c) => c.vertical));

  // Pass 1: one per vertical (highest ICP)
  for (const v of presentVerticals) {
    const best = sorted.find((c) => c.vertical === v);
    if (best && picked.length < budget) {
      picked.push(best);
      seenVerticals.add(best.vertical);
      seenRegions.add(best.region);
    }
  }
  // Pass 2: fill remaining by ICP, prefer new region until ≥2 regions
  for (const c of sorted) {
    if (picked.length >= budget) break;
    if (picked.find((p) => p.id === c.id)) continue;
    if (seenRegions.size < 2 && seenRegions.has(c.region)) continue;
    picked.push(c);
    seenRegions.add(c.region);
  }
  // Pass 3: fill by raw ICP if still short
  for (const c of sorted) {
    if (picked.length >= budget) break;
    if (picked.find((p) => p.id === c.id)) continue;
    picked.push(c);
  }
  return picked.map((c) => c.id);
}
