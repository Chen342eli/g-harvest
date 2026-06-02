// Deterministic scoring used by both seed data and AI-added conferences.
// Mirrors SCORE_WEIGHTS in src/lib/conferences.ts.

import type { Region, Vertical, Tier } from "./conferences";

export interface SubScoresInput {
  vertical: Vertical;
  region: Region;
  audienceSize: number;
  tags?: string[];
}

export interface ComputedScoring {
  sub_vertical_fit: number;
  sub_decision_maker_presence: number;
  sub_audience_quality: number;
  sub_accessibility: number;
  sub_past_performance: number;
  icp_score: number;
  tier: Tier;
}

const WEIGHTS = {
  verticalFit: 0.4,
  decisionMakerPresence: 0.25,
  audienceQuality: 0.15,
  accessibility: 0.1,
  pastPerformance: 0.1,
};

function verticalFit(v: Vertical): number {
  switch (v) {
    case "Payments": return 90;
    case "Cross-Border Payments": return 95;
    case "Treasury": return 90;
    case "Fintech": return 85;
    case "Embedded Finance": return 88;
    case "Neobanking": return 80;
    case "Travel Tech": return 65;
  }
}

function audienceQuality(size: number): number {
  if (size <= 0) return 40;
  if (size < 500) return 45;
  if (size < 2000) return 60;
  if (size < 5000) return 70;
  if (size < 10000) return 80;
  return 85;
}

function accessibility(region: Region): number {
  switch (region) {
    case "Europe": return 85;
    case "North America": return 80;
    case "Middle East": return 72;
    case "APAC": return 58;
    case "LATAM": return 55;
  }
}

function decisionMakerPresence(tags: string[] | undefined): number {
  // low-confidence proxy from tags
  const hay = (tags ?? []).join(" ").toLowerCase();
  let base = 55;
  if (/cfo|c-suite|c-level|treasurer|head of|vp |executive|decision/i.test(hay)) base += 20;
  if (/banking|enterprise|institution/i.test(hay)) base += 5;
  return Math.min(95, base);
}

export function tierFromScore(score: number): Tier {
  if (score >= 70) return "Tier 1";
  if (score >= 40) return "Tier 2";
  return "Tier 3";
}

export function computeScoring(input: SubScoresInput): ComputedScoring {
  const sub_vertical_fit = verticalFit(input.vertical);
  const sub_decision_maker_presence = decisionMakerPresence(input.tags);
  const sub_audience_quality = audienceQuality(input.audienceSize);
  const sub_accessibility = accessibility(input.region);
  const sub_past_performance = 50;

  const icp_score = Math.round(
    sub_vertical_fit * WEIGHTS.verticalFit +
    sub_decision_maker_presence * WEIGHTS.decisionMakerPresence +
    sub_audience_quality * WEIGHTS.audienceQuality +
    sub_accessibility * WEIGHTS.accessibility +
    sub_past_performance * WEIGHTS.pastPerformance,
  );

  return {
    sub_vertical_fit,
    sub_decision_maker_presence,
    sub_audience_quality,
    sub_accessibility,
    sub_past_performance,
    icp_score,
    tier: tierFromScore(icp_score),
  };
}
