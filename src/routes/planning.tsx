import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarRange, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import {
  getActivePlan,
  listAllConferencesWithCost,
  removeFromPlan as removeFromPlanFn,
  setPlanItemStatus as setPlanItemStatusFn,
  updateConferenceCost as updateConferenceCostFn,
  updatePlanConfig as updatePlanConfigFn,
} from "@/lib/planning.functions";
import { listConferences, setStatus as setStatusFn, toggleRep as toggleRepFn, updateConference as updateConferenceFn } from "@/lib/conferences.functions";
import { isCommitted, type PlanItemStatus } from "@/lib/planning";
import type { Conference, DecisionStatus } from "@/lib/conferences";
import { TopNav } from "@/components/TopNav";
import { PlanHeader } from "@/components/planning/PlanHeader";
import { PlanningTable } from "@/components/planning/PlanningTable";
import { CoveragePanel } from "@/components/planning/CoveragePanel";
import { AgentStatusButton } from "@/components/conference-radar/AgentStatusButton";
import { ConferenceTable } from "@/components/conference-radar/ConferenceTable";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Planning — Grain Conference Radar" },
      { name: "description", content: "Build your annual conference plan: budget, must-go, coverage." },
    ],
  }),
  component: PlanningPage,
});

function PlanningPage() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getActivePlan);
  const fetchAll = useServerFn(listAllConferencesWithCost);
  const fetchCatalog = useServerFn(listConferences);
  const callSetStatus = useServerFn(setPlanItemStatusFn);
  const callRemove = useServerFn(removeFromPlanFn);
  const callUpdateConfig = useServerFn(updatePlanConfigFn);
  const callUpdateCost = useServerFn(updateConferenceCostFn);
  const callConfSetStatus = useServerFn(setStatusFn);
  const callConfToggleRep = useServerFn(toggleRepFn);
  const callConfUpdate = useServerFn(updateConferenceFn);

  const planQuery = useQuery({ queryKey: ["active-plan"], queryFn: () => fetchPlan() });
  const allQuery = useQuery({ queryKey: ["all-conferences-cost"], queryFn: () => fetchAll() });
  const catalogQuery = useQuery({ queryKey: ["conferences"], queryFn: () => fetchCatalog() });

  const hasPlan = useMemo(
    () => (planQuery.data?.items ?? []).some((i) => isCommitted(i.planStatus)),
    [planQuery.data],
  );

  const [editorOpen, setEditorOpen] = useState<boolean | null>(null);
  const isEditorOpen = editorOpen ?? !hasPlan;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["active-plan"] });
    qc.invalidateQueries({ queryKey: ["all-conferences-cost"] });
    qc.invalidateQueries({ queryKey: ["conferences"] });
  };

  const statusMutation = useMutation({
    mutationFn: (v: { conferenceId: string; planStatus: PlanItemStatus }) =>
      callSetStatus({ data: { planId: planQuery.data!.plan.id, ...v } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const removeMutation = useMutation({
    mutationFn: (conferenceId: string) =>
      callRemove({ data: { planId: planQuery.data!.plan.id, conferenceId } }),
    onSuccess: () => { invalidate(); toast.success("Removed from plan"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const configMutation = useMutation({
    mutationFn: (cfg: { annualBudgetUsd?: number; plannedRepsPerConference?: number; name?: string }) =>
      callUpdateConfig({ data: { planId: planQuery.data!.plan.id, ...cfg } }),
    onSuccess: () => { invalidate(); toast.success("Plan updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const costMutation = useMutation({
    mutationFn: (v: { conferenceId: string; estimatedCostUsd: number | null }) =>
      callUpdateCost({
        data: {
          conferenceId: v.conferenceId,
          estimatedCostUsd: v.estimatedCostUsd,
          costConfidence: v.estimatedCostUsd == null ? null : "estimated",
        },
      }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save cost"),
  });

  const addMutation = useMutation({
    mutationFn: (conferenceId: string) =>
      callSetStatus({
        data: { planId: planQuery.data!.plan.id, conferenceId, planStatus: "shortlist" },
      }),
    onSuccess: () => { invalidate(); toast.success("Added to plan as Shortlist"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  // Catalog mutations (used in empty-state catalog browse)
  const confStatusMutation = useMutation({
    mutationFn: (v: { id: string; status: DecisionStatus }) => callConfSetStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conferences"] }),
  });
  const confRepMutation = useMutation({
    mutationFn: (v: { id: string; rep: string }) => callConfToggleRep({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conferences"] }),
  });
  const confUpdateMutation = useMutation({
    mutationFn: (c: Conference) => callConfUpdate({
      data: {
        id: c.id, name: c.name, startDate: c.startDate, endDate: c.endDate,
        city: c.city, country: c.country, region: c.region, vertical: c.vertical,
        estimatedAudienceSize: c.estimatedAudienceSize, tags: c.tags, sourceUrl: c.sourceUrl,
      },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["conferences"] }); toast.success("Saved"); },
  });

  const planItemConfIds = useMemo(
    () => new Set((planQuery.data?.items ?? []).map((i) => i.conferenceId)),
    [planQuery.data],
  );

  const committedItems = useMemo(
    () => (planQuery.data?.items ?? []).filter((i) => isCommitted(i.planStatus)),
    [planQuery.data],
  );

  const committedConferences: Conference[] = useMemo(() => {
    const cat = catalogQuery.data ?? [];
    const map = new Map(cat.map((c) => [c.id, c]));
    return committedItems
      .map((i) => map.get(i.conferenceId))
      .filter((c): c is Conference => !!c);
  }, [committedItems, catalogQuery.data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <CalendarRange className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground">Planning</h1>
                <p className="text-xs text-muted-foreground">Catalog, annual plan and discovery — all in one place.</p>
              </div>
            </div>
            <div className="hidden md:block h-8 w-px bg-border" />
            <TopNav />
          </div>
          <AgentStatusButton />
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-6 py-6">
        {planQuery.isLoading || allQuery.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading plan…
          </div>
        ) : !planQuery.data ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            No active plan found. Create one in the database.
          </div>
        ) : (
          <>
            {/* No plan yet → inviting CTA */}
            {!hasPlan && !isEditorOpen && (
              <StartPlanningCard onStart={() => setEditorOpen(true)} />
            )}

            {/* Has plan → quick summary + edit button */}
            {hasPlan && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{planQuery.data.plan.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {committedItems.length} approved conference{committedItems.length === 1 ? "" : "s"} — your committed plan for {planQuery.data.plan.year}.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isEditorOpen ? "secondary" : "outline"}
                  onClick={() => setEditorOpen(!isEditorOpen)}
                >
                  {isEditorOpen ? (
                    <>Close editor <ChevronUp className="ml-1 h-3.5 w-3.5" /></>
                  ) : (
                    <>Edit plan <ChevronDown className="ml-1 h-3.5 w-3.5" /></>
                  )}
                </Button>
              </div>
            )}

            {/* Collapsible planning editor */}
            {isEditorOpen && (
              <div className="space-y-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Planning workspace
                  </div>
                  {hasPlan && (
                    <Button size="sm" variant="ghost" onClick={() => setEditorOpen(false)}>
                      Done
                    </Button>
                  )}
                </div>

                <PlanHeader
                  plan={planQuery.data.plan}
                  items={planQuery.data.items}
                  onSaveConfig={(cfg) => configMutation.mutate(cfg)}
                  saving={configMutation.isPending}
                />

                <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                  <PlanningTable
                    plan={planQuery.data.plan}
                    items={planQuery.data.items}
                    onSetStatus={(conferenceId, planStatus) => statusMutation.mutate({ conferenceId, planStatus })}
                    onRemove={(conferenceId) => removeMutation.mutate(conferenceId)}
                    onSaveCost={(v) => costMutation.mutate(v)}
                  />

                  <CoveragePanel
                    plan={planQuery.data.plan}
                    items={planQuery.data.items}
                    allConferences={allQuery.data ?? []}
                    onAdd={(conferenceId) => addMutation.mutate(conferenceId)}
                  />
                </div>
              </div>
            )}

            {/* Main read view */}
            {hasPlan ? (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">Your approved conferences</h2>
                <ConferenceTable
                  conferences={committedConferences}
                  onToggleRep={(id, rep) => confRepMutation.mutate({ id, rep })}
                  onSetStatus={(id, status) => confStatusMutation.mutate({ id, status })}
                  onUpdateConference={(c) => confUpdateMutation.mutate(c)}
                  planItemConferenceIds={planItemConfIds}
                  activePlanName={planQuery.data.plan.name}
                />
              </section>
            ) : (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Catalog</h2>
                  <span className="text-xs text-muted-foreground">
                    {catalogQuery.data?.length ?? 0} conferences discovered
                  </span>
                </div>
                <ConferenceTable
                  conferences={catalogQuery.data ?? []}
                  onToggleRep={(id, rep) => confRepMutation.mutate({ id, rep })}
                  onSetStatus={(id, status) => confStatusMutation.mutate({ id, status })}
                  onUpdateConference={(c) => confUpdateMutation.mutate(c)}
                  planItemConferenceIds={planItemConfIds}
                  onAddToPlan={(id) => addMutation.mutate(id)}
                  activePlanName={planQuery.data.plan.name}
                />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StartPlanningCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-primary/50 bg-gradient-to-br from-primary/5 to-transparent p-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-foreground">Start your annual plan</h2>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        Set a budget, pick your must-go conferences and shortlist the rest. You only do this once a year — small edits later.
      </p>
      <Button size="sm" className="mt-4" onClick={onStart}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        Start planning
      </Button>
    </div>
  );
}
