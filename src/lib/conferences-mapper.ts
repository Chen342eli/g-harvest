import type { Conference, DecisionStatus, Region, Tier, Vertical } from "./conferences";

export interface ConferenceRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  city: string;
  country: string;
  region: string;
  vertical: string;
  estimated_audience_size: number;
  tags: string[];
  source_url: string;
  official_url: string | null;
  sub_vertical_fit: number;
  sub_decision_maker_presence: number;
  sub_audience_quality: number;
  sub_accessibility: number;
  sub_past_performance: number;
  icp_score: number;
  tier: string;
  assigned_reps: string[];
  status: string;
  provenance: "verified" | "ai_added";
  confidence: number | null;
}

export function rowToConference(r: ConferenceRow): Conference & { provenance: "verified" | "ai_added" } {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    city: r.city,
    country: r.country,
    region: r.region as Region,
    vertical: r.vertical as Vertical,
    estimatedAudienceSize: r.estimated_audience_size,
    tags: r.tags ?? [],
    sourceUrl: r.source_url,
    subScores: {
      verticalFit: r.sub_vertical_fit,
      decisionMakerPresence: r.sub_decision_maker_presence,
      audienceQuality: r.sub_audience_quality,
      accessibility: r.sub_accessibility,
      pastPerformance: r.sub_past_performance,
    },
    icpScore: r.icp_score,
    tier: r.tier as Tier,
    assignedReps: r.assigned_reps ?? [],
    status: r.status as DecisionStatus,
    provenance: r.provenance,
  };
}
