import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, CalendarRange, Sparkles } from "lucide-react";
import {
  getActivePlan,
  listAllConferencesWithCost,
  removeFromPlan as removeFromPlanFn,
  setPlanItemStatus as setPlanItemStatusFn,
  updateConferenceCost as updateConferenceCostFn,
  updatePlanConfig as updatePlanConfigFn,
} from "@/lib/planning.functions";
import type { PlanItemStatus } from "@/lib/planning";
import { TopNav } from "@/components/TopNav";
import { PlanHeader } from "@/components/planning/PlanHeader";
import { PlanningTable } from "@/components/planning/PlanningTable";
import { CoveragePanel } from "@/components/planning/CoveragePanel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/planning_/build")({
  head: () => ({
    meta: [
      { title: "Build plan — Planning" },
      { name: "description", content: "Set budget, must-go and shortlist for the year." },
    ],
  }),
  component: PlanBuilderPage,
});

function PlanBuilderPage() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getActivePlan);
  const fetchAll = useServerFn(listAllConferencesWithCost);
  const callSetStatus = useServerFn(setPlanItemStatusFn);
  const callRemove = useServerFn(removeFromPlanFn);
  const callUpdateConfig = useServerFn(updatePlanConfigFn);
  const callUpdateCost = useServerFn(updateConferenceCostFn);

  const planQuery = useQuery({ queryKey: ["active-plan"], queryFn: () => fetchPlan() });
  const allQuery = useQuery({ queryKey: ["all-conferences-cost"], queryFn: () => fetchAll() });

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
  });

  const configMutation = useMutation({
    mutationFn: (cfg: { annualBudgetUsd?: number; plannedRepsPerConference?: number; name?: string }) =>
      callUpdateConfig({ data: { planId: planQuery.data!.plan.id, ...cfg } }),
    onSuccess: () => { invalidate(); toast.success("Plan updated"); },
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
  });

  const addMutation = useMutation({
    mutationFn: (conferenceId: string) =>
      callSetStatus({
        data: { planId: planQuery.data!.plan.id, conferenceId, planStatus: "shortlist" },
      }),
    onSuccess: () => { invalidate(); toast.success("Added to plan as Shortlist"); },
  });

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        rightSlot={
          <Button asChild variant="outline" size="sm">
            <Link to="/planning">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Planning
            </Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-[1600px] space-y-4 px-6 py-6">
        {planQuery.isLoading || allQuery.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : !planQuery.data ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            No active plan found.
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Planning workspace
            </div>

            <PlanHeader
              plan={planQuery.data.plan}
              items={planQuery.data.items}
              onSaveConfig={(cfg) => configMutation.mutate(cfg)}
              saving={configMutation.isPending}
            />

            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <PlanningTable
                items={planQuery.data.items}
                onSetStatus={(conferenceId, planStatus) => statusMutation.mutate({ conferenceId, planStatus })}
                onRemove={(conferenceId) => removeMutation.mutate(conferenceId)}
              />


              <CoveragePanel
                plan={planQuery.data.plan}
                items={planQuery.data.items}
                allConferences={allQuery.data ?? []}
                onAdd={(conferenceId) => addMutation.mutate(conferenceId)}
              />
            </div>

            <div className="flex justify-end">
              <Button asChild size="sm">
                <Link to="/planning">Done — back to Planning</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
