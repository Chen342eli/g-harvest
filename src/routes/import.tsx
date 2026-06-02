import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listConferences } from "@/lib/conferences.functions";
import { TopNav } from "@/components/TopNav";
import { useSettings } from "@/lib/settings-store";
import { SALES_TEAM } from "@/lib/conferences";
import {
  usePeopleData,
  addPerson,
  addEncounter,
  updatePerson,
  addNameVariation,
  generateId,
} from "@/lib/people-store";
import { findMatch } from "@/lib/matching";
import type { Encounter, EncounterVertical, Person, Temperature } from "@/lib/people-types";
import { ENCOUNTER_VERTICALS } from "@/lib/people-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/import")({
  head: () => ({ meta: [{ title: "Import · Conference Radar" }] }),
  component: ImportPage,
});

type CsvRow = Record<string, string>;
type FieldKey = "name" | "company" | "role" | "email" | "linkedInUrl" | "repId" | "temperature" | "vertical" | "ignore";

const FIELD_OPTIONS: { key: FieldKey; label: string }[] = [
  { key: "ignore", label: "— ignore —" },
  { key: "name", label: "Name *" },
  { key: "company", label: "Company" },
  { key: "role", label: "Role / title" },
  { key: "email", label: "Email" },
  { key: "linkedInUrl", label: "LinkedIn URL" },
  { key: "repId", label: "Rep (scanned by)" },
  { key: "temperature", label: "Temperature (hot/warm/cold)" },
  { key: "vertical", label: "Vertical" },
];

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  // Simple CSV parser with quoted-field support.
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field.length || cur.length) { cur.push(field); lines.push(cur); cur = []; field = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); lines.push(cur); }
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].map((h) => h.trim());
  const rows = lines.slice(1).filter((r) => r.some((v) => v.trim().length))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, rows };
}

function normalizeTemp(v: string): Temperature | undefined {
  const x = v.trim().toLowerCase();
  if (["hot", "h", "fire", "🔥"].includes(x)) return "hot";
  if (["warm", "w", "🟡"].includes(x)) return "warm";
  if (["cold", "c", "⚪"].includes(x)) return "cold";
  return undefined;
}

function normalizeVertical(v: string): EncounterVertical | undefined {
  const x = v.trim().toLowerCase();
  const map: Record<string, EncounterVertical> = {
    payments: "Payments",
    fintech: "Fintech",
    treasury: "Treasury",
    travel: "Travel",
    saas: "SaaS",
    marketplace: "Marketplace",
    other: "Other",
  };
  return map[x];
}

function ImportPage() {
  const fetchConfs = useServerFn(listConferences);
  const { data: conferences = [] } = useQuery({ queryKey: ["conferences"], queryFn: () => fetchConfs() });
  const settings = useSettings();
  const data = usePeopleData();

  const [csv, setCsv] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, FieldKey>>({});
  const [defaultTemp, setDefaultTemp] = useState<Temperature>("warm");
  const [defaultRep, setDefaultRep] = useState<string>(settings.activeRepId ?? SALES_TEAM[0] ?? "");
  const [conferenceId, setConferenceId] = useState<string>(settings.activeConferenceId ?? "");
  const [summary, setSummary] = useState<null | {
    imported: number;
    newCount: number;
    matchedCount: number;
    needsReview: { row: CsvRow; candidateName: string }[];
  }>(null);
  const [ambiguous, setAmbiguous] = useState<{ row: CsvRow; candidatePersonId: string }[]>([]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      const parsed = parseCsv(t);
      // Auto-map by header name
      const auto: Record<string, FieldKey> = {};
      for (const h of parsed.headers) {
        const k = h.toLowerCase();
        if (k.includes("name")) auto[h] = "name";
        else if (k.includes("company") || k.includes("org")) auto[h] = "company";
        else if (k.includes("title") || k.includes("role")) auto[h] = "role";
        else if (k.includes("linkedin")) auto[h] = "linkedInUrl";
        else if (k.includes("email")) auto[h] = "email";
        else if (k.includes("rep") || k.includes("scanned by") || k.includes("scanner")) auto[h] = "repId";
        else if (k.includes("temp") || k.includes("rating")) auto[h] = "temperature";
        else if (k.includes("vertical") || k.includes("industry")) auto[h] = "vertical";
        else auto[h] = "ignore";
      }
      setMapping(auto);
      setCsv(parsed);
      setSummary(null);
      setAmbiguous([]);
    });
  }

  const nameCol = useMemo(
    () => Object.entries(mapping).find(([, v]) => v === "name")?.[0],
    [mapping],
  );

  function runImport() {
    if (!csv || !nameCol || !conferenceId) {
      toast.error("Need a name column + conference selected");
      return;
    }
    const conf = conferences.find((c) => c.id === conferenceId);
    const timestamp = new Date().toISOString();
    let newCount = 0;
    let matchedCount = 0;
    const needsReview: { row: CsvRow; candidateName: string }[] = [];
    const ambiguousRows: { row: CsvRow; candidatePersonId: string }[] = [];

    // Reload latest people array per insert
    let working = [...data.people];

    for (const row of csv.rows) {
      const get = (k: FieldKey) => {
        const col = Object.entries(mapping).find(([, v]) => v === k)?.[0];
        return col ? row[col] ?? "" : "";
      };
      const name = get("name").trim();
      if (!name) continue;
      const company = get("company").trim();
      const role = get("role").trim();
      const email = get("email").trim();
      const linkedIn = get("linkedInUrl").trim();
      const repId = get("repId").trim() || defaultRep;
      const temp = normalizeTemp(get("temperature")) ?? defaultTemp;
      const vertical = normalizeVertical(get("vertical"));

      const match = findMatch({ fullName: name, linkedInUrl: linkedIn || undefined, company: company || undefined }, working);

      if (match.confidence === "possible") {
        ambiguousRows.push({ row, candidatePersonId: match.person!.id });
        needsReview.push({ row, candidateName: match.person!.fullName });
        continue;
      }

      let personId: string;
      if (match.person && (match.confidence === "confident" || match.confidence === "probable")) {
        personId = match.person.id;
        matchedCount++;
        if (match.person.fullName.toLowerCase() !== name.toLowerCase()) {
          addNameVariation(personId, name);
        }
        const patch: Partial<Person> = {};
        if (company) patch.currentCompany = company;
        if (role) patch.currentRole = role;
        if (vertical) patch.currentVertical = vertical;
        if (linkedIn) patch.linkedInUrl = linkedIn;
        if (email) patch.email = email;
        if (Object.keys(patch).length) updatePerson(personId, patch);
        working = working.map((p) => (p.id === personId ? { ...p, ...patch } : p));
      } else {
        personId = generateId();
        const person: Person = {
          id: personId,
          fullName: name,
          nameVariations: [],
          linkedInUrl: linkedIn || undefined,
          email: email || undefined,
          currentCompany: company || undefined,
          currentRole: role || undefined,
          currentVertical: vertical,
          createdAt: timestamp,
          createdByRepId: repId,
        };
        addPerson(person);
        working.push(person);
        newCount++;
      }

      const e: Encounter = {
        id: generateId(),
        personId,
        conferenceId,
        conferenceName: conf?.name ?? "Imported",
        repId,
        timestamp,
        temperature: temp,
        vertical,
        companyAtTime: company || undefined,
        roleAtTime: role || undefined,
        captureMethod: "import",
      };
      addEncounter(e);
    }

    setAmbiguous(ambiguousRows);
    setSummary({
      imported: csv.rows.length,
      newCount,
      matchedCount,
      needsReview,
    });
    toast.success(`Imported ${newCount + matchedCount} of ${csv.rows.length} rows`);
  }

  function resolveAmbiguous(idx: number, action: "merge" | "new") {
    const item = ambiguous[idx];
    if (!item) return;
    const get = (k: FieldKey) => {
      const col = Object.entries(mapping).find(([, v]) => v === k)?.[0];
      return col ? item.row[col] ?? "" : "";
    };
    const name = get("name").trim();
    const company = get("company").trim();
    const role = get("role").trim();
    const linkedIn = get("linkedInUrl").trim();
    const email = get("email").trim();
    const repId = get("repId").trim() || defaultRep;
    const temp = normalizeTemp(get("temperature")) ?? defaultTemp;
    const vertical = normalizeVertical(get("vertical"));
    const conf = conferences.find((c) => c.id === conferenceId);
    const timestamp = new Date().toISOString();

    let personId: string;
    if (action === "merge") {
      personId = item.candidatePersonId;
      addNameVariation(personId, name);
      const patch: Partial<Person> = {};
      if (company) patch.currentCompany = company;
      if (role) patch.currentRole = role;
      if (linkedIn) patch.linkedInUrl = linkedIn;
      if (email) patch.email = email;
      if (vertical) patch.currentVertical = vertical;
      if (Object.keys(patch).length) updatePerson(personId, patch);
    } else {
      personId = generateId();
      addPerson({
        id: personId,
        fullName: name,
        nameVariations: [],
        linkedInUrl: linkedIn || undefined,
        email: email || undefined,
        currentCompany: company || undefined,
        currentRole: role || undefined,
        currentVertical: vertical,
        createdAt: timestamp,
        createdByRepId: repId,
      });
    }
    addEncounter({
      id: generateId(),
      personId,
      conferenceId,
      conferenceName: conf?.name ?? "Imported",
      repId,
      timestamp,
      temperature: temp,
      vertical,
      companyAtTime: company || undefined,
      roleAtTime: role || undefined,
      captureMethod: "import",
    });
    setAmbiguous((cur) => cur.filter((_, i) => i !== idx));
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">CSV Import & Triage</h1>
            <p className="text-xs text-muted-foreground">Booth-scan firehose — deduped against people you've already met.</p>
          </div>
          <TopNav />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] space-y-6 px-6 py-6">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">1. Upload CSV</h2>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="mt-2 text-sm" />
          {csv && (
            <p className="mt-2 text-xs text-muted-foreground">{csv.rows.length} rows, {csv.headers.length} columns</p>
          )}
        </section>

        {csv && (
          <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">2. Map columns</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {csv.headers.map((h) => (
                <label key={h} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-mono text-xs text-muted-foreground">{h}</span>
                  <select
                    value={mapping[h] ?? "ignore"}
                    onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as FieldKey })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    {FIELD_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
              <label className="block text-xs">
                <span className="font-medium">Conference *</span>
                <select value={conferenceId} onChange={(e) => setConferenceId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5">
                  <option value="">— select —</option>
                  {conferences.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block text-xs">
                <span className="font-medium">Default rep (if column missing)</span>
                <select value={defaultRep} onChange={(e) => setDefaultRep(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5">
                  {SALES_TEAM.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="block text-xs">
                <span className="font-medium">Default temp (if column missing)</span>
                <select value={defaultTemp} onChange={(e) => setDefaultTemp(e.target.value as Temperature)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5">
                  <option value="cold">⚪ Cold</option>
                  <option value="warm">🟡 Warm</option>
                  <option value="hot">🔥 Hot</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={runImport}
              disabled={!nameCol || !conferenceId}
              className={cn(
                "mt-2 rounded-md px-4 py-2 text-sm font-medium",
                nameCol && conferenceId ? "bg-brand-base text-brand-base-foreground" : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              Import {csv.rows.length} rows
            </button>
          </section>
        )}

        {summary && (
          <section className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h2 className="text-sm font-semibold">Triage summary</h2>
            <p className="text-sm text-foreground">
              Imported <b>{summary.imported}</b> leads · <b>{summary.newCount}</b> new ·
              {" "}<b>{summary.matchedCount}</b> already met
              {summary.needsReview.length > 0 && <> · <b className="text-amber-700">{summary.needsReview.length}</b> need confirmation</>}
            </p>

            {ambiguous.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs confirmation</h3>
                <ul className="mt-2 space-y-2">
                  {ambiguous.map((a, i) => {
                    const candidate = data.people.find((p) => p.id === a.candidatePersonId);
                    const nameCol2 = Object.entries(mapping).find(([, v]) => v === "name")?.[0];
                    const importedName = nameCol2 ? a.row[nameCol2] : "(unknown)";
                    return (
                      <li key={i} className="rounded-md border border-border bg-background p-3">
                        <div className="text-sm">
                          <b>{importedName}</b> from CSV may be{" "}
                          <b>{candidate?.fullName}</b>
                          {candidate?.currentCompany ? ` @ ${candidate.currentCompany}` : ""}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => resolveAmbiguous(i, "merge")} className="rounded-md bg-foreground px-3 py-1 text-xs text-background">Same person</button>
                          <button onClick={() => resolveAmbiguous(i, "new")} className="rounded-md border border-border px-3 py-1 text-xs">New person</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
