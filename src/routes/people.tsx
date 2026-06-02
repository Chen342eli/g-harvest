import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { usePeopleData } from "@/lib/people-store";
import { computeBadges, derivePerson } from "@/lib/matching";
import type { Temperature, EncounterVertical, Encounter, Person } from "@/lib/people-types";
import { ENCOUNTER_VERTICALS } from "@/lib/people-types";
import { TempDot } from "@/components/people/TempControls";
import { BadgeList } from "@/components/people/Badges";
import { cn } from "@/lib/utils";
import { SALES_TEAM } from "@/lib/conferences";

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
// Phase 1: prioritize by most recent activity (lastSeenAt desc) by default.
// Phase 3 will replace the default with an AI-signal-driven sort.
//   → PLUG IN: when sortKey === "ai", sort by row.person.aiSignal then aiConfidence.

type SortKey = "person" | "role" | "vertical" | "met" | "lastSeen" | "trend";
type SortDir = "asc" | "desc";

function RelationshipsPage() {
  const data = usePeopleData();
  const [search, setSearch] = useState("");
  const [verticalFilter, setVerticalFilter] = useState<EncounterVertical | "all">("all");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("lastSeen");
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
      <TopNav
        rightSlot={
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold tabular-nums text-foreground">{sorted.length}</span> of {enriched.length} people
            </span>
          </div>
        }
      />

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
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,2fr)_110px_70px_90px_90px_minmax(0,1.6fr)] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
            <SortHeader label="Person" k="person" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <SortHeader label="Role @ Company" k="role" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <SortHeader label="Vertical" k="vertical" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <SortHeader label="Met" k="met" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
            <SortHeader label="Last seen" k="lastSeen" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <SortHeader label="Trend" k="trend" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <span>Signals</span>
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
                    "grid w-full grid-cols-1 gap-1 px-3 py-2.5 text-left transition hover:bg-muted/40 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_110px_70px_90px_90px_minmax(0,1.6fr)] lg:items-center lg:gap-3",
                    selectedId === person.id && "bg-muted/60",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{person.fullName}</div>
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
                    <TrendArrow trend={trend} />
                    <TempSparkline encs={derived.encounters} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {latestTemp && <TempDot t={latestTemp} />}
                    <BadgeList badges={badges} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Floating detail panel */}
        {selected && (
          <aside
            className="absolute right-6 top-6 z-20 w-[420px] max-w-[calc(100%-3rem)] max-h-[calc(100vh-8rem)] overflow-auto rounded-lg border border-border bg-card shadow-xl"
            role="dialog"
            aria-label={`${selected.person.fullName} details`}
          >
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <PersonDetail
              person={selected.person}
              encounters={selected.derived.encounters}
              badges={selected.badges}
            />
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

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arc</h3>
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

      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        🤖 AI relationship read — coming in Phase 2
      </div>
    </div>
  );
}
