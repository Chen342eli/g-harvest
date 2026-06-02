import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, CalendarRange, Pencil, Sparkles } from "lucide-react";
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
import type { Conference, DecisionStatus } from "@/lib/conferences";
import { TopNav } from "@/components/TopNav";
import { AgentStatusButton } from "@/components/conference-radar/AgentStatusButton";
import { ConferenceTable } from "@/components/conference-radar/ConferenceTable";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Planning — Grain Conference Radar" },
      { name: "description", content: "Catalog and approved annual conference plan." },
    ],
  }),
  component: PlanningPage,
});

function PlanningPage() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getActivePlan);
  const fetchCatalog = useServerFn(listConferences);
  const callSetStatus = useServerFn(setPlanItemStatusFn);
  const callConfSetStatus = useServerFn(setStatusFn);
  const callConfToggleRep = useServerFn(toggleRepFn);
  const callConfUpdate = useServerFn(updateConferenceFn);

  const planQuery = useQuery({ queryKey: ["active-plan"], queryFn: () => fetchPlan() });
  const catalogQuery = useQuery({ queryKey: ["conferences"], queryFn: () => fetchCatalog() });

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

  const committedConferences: Conference[] = useMemo(() => {
    const cat = catalogQuery.data ?? [];
    const map = new Map(cat.map((c) => [c.id, c]));
    const out: Conference[] = [];
    for (const i of committedItems) {
      const c = map.get(i.conferenceId);
      if (c) out.push(c);
    }
    return out;
  }, [committedItems, catalogQuery.data]);

  const addMutation = useMutation({
    mutationFn: (conferenceId: string) =>
      callSetStatus({
        data: { planId: planQuery.data!.plan.id, conferenceId, planStatus: "shortlist" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-plan"] });
      toast.success("Added to plan as Shortlist");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

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

  return (
    <div className="min-h-screen bg-background">
      <TopNav rightSlot={<AgentStatusButton />} />

      <main className="mx-auto max-w-[1600px] space-y-4 px-6 py-6">
        {planQuery.isLoading || catalogQuery.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : hasPlan ? (
          <>
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

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Your approved conferences</h2>
              <ConferenceTable
                conferences={committedConferences}
                onToggleRep={(id, rep) => confRepMutation.mutate({ id, rep })}
                onSetStatus={(id, status) => confStatusMutation.mutate({ id, status })}
                onUpdateConference={(c) => confUpdateMutation.mutate(c)}
                planItemConferenceIds={planItemConfIds}
                activePlanName={planQuery.data?.plan.name}
              />
            </section>
          </>
        ) : (
          <>
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
                onAddToPlan={planQuery.data ? (id) => addMutation.mutate(id) : undefined}
                activePlanName={planQuery.data?.plan.name}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
