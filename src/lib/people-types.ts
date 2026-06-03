export type Temperature = "hot" | "warm" | "cold";

export type EncounterVertical =
  | "Payments"
  | "Fintech"
  | "Treasury"
  | "Travel"
  | "SaaS"
  | "Marketplace"
  | "Other";

export const ENCOUNTER_VERTICALS: EncounterVertical[] = [
  "Payments",
  "Fintech",
  "Treasury",
  "Travel",
  "SaaS",
  "Marketplace",
  "Other",
];

export const ICP_VERTICALS: EncounterVertical[] = ["Payments", "Fintech", "Treasury"];
export const MEDIUM_VERTICALS: EncounterVertical[] = ["Travel", "SaaS", "Marketplace"];

export type AiSignal = "Warming" | "Tire-kicker" | "Steady" | "Too early";
export type AiConfidence = "low" | "medium" | "high";

export interface AiNudge {
  channel: "email";
  subject: string;
  body: string;
}

export interface Person {
  id: string;
  fullName: string;
  nameVariations: string[];
  linkedInUrl?: string;
  email?: string;
  currentCompany?: string;
  currentRole?: string;
  currentVertical?: EncounterVertical;
  createdAt: string;
  createdByRepId: string;
  aiSignal?: AiSignal;
  aiConfidence?: AiConfidence;
  aiReasoning?: string;
  aiNudge?: AiNudge;
  aiArcSummary?: string;
  aiGeneratedAt?: string;
  followUpStatus?: "pending" | "done";
}

export interface Encounter {
  id: string;
  personId: string;
  conferenceId: string;
  conferenceName: string; // snapshot for display even if conf list changes
  repId: string;
  timestamp: string;
  temperature: Temperature;
  vertical?: EncounterVertical;
  title?: string; // short meeting title (e.g. "Coffee on treasury workflow")
  note?: string;
  companyAtTime?: string;
  roleAtTime?: string;
  captureMethod: "manual" | "import";
}

export interface PeopleData {
  people: Person[];
  encounters: Encounter[];
}

// Grain buyer-persona decision-maker keywords (lowercased substrings)
export const DECISION_MAKER_KEYWORDS = [
  "cfo",
  "chief financial",
  "vp finance",
  "head of finance",
  "treasurer",
  "head of treasury",
  "director of treasury",
  "head of payments",
  "director of payments",
  "vp payments",
  "chief product",
  "head of product",
  "vp product",
];

export function isDecisionMakerRole(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return DECISION_MAKER_KEYWORDS.some((k) => r.includes(k));
}

export function isIcpVertical(v?: EncounterVertical): boolean {
  return !!v && ICP_VERTICALS.includes(v);
}
