import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  Download,
  Map as MapIcon,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Sparkles,
  Table as TableIcon,
} from "lucide-react";
import {
  getActivePlan,
  setPlanItemStatus as setPlanItemStatusFn,
} from "@/lib/planning.functions";
import {
  listConferences,
  setStatus as setStatusFn,
  toggleRep as toggleRepFn,
  updateConference as updateConferenceFn,
} from "@/lib/conferences.functions";
import { isCommitted } from "@/lib/planning";
import { isCoverageGap, type Conference, type DecisionStatus } from "@/lib/conferences";
import { TopNav } from "@/components/TopNav";
import { AgentStatusButton } from "@/components/conference-radar/AgentStatusButton";
import { ConferenceTable } from "@/components/conference-radar/ConferenceTable";
import { MapView } from "@/components/conference-radar/MapView";
import { TimelineView } from "@/components/conference-radar/TimelineView";
import { FilterBar, DEFAULT_FILTERS, type Filters } from "@/components/conference-radar/FilterBar";
import { DecisionPanel } from "@/components/conference-radar/DecisionPanel";
import { Button } from "@/components/ui/button";
import type { Insight } from "@/lib/insights";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Season Planner — Grain Harvest" },
      { name: "description", content: "Catalog and approved annual conference plan." },
    ],
  }),
  component: PlanningPage,
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

function PlanningPage() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getActivePlan);
  const fetchCatalog = useServerFn(listConferences);
  const callSetPlanItemStatus = useServerFn(setPlanItemStatusFn);
  const callConfSetStatus = useServerFn(setStatusFn);
  const callConfToggleRep = useServerFn(toggleRepFn);
  const callConfUpdate = useServerFn(updateConferenceFn);

  const planQuery = useQuery({ queryKey: ["active-plan"], queryFn: () => fetchPlan() });
  const catalogQuery = useQuery({ queryKey: ["conferences"], queryFn: () => fetchCatalog() });

  const isLoading = planQuery.isLoading || catalogQuery.isLoading;
  const conferences = catalogQuery.data ?? [];

  const hasPlan = useMemo(
    () => (planQuery.data?.items ?? []).some((i) => isCommitted(i.planStatus)),
    [planQuery.data],
  );

  const planItemConfIds = useMemo(
    () => new Set((planQuery.data?.items ?? []).map((i) => i.conferenceId)),
    [planQuery.data],
  );

  const committedItems = useMemo(
    () => (planQuery.data?.items ?? []).filter((i) => isCommitted(i.planStatus)),
    [planQuery.data],
  );

  // Source dataset: when a plan is approved → only committed; otherwise → entire catalog.
  const sourceConferences: Conference[] = useMemo(() => {
    if (!hasPlan) return conferences;
    const map = new Map(conferences.map((c) => [c.id, c]));
    const out: Conference[] = [];
    for (const i of committedItems) {
      const c = map.get(i.conferenceId);
      if (c) out.push(c);
    }
    return out;
  }, [hasPlan, conferences, committedItems]);

  const addToPlanMutation = useMutation({
    mutationFn: (conferenceId: string) =>
      callSetPlanItemStatus({
        data: { planId: planQuery.data!.plan.id, conferenceId, planStatus: "shortlist" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-plan"] });
      toast.success("Added to plan as Shortlist");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["conferences"] });

  const statusMutation = useMutation({
    mutationFn: (v: { id: string; status: DecisionStatus }) => callConfSetStatus({ data: v }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });
  const repMutation = useMutation({
    mutationFn: (v: { id: string; rep: string }) => callConfToggleRep({ data: v }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });
  const updateMutation = useMutation({
    mutationFn: (c: Conference) => callConfUpdate({
      data: {
        id: c.id, name: c.name, startDate: c.startDate, endDate: c.endDate,
        city: c.city, country: c.country, region: c.region, vertical: c.vertical,
        estimatedAudienceSize: c.estimatedAudienceSize, tags: c.tags, sourceUrl: c.sourceUrl,
      },
    }),
    onSuccess: () => { invalidate(); toast.success("Saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("table");
  const [panelOpen, setPanelOpen] = useState(true);

  const filtered = useMemo(() => applyFilters(sourceConferences, filters), [sourceConferences, filters]);

  const stats = useMemo(() => {
    const gaps = sourceConferences.filter(isCoverageGap);
    const going = sourceConferences.filter((c) => c.status === "Going").length;
    const considering = sourceConferences.filter((c) => c.status === "Considering").length;
    const passed = sourceConferences.filter((c) => c.status === "Passed").length;
    return { total: sourceConferences.length, gaps: gaps.length, going, considering, passed };
  }, [sourceConferences]);

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
      <TopNav
        rightSlot={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <AgentStatusButton />
            <Stat label={hasPlan ? "In plan" : "Conferences"} value={stats.total} />
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
        }
      />

      <main className="mx-auto flex max-w-[1600px] gap-4 px-6 py-6">
        <div className="flex-1 min-w-0 space-y-4">
          {!isLoading && (hasPlan ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{planQuery.data?.plan.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {committedItems.length} approved conference{committedItems.length === 1 ? "" : "s"} — your committed plan for {planQuery.data?.plan.year}.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/planning/build">
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit plan
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-gradient-to-r from-primary/10 to-primary/5 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Time to build your annual plan</h2>
                  <p className="text-xs text-muted-foreground">
                    Browse the catalog below, then set your budget and pick the must-go conferences for the year.
                  </p>
                </div>
              </div>
              <Button asChild size="sm">
                <Link to="/planning/build">
                  Build the plan <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))}

          <FilterBar filters={filters} onChange={setFilters} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {isLoading ? "Loading…" : <>Showing <span className="font-medium text-foreground">{filtered.length}</span> of {stats.total} {hasPlan ? "approved" : "conferences"}</>}
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
              onToggleRep={(id, rep) => repMutation.mutate({ id, rep })}
              onSetStatus={(id, status) => statusMutation.mutate({ id, status })}
              onUpdateConference={(c) => updateMutation.mutate(c)}
              planItemConferenceIds={planItemConfIds}
              onAddToPlan={!hasPlan && planQuery.data ? (id) => addToPlanMutation.mutate(id) : undefined}
              activePlanName={planQuery.data?.plan.name}
            />
          )}
          {view === "map" && <MapView conferences={filtered} />}
          {view === "timeline" && (
            <TimelineView conferences={filtered} onSetStatus={(id, status) => statusMutation.mutate({ id, status })} />
          )}
        </div>

        {panelOpen && (
          <DecisionPanel
            conferences={sourceConferences}
            onClose={() => setPanelOpen(false)}
            onSetStatus={(id, status) => statusMutation.mutate({ id, status })}
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
