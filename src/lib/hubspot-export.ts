import type { Encounter, Person } from "./people-types";
import { derivePerson } from "./matching";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

const HEADERS = [
  "First Name",
  "Last Name",
  "Email",
  "Company",
  "Job Title",
  "LinkedIn URL",
  "Grain Signal",
  "Grain Confidence",
  "Grain Reasoning",
  "Encounters",
  "Conferences Met",
  "Reps Met",
  "Last Seen",
  "Suggested Follow-up Subject",
  "Suggested Follow-up Body",
] as const;

/** Build the prioritized HubSpot queue: Warming + Steady + Too early (Tire-kickers excluded). */
export function buildHubSpotQueue(people: Person[]): Person[] {
  return people.filter(
    (p) =>
      p.aiSignal &&
      p.aiSignal !== "Tire-kicker" &&
      (p.followUpStatus ?? "pending") === "pending",
  );
}

export function toHubSpotCsv(people: Person[], encounters: Encounter[]): string {
  const rows: string[] = [HEADERS.map(csvEscape).join(",")];

  for (const p of people) {
    const { first, last } = splitName(p.fullName);
    const d = derivePerson(p, encounters);
    const confs = Array.from(new Set(d.encounters.map((e) => e.conferenceName))).join(", ");
    const reps = Array.from(new Set(d.encounters.map((e) => e.repId))).join(", ");
    const lastSeen = d.lastSeenAt ? d.lastSeenAt.slice(0, 10) : "";

    rows.push(
      [
        first,
        last,
        p.email ?? "",
        p.currentCompany ?? "",
        p.currentRole ?? "",
        p.linkedInUrl ?? "",
        p.aiSignal ?? "",
        p.aiConfidence ?? "",
        p.aiReasoning ?? "",
        d.encounterCount,
        confs,
        reps,
        lastSeen,
        p.aiNudge?.subject ?? "",
        p.aiNudge?.body ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return rows.join("\n");
}

export function downloadHubSpotCsv(people: Person[], encounters: Encounter[]): number {
  const queue = buildHubSpotQueue(people);
  const csv = toHubSpotCsv(queue, encounters);
  const today = new Date().toISOString().slice(0, 10);
  const filename = `grain-hubspot-leads-${today}.csv`;

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return queue.length;
}
