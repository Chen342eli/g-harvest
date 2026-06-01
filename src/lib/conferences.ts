export type Region = "North America" | "Europe" | "APAC" | "Middle East" | "LATAM";
export type Vertical = "Payments" | "Fintech" | "Treasury" | "Travel" | "SaaS" | "General Tech";
export type Tier = "Tier 1" | "Tier 2" | "Tier 3";
export type DecisionStatus = "Considering" | "Going" | "Passed";

export const DECISION_STATUSES: DecisionStatus[] = ["Considering", "Going", "Passed"];

export const SCORE_WEIGHTS = {
  verticalFit: 0.4,
  decisionMakerPresence: 0.25,
  audienceQuality: 0.15,
  accessibility: 0.1,
  pastPerformance: 0.1,
} as const;

export const WEIGHT_LABELS: Record<keyof typeof SCORE_WEIGHTS, string> = {
  verticalFit: "Vertical fit",
  decisionMakerPresence: "Decision-maker presence",
  audienceQuality: "Audience quality",
  accessibility: "Accessibility",
  pastPerformance: "Past performance",
};

export interface SubScores {
  verticalFit: number;
  decisionMakerPresence: number;
  audienceQuality: number;
  accessibility: number;
  pastPerformance: number;
}

export interface Conference {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  city: string;
  country: string;
  region: Region;
  vertical: Vertical;
  estimatedAudienceSize: number;
  tags: string[];
  sourceUrl: string;
  subScores: SubScores;
  icpScore: number;
  tier: Tier;
  assignedReps: string[];
  status: DecisionStatus;
}

export function isCoverageGap(c: Conference): boolean {
  return c.status === "Going" && c.assignedReps.length === 0;
}

export const SALES_TEAM: string[] = [
  "Maya Levi",
  "Daniel Cohen",
  "Noa Bar",
  "Tom Friedman",
  "Sarah Klein",
  "Avi Mizrahi",
  "Rachel Stern",
  "Jonathan Pak",
  "Lior Adler",
  "Emma Ross",
  "Omar Haddad",
];

export function computeScore(s: SubScores): number {
  const raw =
    s.verticalFit * SCORE_WEIGHTS.verticalFit +
    s.decisionMakerPresence * SCORE_WEIGHTS.decisionMakerPresence +
    s.audienceQuality * SCORE_WEIGHTS.audienceQuality +
    s.accessibility * SCORE_WEIGHTS.accessibility +
    s.pastPerformance * SCORE_WEIGHTS.pastPerformance;
  return Math.round(raw);
}

export function tierFromScore(score: number): Tier {
  if (score >= 70) return "Tier 1";
  if (score >= 40) return "Tier 2";
  return "Tier 3";
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface RawConference {
  name: string;
  startDate: string;
  endDate: string;
  city: string;
  country: string;
  region: Region;
  vertical: Vertical;
  estimatedAudienceSize: number;
  tags: string[];
  sourceUrl: string;
  subScores: SubScores;
  icpScore: number;
  tier: 1 | 2 | 3;
  assignedReps: string[];
}

const RAW: RawConference[] = [
  {
    name: "EuroFinance International Treasury Management",
    startDate: "2026-09-16", endDate: "2026-09-18",
    city: "Barcelona", country: "Spain", region: "Europe",
    vertical: "Treasury", estimatedAudienceSize: 2600,
    tags: ["treasury", "cash management", "CFO"],
    sourceUrl: "https://www.eurofinance.com/international-treasury-event/",
    subScores: { verticalFit: 95, decisionMakerPresence: 95, audienceQuality: 80, accessibility: 85, pastPerformance: 50 },
    icpScore: 87, tier: 1,
    assignedReps: ["Maya Levi", "Rachel Stern"],
  },
  {
    name: "Money20/20 Europe",
    startDate: "2026-06-02", endDate: "2026-06-04",
    city: "Amsterdam", country: "Netherlands", region: "Europe",
    vertical: "Payments", estimatedAudienceSize: 8000,
    tags: ["payments", "fintech", "banking"],
    sourceUrl: "https://europe.money2020.com/",
    subScores: { verticalFit: 90, decisionMakerPresence: 85, audienceQuality: 85, accessibility: 85, pastPerformance: 50 },
    icpScore: 84, tier: 1,
    assignedReps: ["Daniel Cohen"],
  },
  {
    name: "Money20/20 USA",
    startDate: "2026-10-18", endDate: "2026-10-21",
    city: "Las Vegas", country: "USA", region: "North America",
    vertical: "Payments", estimatedAudienceSize: 11000,
    tags: ["payments", "fintech", "C-suite"],
    sourceUrl: "https://us.money2020.com/",
    subScores: { verticalFit: 90, decisionMakerPresence: 85, audienceQuality: 90, accessibility: 70, pastPerformance: 50 },
    icpScore: 83, tier: 1,
    assignedReps: ["Maya Levi", "Tom Friedman"],
  },
  {
    name: "Sibos",
    startDate: "2026-09-28", endDate: "2026-10-01",
    city: "Miami", country: "USA", region: "North America",
    vertical: "Payments", estimatedAudienceSize: 10000,
    tags: ["banking", "payments", "SWIFT"],
    sourceUrl: "https://www.sibos.com/",
    subScores: { verticalFit: 85, decisionMakerPresence: 85, audienceQuality: 85, accessibility: 70, pastPerformance: 50 },
    icpScore: 80, tier: 1,
    assignedReps: [],
  },
  {
    name: "AFP Annual Conference",
    startDate: "2026-10-25", endDate: "2026-10-28",
    city: "San Diego", country: "USA", region: "North America",
    vertical: "Treasury", estimatedAudienceSize: 6000,
    tags: ["treasury", "corporate finance", "CFO"],
    sourceUrl: "https://www.afponline.org/",
    subScores: { verticalFit: 85, decisionMakerPresence: 85, audienceQuality: 80, accessibility: 70, pastPerformance: 50 },
    icpScore: 79, tier: 1,
    assignedReps: [],
  },
  {
    name: "MPE (Merchant Payments Ecosystem)",
    startDate: "2026-02-17", endDate: "2026-02-19",
    city: "Berlin", country: "Germany", region: "Europe",
    vertical: "Payments", estimatedAudienceSize: 1500,
    tags: ["merchant payments", "acquiring", "PSP"],
    sourceUrl: "https://mpe-congress.com/",
    subScores: { verticalFit: 88, decisionMakerPresence: 75, audienceQuality: 65, accessibility: 85, pastPerformance: 50 },
    icpScore: 77, tier: 1,
    assignedReps: ["Noa Bar"],
  },
  {
    name: "Fintech Meetup",
    startDate: "2026-03-09", endDate: "2026-03-12",
    city: "Las Vegas", country: "USA", region: "North America",
    vertical: "Fintech", estimatedAudienceSize: 5000,
    tags: ["fintech", "payments", "networking"],
    sourceUrl: "https://fintechmeetup.com/",
    subScores: { verticalFit: 85, decisionMakerPresence: 70, audienceQuality: 80, accessibility: 70, pastPerformance: 50 },
    icpScore: 76, tier: 1,
    assignedReps: [],
  },
  {
    name: "Money20/20 Asia",
    startDate: "2026-04-21", endDate: "2026-04-23",
    city: "Bangkok", country: "Thailand", region: "APAC",
    vertical: "Fintech", estimatedAudienceSize: 3000,
    tags: ["fintech", "payments", "APAC"],
    sourceUrl: "https://asia.money2020.com/",
    subScores: { verticalFit: 85, decisionMakerPresence: 75, audienceQuality: 70, accessibility: 55, pastPerformance: 50 },
    icpScore: 74, tier: 1,
    assignedReps: ["Jonathan Pak"],
  },
  {
    name: "Pay360",
    startDate: "2026-03-24", endDate: "2026-03-25",
    city: "London", country: "UK", region: "Europe",
    vertical: "Payments", estimatedAudienceSize: 2000,
    tags: ["payments", "fintech"],
    sourceUrl: "https://www.pay360.com/",
    subScores: { verticalFit: 82, decisionMakerPresence: 70, audienceQuality: 60, accessibility: 85, pastPerformance: 50 },
    icpScore: 73, tier: 1,
    assignedReps: [],
  },
  {
    name: "Seamless Middle East",
    startDate: "2026-05-19", endDate: "2026-05-21",
    city: "Dubai", country: "UAE", region: "Middle East",
    vertical: "Payments", estimatedAudienceSize: 16000,
    tags: ["payments", "fintech", "retail", "e-commerce"],
    sourceUrl: "https://seamless-me.com/",
    subScores: { verticalFit: 75, decisionMakerPresence: 65, audienceQuality: 80, accessibility: 78, pastPerformance: 50 },
    icpScore: 71, tier: 1,
    assignedReps: ["Omar Haddad"],
  },
  {
    name: "FinovateEurope",
    startDate: "2026-02-24", endDate: "2026-02-25",
    city: "London", country: "UK", region: "Europe",
    vertical: "Fintech", estimatedAudienceSize: 1200,
    tags: ["fintech", "demos", "innovation"],
    sourceUrl: "https://informaconnect.com/finovateeurope/",
    subScores: { verticalFit: 78, decisionMakerPresence: 65, audienceQuality: 55, accessibility: 85, pastPerformance: 50 },
    icpScore: 69, tier: 2,
    assignedReps: ["Lior Adler"],
  },
  {
    name: "Phocuswright Conference",
    startDate: "2026-11-16", endDate: "2026-11-19",
    city: "Fort Lauderdale", country: "USA", region: "North America",
    vertical: "Travel", estimatedAudienceSize: 2000,
    tags: ["travel tech", "marketplaces", "OTA"],
    sourceUrl: "https://www.phocuswright.com/",
    subScores: { verticalFit: 62, decisionMakerPresence: 55, audienceQuality: 55, accessibility: 65, pastPerformance: 50 },
    icpScore: 58, tier: 2,
    assignedReps: [],
  },
  {
    name: "ITB Berlin",
    startDate: "2026-03-03", endDate: "2026-03-05",
    city: "Berlin", country: "Germany", region: "Europe",
    vertical: "Travel", estimatedAudienceSize: 90000,
    tags: ["travel trade", "tourism", "B2B"],
    sourceUrl: "https://www.itb.com/",
    subScores: { verticalFit: 60, decisionMakerPresence: 45, audienceQuality: 55, accessibility: 85, pastPerformance: 50 },
    icpScore: 57, tier: 2,
    assignedReps: ["Sarah Klein"],
  },
  {
    name: "Web Summit",
    startDate: "2026-11-02", endDate: "2026-11-05",
    city: "Lisbon", country: "Portugal", region: "Europe",
    vertical: "General Tech", estimatedAudienceSize: 70000,
    tags: ["tech", "startups", "broad"],
    sourceUrl: "https://websummit.com/",
    subScores: { verticalFit: 35, decisionMakerPresence: 40, audienceQuality: 45, accessibility: 85, pastPerformance: 50 },
    icpScore: 44, tier: 2,
    assignedReps: [],
  },
  {
    name: "CES",
    startDate: "2026-01-06", endDate: "2026-01-09",
    city: "Las Vegas", country: "USA", region: "North America",
    vertical: "General Tech", estimatedAudienceSize: 115000,
    tags: ["consumer tech", "hardware", "broad"],
    sourceUrl: "https://www.ces.tech/",
    subScores: { verticalFit: 20, decisionMakerPresence: 30, audienceQuality: 40, accessibility: 65, pastPerformance: 50 },
    icpScore: 33, tier: 3,
    assignedReps: [],
  },
];

export const SEED_CONFERENCES: Conference[] = RAW.map((c) => ({
  ...c,
  id: slug(c.name),
  tier: (`Tier ${c.tier}` as Tier),
  status: "Considering" as DecisionStatus,
}));
