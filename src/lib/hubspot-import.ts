import type { Person } from "./people-types";
import { generateId } from "./people-store";

/** Minimal CSV parser supporting quoted values, escaped quotes ("") and embedded commas/newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.some((v) => v.length > 0)) rows.push(row);
        row = [];
      } else {
        cell += c;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((v) => v.length > 0)) rows.push(row);
  }
  return rows;
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\uFEFF/g, "");
}

/** HubSpot column aliases → our Person fields. */
const FIELD_ALIASES: Record<keyof Pick<Person, "fullName" | "email" | "currentCompany" | "currentRole" | "linkedInUrl"> | "firstName" | "lastName", string[]> = {
  firstName: ["first name", "firstname"],
  lastName: ["last name", "lastname"],
  fullName: ["full name", "name", "contact name"],
  email: ["email", "email address"],
  currentCompany: ["company", "company name", "associated company", "company / account"],
  currentRole: ["job title", "title", "role"],
  linkedInUrl: ["linkedin url", "linkedin", "linkedin bio url"],
};

function findIdx(headers: string[], aliases: string[]): number {
  for (const a of aliases) {
    const idx = headers.indexOf(a);
    if (idx !== -1) return idx;
  }
  return -1;
}

export interface ImportResult {
  added: number;
  skipped: number;
  total: number;
  people: Person[];
}

export function parseHubSpotCsv(text: string, existing: Person[], importerRepId = "import"): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { added: 0, skipped: 0, total: 0, people: [] };

  const headers = rows[0].map(normHeader);
  const ix = {
    firstName: findIdx(headers, FIELD_ALIASES.firstName),
    lastName: findIdx(headers, FIELD_ALIASES.lastName),
    fullName: findIdx(headers, FIELD_ALIASES.fullName),
    email: findIdx(headers, FIELD_ALIASES.email),
    company: findIdx(headers, FIELD_ALIASES.currentCompany),
    role: findIdx(headers, FIELD_ALIASES.currentRole),
    linkedIn: findIdx(headers, FIELD_ALIASES.linkedInUrl),
  };

  const existingEmails = new Set(
    existing.map((p) => p.email?.trim().toLowerCase()).filter(Boolean) as string[],
  );
  const existingNames = new Set(existing.map((p) => p.fullName.trim().toLowerCase()));

  const added: Person[] = [];
  let skipped = 0;
  const now = new Date().toISOString();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (i: number) => (i === -1 ? "" : (row[i] ?? "").trim());

    const first = get(ix.firstName);
    const last = get(ix.lastName);
    const explicitFull = get(ix.fullName);
    const fullName = explicitFull || [first, last].filter(Boolean).join(" ").trim();
    if (!fullName) {
      skipped++;
      continue;
    }

    const email = get(ix.email).toLowerCase();
    const nameKey = fullName.toLowerCase();

    if ((email && existingEmails.has(email)) || existingNames.has(nameKey)) {
      skipped++;
      continue;
    }

    const p: Person = {
      id: generateId(),
      fullName,
      nameVariations: [],
      email: email || undefined,
      currentCompany: get(ix.company) || undefined,
      currentRole: get(ix.role) || undefined,
      linkedInUrl: get(ix.linkedIn) || undefined,
      createdAt: now,
      createdByRepId: importerRepId,
      followUpStatus: "pending",
    };

    added.push(p);
    if (email) existingEmails.add(email);
    existingNames.add(nameKey);
  }

  return { added: added.length, skipped, total: rows.length - 1, people: added };
}
