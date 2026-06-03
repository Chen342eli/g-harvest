import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, ChevronsUpDown, Copy, Download, Mail, Search, Sparkles, Upload, X } from "lucide-react";
import { downloadHubSpotCsv, buildHubSpotQueue } from "@/lib/hubspot-export";
import { parseHubSpotCsv } from "@/lib/hubspot-import";
import { TopNav } from "@/components/TopNav";
import { usePeopleData, updatePerson, addPeople } from "@/lib/people-store";
import { computeBadges, derivePerson } from "@/lib/matching";
import type { Temperature, EncounterVertical, Encounter, Person, AiSignal, AiConfidence } from "@/lib/people-types";
import { ENCOUNTER_VERTICALS } from "@/lib/people-types";
import { TempDot } from "@/components/people/TempControls";
import { BadgeList } from "@/components/people/Badges";
import { AddTouchpointDialog } from "@/components/people/AddTouchpointDialog";
import { cn } from "@/lib/utils";
import { SALES_TEAM } from "@/lib/conferences";
import { analyzeRelationship } from "@/lib/relationship-ai.functions";
import { useBulkAiReads } from "@/lib/use-bulk-ai";
import { toast } from "sonner";

export const Route = createFileRoute("/people")({
  head: () => ({ meta: [{ title: "Relationships · Grain Harvest" }] }),
  component: RelationshipsPage,
});

// ---------- Temperature trend helpers ----------

const TEMP_RANK: Record<Temperature, number> = { cold: 0, warm: 1, hot: 2 };
const TEMP_COLOR: Record<Temperature, string> = {
  hot: "bg-temp-hot",
  warm: "bg-temp-warm",
  cold: "bg-temp-cold",
};

type Trend = "up" | "flat" | "down" | "single" | "none";
const TREND_RANK: Record<Trend, number> = { up: 4, flat: 3, single: 2, down: 1, none: 0 };

function computeTrend(encs: Encounter[]): Trend {
  if (encs.length === 0) return "none";
  if (encs.length === 1) return "single";
  const last = TEMP_RANK[encs[encs.length - 1].temperature];
  const prev = TEMP_RANK[encs[encs.length - 2].temperature];
  if (last > prev) return "up";
  if (last < prev) return "down";
  return "flat";
}

function TrendArrow({ trend }: { trend: Trend }) {
  if (trend === "up") return <ArrowUpRight className="h-3.5 w-3.5 text-temp-hot" aria-label="warming" />;
  if (trend === "down") return <ArrowDownRight className="h-3.5 w-3.5 text-temp-cold" aria-label="cooling" />;
  if (trend === "flat") return <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="steady" />;
  return <span className="h-3.5 w-3.5 inline-block" />;
}

function TempSparkline({ encs }: { encs: Encounter[] }) {
  const last5 = encs.slice(-5);
  return (
    <div className="flex items-center gap-0.5">
      {last5.map((e, i) => (
        <span
          key={e.id ?? i}
          className={cn("h-2 w-2 rounded-full", TEMP_COLOR[e.temperature])}
          title={`${e.conferenceName} · ${e.temperature}`}
        />
      ))}
    </div>
  );
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const days = Math.floor((now - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

// ---------- Sort ----------
//
// Phase 3: default sort is AI signal (Warming → Steady → Too early → Tire-kicker),
// then confidence (high→low), then recency.

type SortKey = "signal" | "person" | "role" | "vertical" | "met" | "lastSeen" | "trend";
type SortDir = "asc" | "desc";

const SIGNAL_RANK: Record<AiSignal, number> = {
  "Warming": 4,
  "Steady": 3,
  "Too early": 2,
  "Tire-kicker": 1,
};
const CONFIDENCE_RANK: Record<AiConfidence, number> = { high: 3, medium: 2, low: 1 };

const SIGNAL_STYLE: Record<AiSignal, string> = {
  "Warming": "bg-temp-hot/15 text-temp-hot border-temp-hot/30",
  "Steady": "bg-temp-warm/15 text-temp-warm border-temp-warm/30",
  "Too early": "bg-muted text-muted-foreground border-border",
  "Tire-kicker": "bg-temp-cold/15 text-temp-cold border-temp-cold/30",
};

function SignalBadge({ signal, confidence }: { signal?: AiSignal; confidence?: AiConfidence }) {
  if (!signal) {
    return <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"><Sparkles className="h-2.5 w-2.5" />no read</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", SIGNAL_STYLE[signal])}>
      <Sparkles className="h-2.5 w-2.5" />
      {signal}
      {confidence && <span className="opacity-70">· {confidence}</span>}
    </span>
  );
}

function RelationshipsPage() {
  useBulkAiReads();
  const data = usePeopleData();
  const [search, setSearch] = useState("");
  const [verticalFilter, setVerticalFilter] = useState<EncounterVertical | "all">("all");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("signal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "person" || key === "role" || key === "vertical" ? "asc" : "desc");
    }
  };

  const enriched = useMemo(() => {
    return data.people.map((p) => {
      const derived = derivePerson(p, data.encounters);
      const badges = computeBadges(p, data.encounters);
      const latestTemp = derived.encounters[derived.encounters.length - 1]?.temperature;
      const trend = computeTrend(derived.encounters);
      return { person: p, derived, badges, latestTemp, trend };
    });
  }, [data]);

  const allReps = useMemo(() => {
    const set = new Set<string>(SALES_TEAM);
    data.encounters.forEach((e) => set.add(e.repId));
    return Array.from(set).sort();
  }, [data.encounters]);

  const filtered = enriched.filter(({ person, derived }) => {
    if (search) {
      const q = search.toLowerCase();
      const hay = [person.fullName, ...person.nameVariations, person.currentCompany, person.currentRole]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (verticalFilter !== "all" && person.currentVertical !== verticalFilter) return false;
    if (repFilter !== "all" && !derived.repsMetIds.includes(repFilter)) return false;
    return true;
  });

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "signal": {
          const sa = a.person.aiSignal ? SIGNAL_RANK[a.person.aiSignal] : 0;
          const sb = b.person.aiSignal ? SIGNAL_RANK[b.person.aiSignal] : 0;
          if (sa !== sb) return dir * (sa - sb);
          const ca = a.person.aiConfidence ? CONFIDENCE_RANK[a.person.aiConfidence] : 0;
          const cb = b.person.aiConfidence ? CONFIDENCE_RANK[b.person.aiConfidence] : 0;
          if (ca !== cb) return dir * (ca - cb);
          return dir * (a.derived.lastSeenAt ?? "").localeCompare(b.derived.lastSeenAt ?? "");
        }
        case "person":
          return dir * a.person.fullName.localeCompare(b.person.fullName);
        case "role":
          return dir * (a.person.currentRole ?? "").localeCompare(b.person.currentRole ?? "");
        case "vertical":
          return dir * (a.person.currentVertical ?? "").localeCompare(b.person.currentVertical ?? "");
        case "met":
          return dir * (a.derived.encounterCount - b.derived.encounterCount);
        case "lastSeen":
          return dir * (a.derived.lastSeenAt ?? "").localeCompare(b.derived.lastSeenAt ?? "");
        case "trend":
          return dir * (TREND_RANK[a.trend] - TREND_RANK[b.trend]);
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const selected = selectedId ? enriched.find((e) => e.person.id === selectedId) ?? null : null;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      {/* Sub-toolbar: counts + HubSpot import/export, mirrors ContextSubNav strip */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              People
            </span>
            <span className="text-border">·</span>
            <span>
              <span className="font-semibold tabular-nums text-foreground">{sorted.length}</span>
              <span className="text-muted-foreground"> of {enriched.length}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <AddTouchpointDialog />
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <HubSpotImportButton existing={data.people} />
            <HubSpotExportButton people={data.people} encounters={data.encounters} />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-6 py-6 relative">
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, company, role…"
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
              />
            </div>
            <select
              value={verticalFilter}
              onChange={(e) => setVerticalFilter(e.target.value as EncounterVertical | "all")}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">All verticals</option>
              {ENCOUNTER_VERTICALS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">All reps</option>
              {allReps.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {(search || verticalFilter !== "all" || repFilter !== "all") && (
              <button
                type="button"
                onClick={() => { setSearch(""); setVerticalFilter("all"); setRepFilter("all"); }}
                className="h-9 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Table header */}
          <div className="hidden grid-cols-[130px_minmax(0,2fr)_minmax(0,2fr)_110px_70px_90px_110px] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
            <SortHeader label="Signal" k="signal" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <SortHeader label="Person" k="person" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <SortHeader label="Role @ Company" k="role" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <SortHeader label="Vertical" k="vertical" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <SortHeader label="Met" k="met" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
            <SortHeader label="Last seen" k="lastSeen" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <SortHeader label="Trend" k="trend" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
          </div>


          <ul className="max-h-[72vh] divide-y divide-border overflow-auto">
            {sorted.length === 0 && (
              <li className="p-6 text-sm text-muted-foreground">No matches.</li>
            )}
            {sorted.map(({ person, badges, latestTemp, derived, trend }) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(person.id)}
                  className={cn(
                    "grid w-full grid-cols-1 gap-1 px-3 py-2.5 text-left transition hover:bg-muted/40 lg:grid-cols-[130px_minmax(0,2fr)_minmax(0,2fr)_110px_70px_90px_110px] lg:items-center lg:gap-3",
                    selectedId === person.id && "bg-muted/60",
                  )}
                >
                  <div className="hidden lg:block">
                    <SignalBadge signal={person.aiSignal} confidence={person.aiConfidence} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">{person.fullName}</span>
                      {latestTemp && <span className="lg:hidden"><TempDot t={latestTemp} /></span>}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground lg:hidden">
                      {person.currentRole ?? "—"}{person.currentCompany ? ` @ ${person.currentCompany}` : ""}
                    </div>
                  </div>
                  <div className="hidden min-w-0 lg:block">
                    <div className="truncate text-xs text-foreground">{person.currentRole ?? "—"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{person.currentCompany ?? "—"}</div>
                  </div>
                  <div className="hidden lg:block">
                    {person.currentVertical ? (
                      <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                        {person.currentVertical}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="hidden text-right text-xs tabular-nums text-foreground lg:block">
                    ×{derived.encounterCount}
                  </div>
                  <div className="hidden text-xs tabular-nums text-muted-foreground lg:block">
                    {fmtDate(derived.lastSeenAt)}
                  </div>
                  <div className="hidden items-center gap-1.5 lg:flex">
                    {latestTemp && <TempDot t={latestTemp} />}
                    <TrendArrow trend={trend} />
                    <TempSparkline encs={derived.encounters} />
                  </div>
                </button>

              </li>
            ))}
          </ul>
        </section>

        {/* Floating detail panel */}
        {selected && (
          <aside
            className="absolute right-6 top-6 z-20 w-[560px] max-w-[calc(100%-3rem)] max-h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-border bg-card shadow-xl flex flex-col"
            role="dialog"
            aria-label={`${selected.person.fullName} details`}
          >
            <div className="sticky top-0 z-10 flex justify-end border-b border-border bg-card/95 backdrop-blur px-3 py-2">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-auto">
              <PersonDetail
                person={selected.person}
                encounters={selected.derived.encounters}
                badges={selected.badges}
              />
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onClick(k)}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide hover:text-foreground transition",
        active ? "text-foreground" : "text-muted-foreground",
        align === "right" && "justify-end",
      )}
    >
      <span>{label}</span>
      <Icon className="h-3 w-3" />
    </button>
  );
}

function PersonDetail({
  person,
  encounters,
  badges,
}: {
  person: Person;
  encounters: Encounter[];
  badges: ReturnType<typeof computeBadges>;
}) {
  return (
    <div className="space-y-4 p-5 pr-12">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{person.fullName}</h2>
        {person.nameVariations.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Also known as: {person.nameVariations.join(", ")}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {person.currentRole ?? "—"}{person.currentCompany ? ` @ ${person.currentCompany}` : ""}
          {person.currentVertical ? ` · ${person.currentVertical}` : ""}
        </p>
        {person.linkedInUrl && (
          <a
            href={person.linkedInUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-primary underline"
          >
            LinkedIn ↗
          </a>
        )}
      </div>

      <BadgeList badges={badges} />

      <AiPanel person={person} encounters={encounters} />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Touchpoints</h3>
        <ol className="space-y-2">
          {encounters.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">{e.conferenceName}</div>
                <TempDot t={e.temperature} />
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.timestamp).toLocaleDateString()} · by {e.repId}
              </div>
              <div className="mt-1 text-xs text-foreground">
                {e.roleAtTime ?? "—"}{e.companyAtTime ? ` @ ${e.companyAtTime}` : ""}
                {e.vertical ? ` · ${e.vertical}` : ""}
              </div>
              {e.note && <div className="mt-1 text-xs italic text-muted-foreground">"{e.note}"</div>}
            </li>
          ))}
        </ol>
      </div>

    </div>
  );
}

function AiPanel({ person, encounters }: { person: Person; encounters: Encounter[] }) {
  const analyze = useServerFn(analyzeRelationship);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const ranForRef = useRef<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        person: {
          fullName: person.fullName,
          nameVariations: person.nameVariations,
          linkedInUrl: person.linkedInUrl ?? null,
          currentRole: person.currentRole ?? null,
          currentCompany: person.currentCompany ?? null,
          currentVertical: person.currentVertical ?? null,
        },
        encounters: encounters.map((e) => ({
          date: e.timestamp.slice(0, 10),
          conferenceName: e.conferenceName,
          repName: e.repId,
          temperature: e.temperature,
          roleAtTime: e.roleAtTime ?? null,
          companyAtTime: e.companyAtTime ?? null,
          note: e.note ?? null,
        })),
      };
      const out = await analyze({ data: payload });
      updatePerson(person.id, {
        aiSignal: out.signal,
        aiConfidence: out.confidence,
        aiReasoning: out.reasoning,
        aiNudge: out.nudge,
        aiArcSummary: out.arcSummary,
        aiGeneratedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to analyze relationship";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate on open if not cached. Use cached on later opens.
  useEffect(() => {
    if (person.aiSignal) return;
    if (ranForRef.current === person.id) return;
    ranForRef.current = person.id;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id]);

  const copyNudge = async () => {
    if (!person.aiNudge) return;
    const text = `Subject: ${person.aiNudge.subject}\n\n${person.aiNudge.body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Nudge copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const hasRead = !!person.aiSignal;

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Signal</span>
      </div>

      {loading && !hasRead && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          Analyzing relationship…
        </div>
      )}

      {error && !hasRead && (
        <div className="space-y-2">
          <div className="text-xs text-destructive">{error}</div>
          <button
            type="button"
            onClick={run}
            className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-muted"
          >
            Retry
          </button>
        </div>
      )}

      {hasRead && (
        <>
          <SignalBadge signal={person.aiSignal} confidence={person.aiConfidence} />
          {person.aiReasoning && (
            <p className="text-sm text-foreground leading-relaxed">{person.aiReasoning}</p>
          )}

          {person.aiNudge && (
            <div className="rounded-md border border-border bg-muted/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setNudgeOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition"
              >
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                  Suggested follow-up
                </span>
                <span className="truncate text-xs text-foreground flex-1">
                  {person.aiNudge.subject}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                    nudgeOpen && "rotate-180",
                  )}
                />
              </button>
              {nudgeOpen && (
                <div className="border-t border-border bg-background/50 p-3 space-y-2">
                  <div className="whitespace-pre-wrap text-xs text-foreground leading-relaxed">
                    {person.aiNudge.body}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={copyNudge}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-foreground hover:bg-muted"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground opacity-60 cursor-not-allowed"
                    >
                      <Mail className="h-3 w-3" />
                      Open in email
                      <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide">coming soon</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HubSpotExportButton({
  people,
  encounters,
}: {
  people: Person[];
  encounters: Encounter[];
}) {
  const queueCount = buildHubSpotQueue(people).length;
  const disabled = queueCount === 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const n = downloadHubSpotCsv(people, encounters);
        toast.success(`Exported ${n} lead${n === 1 ? "" : "s"} to CSV`, {
          description: "Import via HubSpot → Contacts → Import, and map columns to properties.",
        });
      }}
      title={
        disabled
          ? "No prioritized leads to export yet"
          : `Export ${queueCount} prioritized lead${queueCount === 1 ? "" : "s"} (Tire-kickers excluded)`
      }
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
    >
      <Download className="h-3.5 w-3.5" />
      Export to HubSpot (CSV)
      {queueCount > 0 && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {queueCount}
        </span>
      )}
    </button>
  );
}

function HubSpotImportButton({ existing }: { existing: Person[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const result = parseHubSpotCsv(text, existing);
      if (result.people.length > 0) addPeople(result.people);
      if (result.total === 0) {
        toast.error("No rows found in the CSV.");
      } else {
        toast.success(`Imported ${result.added} contact${result.added === 1 ? "" : "s"}`, {
          description:
            result.skipped > 0
              ? `${result.skipped} skipped (duplicate or missing name).`
              : `From HubSpot CSV (${result.total} rows).`,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not parse the CSV file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title="Import a HubSpot contacts CSV export"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? "Importing…" : "Import from HubSpot"}
      </button>
    </>
  );
}
