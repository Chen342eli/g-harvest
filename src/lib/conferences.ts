export type Region = "North America" | "Europe" | "APAC" | "Middle East" | "LATAM";
export type Vertical = "Payments" | "Fintech" | "Treasury" | "Travel" | "SaaS" | "General Tech";
export type Tier = "Tier 1" | "Tier 2" | "Tier 3";

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
  startDate: string; // ISO
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
}

export const SALES_TEAM: string[] = [
  "Amelia Brandt",
  "Diego Marín",
  "Priya Raghavan",
  "Lucas Okafor",
  "Sofia Lindqvist",
  "Marcus Chen",
  "Hannah Whitfield",
  "Yusuf Demir",
  "Noa Bergman",
  "Rafael Costa",
  "Imani Adeyemi",
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

interface SeedInput {
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
  assignedReps?: string[];
}

const SEED: SeedInput[] = [
  {
    id: "money2020-usa",
    name: "Money20/20 USA",
    startDate: "2026-10-25",
    endDate: "2026-10-28",
    city: "Las Vegas",
    country: "USA",
    region: "North America",
    vertical: "Payments",
    estimatedAudienceSize: 13000,
    tags: ["payments", "embedded finance", "issuing", "cross-border"],
    sourceUrl: "https://us.money2020.com",
    subScores: { verticalFit: 95, decisionMakerPresence: 90, audienceQuality: 90, accessibility: 70, pastPerformance: 85 },
    assignedReps: ["Amelia Brandt", "Marcus Chen", "Priya Raghavan"],
  },
  {
    id: "money2020-eu",
    name: "Money20/20 Europe",
    startDate: "2026-06-02",
    endDate: "2026-06-04",
    city: "Amsterdam",
    country: "Netherlands",
    region: "Europe",
    vertical: "Payments",
    estimatedAudienceSize: 8500,
    tags: ["payments", "fx", "open banking"],
    sourceUrl: "https://europe.money2020.com",
    subScores: { verticalFit: 95, decisionMakerPresence: 88, audienceQuality: 88, accessibility: 85, pastPerformance: 80 },
    assignedReps: ["Sofia Lindqvist", "Yusuf Demir"],
  },
  {
    id: "sibos",
    name: "Sibos",
    startDate: "2026-09-28",
    endDate: "2026-10-01",
    city: "Frankfurt",
    country: "Germany",
    region: "Europe",
    vertical: "Treasury",
    estimatedAudienceSize: 10000,
    tags: ["treasury", "correspondent banking", "swift", "fx"],
    sourceUrl: "https://www.swift.com/sibos",
    subScores: { verticalFit: 85, decisionMakerPresence: 92, audienceQuality: 90, accessibility: 80, pastPerformance: 70 },
    assignedReps: ["Hannah Whitfield"],
  },
  {
    id: "fintech-meetup",
    name: "Fintech Meetup",
    startDate: "2027-03-08",
    endDate: "2027-03-11",
    city: "Las Vegas",
    country: "USA",
    region: "North America",
    vertical: "Fintech",
    estimatedAudienceSize: 6000,
    tags: ["fintech", "partnerships", "neobanks"],
    sourceUrl: "https://fintechmeetup.com",
    subScores: { verticalFit: 90, decisionMakerPresence: 80, audienceQuality: 85, accessibility: 70, pastPerformance: 75 },
    assignedReps: [],
  },
  {
    id: "seamless-me",
    name: "Seamless Middle East",
    startDate: "2026-05-20",
    endDate: "2026-05-22",
    city: "Dubai",
    country: "UAE",
    region: "Middle East",
    vertical: "Payments",
    estimatedAudienceSize: 20000,
    tags: ["payments", "ecommerce", "retail"],
    sourceUrl: "https://www.terrapinn.com/exhibition/seamless-middle-east/",
    subScores: { verticalFit: 80, decisionMakerPresence: 70, audienceQuality: 70, accessibility: 60, pastPerformance: 65 },
    assignedReps: ["Diego Marín"],
  },
  {
    id: "web-summit",
    name: "Web Summit",
    startDate: "2026-11-09",
    endDate: "2026-11-12",
    city: "Lisbon",
    country: "Portugal",
    region: "Europe",
    vertical: "General Tech",
    estimatedAudienceSize: 70000,
    tags: ["tech", "startups", "vc"],
    sourceUrl: "https://websummit.com",
    subScores: { verticalFit: 40, decisionMakerPresence: 55, audienceQuality: 50, accessibility: 80, pastPerformance: 45 },
    assignedReps: [],
  },
  {
    id: "itb-berlin",
    name: "ITB Berlin",
    startDate: "2027-03-09",
    endDate: "2027-03-11",
    city: "Berlin",
    country: "Germany",
    region: "Europe",
    vertical: "Travel",
    estimatedAudienceSize: 90000,
    tags: ["travel", "ota", "marketplaces"],
    sourceUrl: "https://www.itb.com",
    subScores: { verticalFit: 80, decisionMakerPresence: 70, audienceQuality: 65, accessibility: 85, pastPerformance: 60 },
    assignedReps: ["Lucas Okafor"],
  },
  {
    id: "phocuswright",
    name: "Phocuswright Conference",
    startDate: "2026-11-16",
    endDate: "2026-11-19",
    city: "Phoenix",
    country: "USA",
    region: "North America",
    vertical: "Travel",
    estimatedAudienceSize: 1800,
    tags: ["travel", "fintech in travel", "payments"],
    sourceUrl: "https://www.phocuswrightconference.com",
    subScores: { verticalFit: 85, decisionMakerPresence: 85, audienceQuality: 90, accessibility: 70, pastPerformance: 70 },
    assignedReps: ["Lucas Okafor", "Imani Adeyemi"],
  },
  {
    id: "saastr-annual",
    name: "SaaStr Annual",
    startDate: "2026-09-08",
    endDate: "2026-09-10",
    city: "San Francisco",
    country: "USA",
    region: "North America",
    vertical: "SaaS",
    estimatedAudienceSize: 12000,
    tags: ["saas", "b2b", "growth"],
    sourceUrl: "https://www.saastrannual2026.com",
    subScores: { verticalFit: 60, decisionMakerPresence: 65, audienceQuality: 70, accessibility: 75, pastPerformance: 55 },
    assignedReps: [],
  },
  {
    id: "afp-annual",
    name: "AFP Annual Conference",
    startDate: "2026-10-18",
    endDate: "2026-10-21",
    city: "Boston",
    country: "USA",
    region: "North America",
    vertical: "Treasury",
    estimatedAudienceSize: 7000,
    tags: ["treasury", "cfo", "fx hedging"],
    sourceUrl: "https://www.afponline.org/annual",
    subScores: { verticalFit: 95, decisionMakerPresence: 90, audienceQuality: 88, accessibility: 75, pastPerformance: 80 },
    assignedReps: ["Noa Bergman", "Rafael Costa"],
  },
  {
    id: "eurofinance",
    name: "EuroFinance International Treasury",
    startDate: "2026-10-14",
    endDate: "2026-10-16",
    city: "Copenhagen",
    country: "Denmark",
    region: "Europe",
    vertical: "Treasury",
    estimatedAudienceSize: 2200,
    tags: ["treasury", "fx", "corporate"],
    sourceUrl: "https://www.eurofinance.com",
    subScores: { verticalFit: 95, decisionMakerPresence: 92, audienceQuality: 90, accessibility: 80, pastPerformance: 75 },
    assignedReps: [],
  },
  {
    id: "singapore-fintech-festival",
    name: "Singapore Fintech Festival",
    startDate: "2026-11-04",
    endDate: "2026-11-06",
    city: "Singapore",
    country: "Singapore",
    region: "APAC",
    vertical: "Fintech",
    estimatedAudienceSize: 65000,
    tags: ["fintech", "apac", "regtech", "cross-border"],
    sourceUrl: "https://www.fintechfestival.sg",
    subScores: { verticalFit: 80, decisionMakerPresence: 78, audienceQuality: 75, accessibility: 55, pastPerformance: 60 },
    assignedReps: ["Priya Raghavan"],
  },
  {
    id: "merchant-payments-ecosystem",
    name: "Merchant Payments Ecosystem",
    startDate: "2027-02-16",
    endDate: "2027-02-18",
    city: "Berlin",
    country: "Germany",
    region: "Europe",
    vertical: "Payments",
    estimatedAudienceSize: 1500,
    tags: ["payments", "merchants", "acquiring", "psp"],
    sourceUrl: "https://www.merchantpaymentsecosystem.com",
    subScores: { verticalFit: 90, decisionMakerPresence: 85, audienceQuality: 88, accessibility: 80, pastPerformance: 70 },
    assignedReps: [],
  },
  {
    id: "lendit-latam",
    name: "Fintech Americas Miami",
    startDate: "2026-06-09",
    endDate: "2026-06-11",
    city: "Miami",
    country: "USA",
    region: "LATAM",
    vertical: "Fintech",
    estimatedAudienceSize: 1200,
    tags: ["latam", "fintech", "neobanks"],
    sourceUrl: "https://fintechamericas.co",
    subScores: { verticalFit: 75, decisionMakerPresence: 70, audienceQuality: 72, accessibility: 75, pastPerformance: 50 },
    assignedReps: ["Diego Marín", "Rafael Costa"],
  },
  {
    id: "saas-north",
    name: "SaaS North",
    startDate: "2026-11-18",
    endDate: "2026-11-19",
    city: "Ottawa",
    country: "Canada",
    region: "North America",
    vertical: "SaaS",
    estimatedAudienceSize: 2500,
    tags: ["saas", "vertical saas", "embedded"],
    sourceUrl: "https://saasnorth.com",
    subScores: { verticalFit: 55, decisionMakerPresence: 55, audienceQuality: 60, accessibility: 70, pastPerformance: 45 },
    assignedReps: [],
  },
];

export const SEED_CONFERENCES: Conference[] = SEED.map((c) => {
  const icpScore = computeScore(c.subScores);
  return {
    ...c,
    assignedReps: c.assignedReps ?? [],
    icpScore,
    tier: tierFromScore(icpScore),
  };
});
