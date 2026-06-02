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
  Pencil,
  Sparkles,
  Table as TableIcon,
} from "lucide-react";
import { getActivePlan } from "@/lib/planning.functions";
import {
  listConferences,
  toggleRep as toggleRepFn,
  updateConference as updateConferenceFn,
} from "@/lib/conferences.functions";
import { isCommitted, getPlanLifecycle } from "@/lib/planning";
import { isCoverageGap, type Conference } from "@/lib/conferences";
import { TopNav } from "@/components/TopNav";
import { AgentStatusButton } from "@/components/conference-radar/AgentStatusButton";
import { ConferenceTable } from "@/components/conference-radar/ConferenceTable";
import { MapView } from "@/components/conference-radar/MapView";
import { TimelineView } from "@/components/conference-radar/TimelineView";
import { FilterBar, DEFAULT_FILTERS, type Filters } from "@/components/conference-radar/FilterBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Conference Management — Grain Harvest" },
      { name: "description", content: "Browse the conference catalog and your approved annual plan." },
    ],
  }),
  component: PlanningPage,
});

type ViewMode = "table" | "map" | "timeline";

function applyFilters(items: Conference[], f: Filters, committedIds: Set<string>): Conference[] {
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
    const start = new Date(c.startDate).getTime();
    const end = new Date(c.endDate).getTime();
    if (from !== null && end < from) return false;
    if (to !== null && start > to) return false;
    if (f.gapsOnly && !isCoverageGap(c, committedIds)) return false;
    return true;
  });
}

function PlanningPage() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getActivePlan);
  const fetchCatalog = useServerFn(listConferences);
  const callConfToggleRep = useServerFn(toggleRepFn);
  const callConfUpdate = useServerFn(updateConferenceFn);

  const planQuery = useQuery({ queryKey: ["active-plan"], queryFn: () => fetchPlan() });
  const catalogQuery = useQuery({ queryKey: ["conferences"], queryFn: () => fetchCatalog() });

  const isLoading = planQuery.isLoading || catalogQuery.isLoading;
  const conferences = catalogQuery.data ?? [];

  const lifecycle = getPlanLifecycle(planQuery.data);
  const isApproved = lifecycle === "approved";

  const committedIds = useMemo(
    () =>
      isApproved
        ? new Set(
            (planQuery.data?.items ?? [])
              .filter((i) => isCommitted(i.planStatus))
              .map((i) => i.conferenceId),
          )
        : new Set<string>(),
    [planQuery.data, isApproved],
  );

  const hasPlan = isApproved && committedIds.size > 0;

  const planItemConfIds = useMemo(
    () => new Set((planQuery.data?.items ?? []).map((i) => i.conferenceId)),
    [planQuery.data],
  );

  const [showAll, setShowAll] = useState(false);

  // Source dataset: when a plan exists and showAll=false → committed only; else → full catalog.
  const sourceConferences: Conference[] = useMemo(() => {
    if (!hasPlan || showAll) return conferences;
    return conferences.filter((c) => committedIds.has(c.id));
  }, [hasPlan, showAll, conferences, committedIds]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["conferences"] });

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
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null);
  const view: ViewMode = viewOverride ?? (hasPlan ? "timeline" : "table");

  const filtered = useMemo(
    () => applyFilters(sourceConferences, filters, committedIds),
    [sourceConferences, filters, committedIds],
  );

  const stats = useMemo(() => {
    const gaps = sourceConferences.filter((c) => isCoverageGap(c, committedIds)).length;
    return { total: sourceConferences.length, gaps };
  }, [sourceConferences, committedIds]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />


      <main className="mx-auto max-w-[1600px] space-y-4 px-6 py-6">
        {!isLoading && lifecycle === "approved" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {planQuery.data?.plan.name}
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Approved
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {committedIds.size} approved conference{committedIds.size === 1 ? "" : "s"} — your committed plan for {planQuery.data?.plan.year}.
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/planning/build">
                <Pencil className="mr-1 h-3.5 w-3.5" /> Build / edit plan
              </Link>
            </Button>
          </div>
        )}

        {!isLoading && lifecycle === "draft" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/60 bg-amber-50 px-5 py-3 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {planQuery.data?.plan.name} is in draft
                </h2>
                <p className="text-xs text-muted-foreground">
                  Complete the wizard and approve the plan — the "In plan" view and upcoming events stay hidden until then.
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link to="/planning/build">
                Resume planning <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}

        {!isLoading && lifecycle === "none" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/60 bg-amber-50 px-5 py-3 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">No annual plan yet</h2>
                <p className="text-xs text-muted-foreground">
                  You're seeing the full industry catalog. Start by building the plan.
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link to="/planning/build">
                Start planning <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}

        <FilterBar filters={filters} onChange={setFilters} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {isLoading ? "Loading…" : <>Showing <span className="font-medium text-foreground">{filtered.length}</span> of {stats.total} {hasPlan && !showAll ? "in plan" : "conferences"}</>}
          </div>
          <div className="flex items-center gap-2">
            {hasPlan && (
              <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-medium transition",
                    !showAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  In plan
                </button>
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-medium transition",
                    showAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  Show all (industry)
                </button>
              </div>
            )}
            <ExportButton conferences={filtered} />
            <ViewToggle value={view} onChange={setViewOverride} />
          </div>
        </div>

        {view === "table" && (
          <ConferenceTable
            conferences={filtered}
            onToggleRep={(id, rep) => repMutation.mutate({ id, rep })}
            onUpdateConference={(c) => updateMutation.mutate(c)}
            planItemConferenceIds={planItemConfIds}
            committedIds={committedIds}
            activePlanName={planQuery.data?.plan.name}
          />
        )}
        {view === "map" && (
          <MapView
            conferences={filtered}
            committedIds={committedIds}
            onOpenInTable={(id) => { setFilters({ ...DEFAULT_FILTERS, ids: [id] }); setViewOverride("table"); }}
          />
        )}
        {view === "timeline" && (
          <TimelineView
            conferences={filtered}
            committedIds={committedIds}
            onOpenInTable={(id) => { setFilters({ ...DEFAULT_FILTERS, ids: [id] }); setViewOverride("table"); }}
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
      "Audience","Tier","ICP Score","Assigned Reps","Tags","Source URL",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = conferences.map((c) => [
      c.name, c.startDate, c.endDate, c.city, c.country, c.region, c.vertical,
      c.estimatedAudienceSize, c.tier, c.icpScore,
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
