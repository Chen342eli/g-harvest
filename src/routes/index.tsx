import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Map as MapIcon, PanelRightClose, PanelRightOpen, Radar, Table as TableIcon } from "lucide-react";
import { SEED_CONFERENCES, isCoverageGap, type Conference, type DecisionStatus } from "@/lib/conferences";
import { ConferenceTable } from "@/components/conference-radar/ConferenceTable";
import { MapView } from "@/components/conference-radar/MapView";
import { TimelineView } from "@/components/conference-radar/TimelineView";
import { FilterBar, DEFAULT_FILTERS, type Filters } from "@/components/conference-radar/FilterBar";
import { DecisionPanel } from "@/components/conference-radar/DecisionPanel";
import type { Insight } from "@/lib/insights";
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
  const idSet = f.ids.length ? new Set(f.ids) : null;
  return items.filter((c) => {
    if (idSet && !idSet.has(c.id)) return false;
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
  const [panelOpen, setPanelOpen] = useState(true);

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

  const applyInsight = (insight: Insight) => {
    if (!insight.action) return;
    const next = { ...DEFAULT_FILTERS };
    switch (insight.action.kind) {
      case "filter-ids":
        next.ids = insight.action.ids;
        break;
      case "filter-vertical":
        next.verticals = [insight.action.vertical];
        break;
      case "filter-region":
        next.regions = [insight.action.region];
        break;
      case "filter-gaps":
        next.gapsOnly = true;
        break;
    }
    setFilters(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
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
            <Stat label="Going" value={stats.going} accent="text-emerald-700" />
            <Stat label="Coverage gaps" value={stats.gaps} accent={stats.gaps > 0 ? "text-red-700" : "text-foreground"} />
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              {panelOpen ? "Hide" : "Decisions"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] gap-4 px-6 py-6">
        <div className="flex-1 min-w-0 space-y-4">
          <FilterBar filters={filters} onChange={setFilters} />

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
            </div>
            <ViewToggle value={view} onChange={setView} />
          </div>

          {view === "table" && <ConferenceTable conferences={filtered} onToggleRep={toggleRep} onSetStatus={setStatus} onUpdateConference={updateConference} />}
          {view === "map" && <MapView conferences={filtered} />}
          {view === "timeline" && <TimelineView conferences={filtered} onSetStatus={setStatus} />}
        </div>

        {panelOpen && (
          <DecisionPanel
            conferences={conferences}
            onClose={() => setPanelOpen(false)}
            onSetStatus={setStatus}
            onApplyInsight={applyInsight}
          />
        )}
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
