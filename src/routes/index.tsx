import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Map as MapIcon, Radar, Table as TableIcon, X } from "lucide-react";
import { SEED_CONFERENCES, isCoverageGap, type Conference, type DecisionStatus } from "@/lib/conferences";
import { ConferenceTable } from "@/components/conference-radar/ConferenceTable";
import { MapView } from "@/components/conference-radar/MapView";
import { TimelineView } from "@/components/conference-radar/TimelineView";
import { FilterBar, DEFAULT_FILTERS, type Filters } from "@/components/conference-radar/FilterBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grain Conference Radar" },
      { name: "description", content: "Internal tool to prioritize industry conferences and coverage for the sales team." },
    ],
  }),
  component: Index,
});

type ViewMode = "table" | "map" | "timeline";

function applyFilters(items: Conference[], f: Filters): Conference[] {
  const q = f.search.trim().toLowerCase();
  const from = f.dateFrom ? new Date(f.dateFrom).getTime() : null;
  const to = f.dateTo ? new Date(f.dateTo).getTime() : null;
  return items.filter((c) => {
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (f.verticals.length && !f.verticals.includes(c.vertical)) return false;
    if (f.regions.length && !f.regions.includes(c.region)) return false;
    if (f.tiers.length && !f.tiers.includes(c.tier)) return false;
    if (f.statuses.length && !f.statuses.includes(c.status)) return false;
    const start = new Date(c.startDate).getTime();
    const end = new Date(c.endDate).getTime();
    if (from !== null && end < from) return false;
    if (to !== null && start > to) return false;
    if (f.gapsOnly && !isCoverageGap(c)) return false;
    return true;
  });
}

function Index() {
  const [conferences, setConferences] = useState<Conference[]>(SEED_CONFERENCES);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("table");

  const filtered = useMemo(() => applyFilters(conferences, filters), [conferences, filters]);

  const stats = useMemo(() => {
    const tier1 = conferences.filter((c) => c.tier === "Tier 1");
    const gaps = conferences.filter(isCoverageGap);
    const going = conferences.filter((c) => c.status === "Going").length;
    const considering = conferences.filter((c) => c.status === "Considering").length;
    const passed = conferences.filter((c) => c.status === "Passed").length;
    return { total: conferences.length, tier1: tier1.length, gaps: gaps.length, going, considering, passed };
  }, [conferences]);

  const toggleRep = (conferenceId: string, rep: string) => {
    setConferences((prev) =>
      prev.map((c) =>
        c.id === conferenceId
          ? {
              ...c,
              assignedReps: c.assignedReps.includes(rep)
                ? c.assignedReps.filter((r) => r !== rep)
                : [...c.assignedReps, rep],
            }
          : c,
      ),
    );
  };

  const setStatus = (conferenceId: string, status: DecisionStatus) => {
    setConferences((prev) => prev.map((c) => (c.id === conferenceId ? { ...c, status } : c)));
  };

  const updateConference = (updated: Conference) => {
    setConferences((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Radar className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Grain Conference Radar
              </h1>
              <p className="text-xs text-muted-foreground">
                Prioritize where to invest and who covers it.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Stat label="Conferences" value={stats.total} />
            <Stat label="Tier 1" value={stats.tier1} accent="text-emerald-700" />
            <Stat label="Coverage gaps" value={stats.gaps} accent={stats.gaps > 0 ? "text-red-700" : "text-foreground"} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-6 py-6">
        <FilterBar filters={filters} onChange={setFilters} />

        {stats.gaps > 0 && (
          <button
            type="button"
            onClick={() =>
              setFilters((f) =>
                f.gapsOnly
                  ? { ...f, gapsOnly: false }
                  : { ...DEFAULT_FILTERS, gapsOnly: true },
              )
            }
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition",
              filters.gapsOnly
                ? "border-red-300 bg-red-100 text-red-900 hover:bg-red-200"
                : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
            )}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold tabular-nums">{stats.gaps}</span>{" "}
                {stats.gaps === 1 ? "conference is" : "conferences are"} marked{" "}
                <span className="font-semibold">Going</span> but have no reps assigned.{" "}
                {filters.gapsOnly ? (
                  <span className="font-medium">Showing them now — click to clear.</span>
                ) : (
                  <span className="font-medium underline underline-offset-2">
                    Click to see them.
                  </span>
                )}
              </span>
            </span>
            {filters.gapsOnly && <X className="h-4 w-4 shrink-0 opacity-70" />}
          </button>
        )}


        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> of {conferences.length} conferences
            <span className="mx-2 text-border">|</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Going <span className="font-medium text-foreground tabular-nums">{stats.going}</span>
            </span>
            <span className="mx-1.5 text-border">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
              Considering <span className="font-medium text-foreground tabular-nums">{stats.considering}</span>
            </span>
            <span className="mx-1.5 text-border">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400" />
              Passed <span className="font-medium text-foreground tabular-nums">{stats.passed}</span>
            </span>
            <span className="mx-1.5 text-border">·</span>
            <span className={stats.gaps > 0 ? "text-red-700" : ""}>
              Gaps (Going &amp; unstaffed) <span className="font-medium tabular-nums">{stats.gaps}</span>
            </span>
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>

        {view === "table" && <ConferenceTable conferences={filtered} onToggleRep={toggleRep} onSetStatus={setStatus} onUpdateConference={updateConference} />}
        {view === "map" && <MapView conferences={filtered} />}
        {view === "timeline" && <TimelineView conferences={filtered} onSetStatus={setStatus} />}
      </main>
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const items: { id: ViewMode; label: string; icon: typeof TableIcon }[] = [
    { id: "table", label: "Table", icon: TableIcon },
    { id: "map", label: "Map", icon: MapIcon },
    { id: "timeline", label: "Timeline", icon: CalendarDays },
  ];
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition",
            value === id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className={`text-lg font-semibold tabular-nums ${accent ?? "text-foreground"}`}>{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}
