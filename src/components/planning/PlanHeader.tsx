import { useEffect, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Plan, PlanItemWithConference } from "@/lib/planning";
import { cn } from "@/lib/utils";

interface Props {
  plan: Plan;
  items: PlanItemWithConference[];
  onSaveConfig: (config: { annualBudgetUsd?: number; plannedRepsPerConference?: number; name?: string }) => void;
  saving?: boolean;
}

export function PlanHeader({ plan, items, onSaveConfig, saving }: Props) {
  const [editing, setEditing] = useState(false);
  const [reps, setReps] = useState(String(plan.plannedRepsPerConference));
  const [name, setName] = useState(plan.name);

  useEffect(() => {
    if (!editing) {
      setReps(String(plan.plannedRepsPerConference));
      setName(plan.name);
    }
  }, [plan, editing]);

  const save = () => {
    const r = Math.max(1, Math.min(20, Math.round(Number(reps) || 1)));
    onSaveConfig({
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
