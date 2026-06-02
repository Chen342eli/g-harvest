import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
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

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Planning — Grain Conference Radar" },
      { name: "description", content: "Active annual plan: budget, must-go, coverage and recommendations." },
    ],
  }),
  component: PlanningPage,
});

function PlanningPage() {
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
    onSuccess: () => {
      invalidate();
      toast.success("Removed from plan");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const configMutation = useMutation({
    mutationFn: (cfg: { annualBudgetUsd?: number; plannedRepsPerConference?: number; name?: string }) =>
      callUpdateConfig({ data: { planId: planQuery.data!.plan.id, ...cfg } }),
    onSuccess: () => {
      invalidate();
      toast.success("Plan updated");
    },
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
    onSuccess: () => {
      invalidate();
      toast.success("Added to plan as Shortlist");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">Planning</h1>
              <p className="text-xs text-muted-foreground">Build your annual conference plan against budget.</p>
            </div>
          </div>
          <TopNav />
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
          </>
        )}
      </main>
    </div>
  );
}
