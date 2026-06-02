import type { Encounter, Person, EncounterVertical } from "./people-types";
import { isDecisionMakerRole, isIcpVertical } from "./people-types";

// ---------- Name normalization & fuzzy ----------

const NICKNAMES: Record<string, string> = {
  dan: "daniel",
  danny: "daniel",
  dani: "daniel",
  daniel: "daniel",
  mike: "michael",
  mick: "michael",
  michael: "michael",
  bob: "robert",
  rob: "robert",
  robert: "robert",
  bill: "william",
  will: "william",
  william: "william",
  tom: "thomas",
  thomas: "thomas",
  jim: "james",
  james: "james",
  alex: "alexander",
  alexander: "alexander",
  sam: "samuel",
  samuel: "samuel",
  kate: "katherine",
  katie: "katherine",
  katherine: "katherine",
};

export function normalizeName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s\-']/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => NICKNAMES[t] ?? t);
}

function normalizeCompany(c?: string): string {
  return (c ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

function tokenSimilarity(a: string, b: string): number {
  // 1 - normalized edit distance
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export function nameSimilarity(a: string, b: string): number {
  const ta = normalizeName(a);
  const tb = normalizeName(b);
  if (!ta.length || !tb.length) return 0;
  // Match best per token
  let total = 0;
  let count = 0;
  for (const x of ta) {
    let best = 0;
    for (const y of tb) {
      const s = tokenSimilarity(x, y);
      if (s > best) best = s;
    }
    total += best;
    count++;
  }
  return total / count;
}

// ---------- Match candidate ----------

export type MatchConfidence = "confident" | "probable" | "possible" | "none";

export interface MatchResult {
  person: Person | null;
  confidence: MatchConfidence;
  reason: string;
}

export interface MatchInput {
  fullName: string;
  linkedInUrl?: string;
  company?: string;
}

export function findMatch(input: MatchInput, people: Person[]): MatchResult {
  const li = input.linkedInUrl?.trim().toLowerCase();
  if (li) {
    const hit = people.find((p) => p.linkedInUrl?.trim().toLowerCase() === li);
    if (hit) return { person: hit, confidence: "confident", reason: "LinkedIn URL match" };
  }

  const inputCompany = normalizeCompany(input.company);
  let best: { person: Person; score: number; companyMatch: boolean } | null = null;
  for (const p of people) {
    const candidates = [p.fullName, ...p.nameVariations];
    let nameScore = 0;
    for (const c of candidates) {
      const s = nameSimilarity(input.fullName, c);
      if (s > nameScore) nameScore = s;
    }
    if (nameScore < 0.75) continue;
    const companyMatch =
      !!inputCompany && normalizeCompany(p.currentCompany) === inputCompany;
    const score = nameScore + (companyMatch ? 0.2 : 0);
    if (!best || score > best.score) best = { person: p, score, companyMatch };
  }

  if (!best) return { person: null, confidence: "none", reason: "No match" };
  if (best.score >= 0.95 && best.companyMatch)
    return { person: best.person, confidence: "probable", reason: "Name + company match" };
  if (best.score >= 0.85)
    return { person: best.person, confidence: "probable", reason: "Strong name match" };
  return { person: best.person, confidence: "possible", reason: "Possible name match" };
}

// ---------- Badges ----------

export type BadgeKey =
  | "returning"
  | "cross-rep"
  | "decision-maker"
  | "icp-vertical"
  | "moved-to-icp";

export interface Badge {
  key: BadgeKey;
  label: string;
  icon: string;
  emphasis?: boolean;
  tooltip: string;
}

export function computeBadges(person: Person, encounters: Encounter[]): Badge[] {
  const personEncs = encounters
    .filter((e) => e.personId === person.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const badges: Badge[] = [];

  if (personEncs.length >= 2) {
    badges.push({
      key: "returning",
      label: `Returning ×${personEncs.length}`,
      icon: "↩",
      tooltip: `${personEncs.length} encounters logged`,
    });
  }

  const reps = new Set(personEncs.map((e) => e.repId));
  if (reps.size >= 2) {
    badges.push({
      key: "cross-rep",
      label: "Cross-rep",
      icon: "👥",
      tooltip: `Met by ${reps.size} different reps`,
    });
  }

  if (isDecisionMakerRole(person.currentRole)) {
    badges.push({
      key: "decision-maker",
      label: "Decision-maker",
      icon: "👤",
      tooltip: `Role "${person.currentRole}" matches buyer-persona keywords`,
    });
  }

  if (isIcpVertical(person.currentVertical)) {
    badges.push({
      key: "icp-vertical",
      label: "ICP vertical",
      icon: "🎯",
      tooltip: `${person.currentVertical} is a Grain ICP vertical`,
    });
  }

  // Moved to ICP: compare latest vs prior
  if (personEncs.length >= 2) {
    const prior = personEncs[personEncs.length - 2];
    const latest = personEncs[personEncs.length - 1];
    const priorIcpCompany =
      isIcpVertical(prior.vertical as EncounterVertical | undefined);
    const latestIcpCompany =
      isIcpVertical(latest.vertical as EncounterVertical | undefined) ||
      isIcpVertical(person.currentVertical);
    const verticalJump = !priorIcpCompany && latestIcpCompany;
    const roleJump =
      !isDecisionMakerRole(prior.roleAtTime) &&
      (isDecisionMakerRole(latest.roleAtTime) || isDecisionMakerRole(person.currentRole));
    if (verticalJump || roleJump) {
      badges.push({
        key: "moved-to-icp",
        label: "Moved to ICP",
        icon: "🏢↗",
        emphasis: true,
        tooltip: verticalJump
          ? `Moved from ${prior.companyAtTime ?? prior.vertical ?? "non-ICP"} to ${
              latest.companyAtTime ?? latest.vertical ?? "ICP"
            }`
          : `Promoted into a decision-maker role since last encounter`,
      });
    }
  }

  return badges;
}

// ---------- Derived person stats ----------

export interface PersonDerived {
  encounterCount: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  repsMetIds: string[];
  encounters: Encounter[];
}

export function derivePerson(person: Person, all: Encounter[]): PersonDerived {
  const encs = all
    .filter((e) => e.personId === person.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return {
    encounterCount: encs.length,
    firstSeenAt: encs[0]?.timestamp,
    lastSeenAt: encs[encs.length - 1]?.timestamp,
    repsMetIds: Array.from(new Set(encs.map((e) => e.repId))),
    encounters: encs,
  };
}
