import { useEffect, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  computePlanTotals,
  formatUsd,
  type Plan,
  type PlanItemWithConference,
  type PlanTotals,
} from "@/lib/planning";
import { cn } from "@/lib/utils";

interface Props {
  plan: Plan;
  items: PlanItemWithConference[];
  onSaveConfig: (config: { annualBudgetUsd?: number; plannedRepsPerConference?: number; name?: string }) => void;
  saving?: boolean;
}

export function PlanHeader({ plan, items, onSaveConfig, saving }: Props) {
  const totals = computePlanTotals(items, plan);

  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState(String(plan.annualBudgetUsd));
  const [reps, setReps] = useState(String(plan.plannedRepsPerConference));
  const [name, setName] = useState(plan.name);

  // Keep local state in sync if plan changes from outside
  useEffect(() => {
    if (!editing) {
      setBudget(String(plan.annualBudgetUsd));
      setReps(String(plan.plannedRepsPerConference));
      setName(plan.name);
    }
  }, [plan, editing]);

  const save = () => {
    const b = Number(budget);
    const r = Math.max(1, Math.min(20, Math.round(Number(reps) || 1)));
    onSaveConfig({
      annualBudgetUsd: Number.isFinite(b) && b >= 0 ? b : undefined,
      plannedRepsPerConference: r,
      name: name.trim() || undefined,
    });
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-72 text-sm font-semibold"
            />
          ) : (
            <h1 className="text-base font-semibold tracking-tight text-foreground">{plan.name}</h1>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            Active planning workspace · {items.length} conference{items.length === 1 ? "" : "s"} in scope
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Field label="Annual budget" editing={editing}>
            {editing ? (
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="h-8 w-32 pl-5 text-right text-sm tabular-nums"
                />
              </div>
            ) : (
              <div className="text-right text-sm font-semibold tabular-nums text-foreground">
                {formatUsd(plan.annualBudgetUsd)}
              </div>
            )}
          </Field>

          <Field label="Reps / conf" editing={editing}>
            {editing ? (
              <Input
                type="number"
                min={1}
                max={20}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="h-8 w-16 text-right text-sm tabular-nums"
              />
            ) : (
              <div className="text-right text-sm font-semibold tabular-nums text-foreground">
                {plan.plannedRepsPerConference}
              </div>
            )}
          </Field>

          {editing ? (
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="mr-1 h-3.5 w-3.5" />
              Save
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <Totals totals={totals} budget={plan.annualBudgetUsd} />
    </div>
  );
}

function Field({ label, editing, children }: { label: string; editing: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end">
      <span className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className={cn(editing && "rounded-md")}>{children}</div>
    </div>
  );
}

function Totals({ totals, budget }: { totals: PlanTotals; budget: number }) {
  const committedPct = budget > 0 ? Math.min(100, (totals.committed / budget) * 100) : 0;
  const pipelineExtraPct =
    budget > 0
      ? Math.max(0, Math.min(100 - committedPct, ((totals.pipeline - totals.committed) / budget) * 100))
      : 0;
  const overrun = totals.pipelineOverrun > 0;
  const overBudget = totals.remaining < 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric
            label="Must-go"
            value={formatUsd(totals.mustGo)}
            tooltip="Conferences locked as must-go for this plan."
          />
          <Metric
            label="Committed"
            value={formatUsd(totals.committed)}
            valueClassName={overBudget ? "text-red-700" : "text-emerald-700"}
            tooltip="Must-go + Approved. Counted against your budget."
          />
          <Metric
            label="Remaining"
            value={formatUsd(totals.remaining)}
            valueClassName={overBudget ? "text-red-700" : "text-foreground"}
            tooltip="Annual budget − Committed. Negative means you're over budget."
          />
          <Metric
            label="Pipeline (incl. shortlist)"
            value={formatUsd(totals.pipeline)}
            valueClassName={overrun ? "text-amber-700" : "text-foreground"}
            tooltip={
              overrun
                ? `Approving all shortlist items would exceed budget by ${formatUsd(totals.pipelineOverrun)}.`
                : "Total cost if every Must-go + Approved + Shortlist item runs."
            }
          />
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="flex h-full">
            <div
              className={cn("h-full", overBudget ? "bg-red-500" : "bg-emerald-500")}
              style={{ width: `${committedPct}%` }}
              aria-label="Committed"
            />
            <div
              className="h-full bg-amber-400/60"
              style={{ width: `${pipelineExtraPct}%` }}
              aria-label="Shortlist extra"
            />
          </div>
        </div>

        {totals.itemsMissingCost > 0 && (
          <p className="text-[11px] text-amber-700">
            ⚠ {totals.itemsMissingCost} in-pipeline conference{totals.itemsMissingCost === 1 ? "" : "s"} missing cost — totals may be understated.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}

function Metric({
  label,
  value,
  valueClassName,
  tooltip,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-help flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className={cn("text-lg font-semibold tabular-nums text-foreground", valueClassName)}>{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
