import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Download, Map as MapIcon, PanelRightClose, PanelRightOpen, Radar, Table as TableIcon } from "lucide-react";
import { isCoverageGap, type Conference, type DecisionStatus } from "@/lib/conferences";
import { listConferences, setStatus as setStatusFn, toggleRep as toggleRepFn, updateConference as updateConferenceFn } from "@/lib/conferences.functions";
import { ConferenceTable } from "@/components/conference-radar/ConferenceTable";
import { MapView } from "@/components/conference-radar/MapView";
import { TimelineView } from "@/components/conference-radar/TimelineView";
import { FilterBar, DEFAULT_FILTERS, type Filters } from "@/components/conference-radar/FilterBar";
import { DecisionPanel } from "@/components/conference-radar/DecisionPanel";
import { AgentStatusButton } from "@/components/conference-radar/AgentStatusButton";
import { TopNav } from "@/components/TopNav";
import { getActivePlan, setPlanItemStatus } from "@/lib/planning.functions";
import type { Insight } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const qc = useQueryClient();
  const fetchAll = useServerFn(listConferences);
  const callSetStatus = useServerFn(setStatusFn);
  const callToggleRep = useServerFn(toggleRepFn);
  const callUpdate = useServerFn(updateConferenceFn);
  const fetchActivePlan = useServerFn(getActivePlan);
  const callSetPlanItemStatus = useServerFn(setPlanItemStatus);

  const { data: conferences = [], isLoading } = useQuery({
    queryKey: ["conferences"],
    queryFn: () => fetchAll(),
  });

  const { data: activePlan } = useQuery({
    queryKey: ["activePlan"],
    queryFn: () => fetchActivePlan(),
  });

  const planItemConfIds = useMemo(
    () => new Set((activePlan?.items ?? []).map((i) => i.conferenceId)),
    [activePlan],
  );

  const addToPlanMutation = useMutation({
    mutationFn: (conferenceId: string) => {
      if (!activePlan) throw new Error("No active plan");
      return callSetPlanItemStatus({
        data: { planId: activePlan.plan.id, conferenceId, planStatus: "considering" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activePlan"] });
      toast.success(`Added to ${activePlan?.plan.name ?? "plan"}`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["conferences"] });

  const statusMutation = useMutation({
    mutationFn: (v: { id: string; status: DecisionStatus }) => callSetStatus({ data: v }),
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const repMutation = useMutation({
    mutationFn: (v: { id: string; rep: string }) => callToggleRep({ data: v }),
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const updateMutation = useMutation({
    mutationFn: (c: Conference) => callUpdate({
      data: {
        id: c.id,
        name: c.name,
        startDate: c.startDate,
        endDate: c.endDate,
        city: c.city,
        country: c.country,
        region: c.region,
        vertical: c.vertical,
        estimatedAudienceSize: c.estimatedAudienceSize,
        tags: c.tags,
        sourceUrl: c.sourceUrl,
      },
    }),
    onSuccess: () => { invalidate(); toast.success("Saved"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

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

  const toggleRep = (conferenceId: string, rep: string) => repMutation.mutate({ id: conferenceId, rep });
  const setStatus = (conferenceId: string, status: DecisionStatus) => statusMutation.mutate({ id: conferenceId, status });
  const updateConference = (updated: Conference) => updateMutation.mutate(updated);

  const applyInsight = (insight: Insight) => {
    if (!insight.action) return;
    const next = { ...DEFAULT_FILTERS };
    switch (insight.action.kind) {
      case "filter-ids": next.ids = insight.action.ids; break;
      case "filter-vertical": next.verticals = [insight.action.vertical]; break;
      case "filter-region": next.regions = [insight.action.region]; break;
      case "filter-gaps": next.gapsOnly = true; break;
    }
    setFilters(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Radar className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground">Grain Conference Radar</h1>
                <p className="text-xs text-muted-foreground">Catalog of every conference the agent has discovered.</p>
              </div>
            </div>
            <div className="hidden md:block h-8 w-px bg-border" />
            <TopNav />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <AgentStatusButton />
            <Stat label="Conferences" value={stats.total} />
            <Stat label="Coverage gaps" value={stats.gaps} accent={stats.gaps > 0 ? "text-red-700" : "text-foreground"} />
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              {panelOpen ? "Hide" : "Insights"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] gap-4 px-6 py-6">
        <div className="flex-1 min-w-0 space-y-4">
          <FilterBar filters={filters} onChange={setFilters} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {isLoading ? "Loading…" : <>Showing <span className="font-medium text-foreground">{filtered.length}</span> of {conferences.length} conferences</>}
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
            <div className="flex items-center gap-2">
              <ExportButton conferences={filtered} />
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>

          {view === "table" && (
            <ConferenceTable
              conferences={filtered}
              onToggleRep={toggleRep}
              onSetStatus={setStatus}
              onUpdateConference={updateConference}
              planItemConferenceIds={planItemConfIds}
              onAddToPlan={activePlan ? (id) => addToPlanMutation.mutate(id) : undefined}
              activePlanName={activePlan?.plan.name}
            />
          )}
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
            value === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ExportButton({ conferences }: { conferences: Conference[] }) {
  const exportCsv = () => {
    const headers = [
      "Name","Start Date","End Date","City","Country","Region","Vertical",
      "Audience","Tier","ICP Score","Status","Assigned Reps","Tags","Source URL",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = conferences.map((c) => [
      c.name, c.startDate, c.endDate, c.city, c.country, c.region, c.vertical,
      c.estimatedAudienceSize, c.tier, c.icpScore, c.status,
      (c.assignedReps ?? []).join("; "), (c.tags ?? []).join("; "), c.sourceUrl ?? "",
    ].map(escape).join(","));
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conferences-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${conferences.length} conferences`);
  };
  return (
    <button
      type="button"
      onClick={exportCsv}
      disabled={conferences.length === 0}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </button>
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
