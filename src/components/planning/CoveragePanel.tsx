import { useMemo } from "react";
import { AlertTriangle, Plus, Sparkles } from "lucide-react";
import { REGIONS, VERTICALS, type Conference } from "@/lib/conferences";
import {
  regionCoverage,
  verticalCoverage,
  type CoverageBucket,
  type Plan,
  type PlanItemWithConference,
} from "@/lib/planning";
import { buildRecommendations, findCalendarConflicts } from "@/lib/recommendations";
import { Button } from "@/components/ui/button";

interface ConferenceWithCost extends Conference {
  estimatedCostUsd: number | null;
}

interface Props {
  plan: Plan;
  items: PlanItemWithConference[];
  allConferences: ConferenceWithCost[];
  onAdd: (conferenceId: string) => void;
}

export function CoveragePanel({ plan, items, allConferences, onAdd }: Props) {
  const regions = useMemo(() => regionCoverage(items, REGIONS), [items]);
  const verticals = useMemo(() => verticalCoverage(items, VERTICALS), [items]);
  const recommendations = useMemo(
    () => buildRecommendations({ allConferences, items, plan, planYear: plan.year }),
    [allConferences, items, plan],
  );
  const conflicts = useMemo(() => findCalendarConflicts(items), [items]);

  const confById = useMemo(() => {
    const m = new Map<string, ConferenceWithCost>();
    for (const c of allConferences) m.set(c.id, c);
    return m;
  }, [allConferences]);

  return (
    <aside className="space-y-4">
      <Section title="Region coverage">
        <BucketBars buckets={regions} emptyLabel="No conferences yet" />
      </Section>

      <Section title="Vertical coverage">
        <BucketBars buckets={verticals.filter((b) => b.total > 0)} emptyLabel="No conferences yet" />
      </Section>

      <Section
        title={`Recommendations${recommendations.length ? ` · ${recommendations.length}` : ""}`}
        icon={<Sparkles className="h-3.5 w-3.5 text-amber-500" />}
      >
        {recommendations.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            Nice — no obvious gaps to fill.
          </p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((r) => (
              <div key={r.id} className="rounded-md border border-border bg-background p-2.5">
                <div className="text-xs font-medium text-foreground">{r.title}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{r.detail}</div>
                <ul className="mt-2 space-y-1">
                  {r.conferenceIds.map((id) => {
                    const c = confById.get(id);
                    if (!c) return null;
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2 rounded border border-border/70 bg-card px-2 py-1"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-foreground">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {c.city} · ICP {c.icpScore}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onAdd(id)}
                          className="h-6 w-6 shrink-0 p-0 text-primary hover:bg-primary/10"
                          title="Add to plan as Shortlist"
                          aria-label="Add to plan"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      {conflicts.length > 0 && (
        <Section
          title={`Calendar conflicts · ${conflicts.length}`}
          icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
        >
          <ul className="space-y-1.5">
            {conflicts.map((c) => (
              <li key={`${c.aId}-${c.bId}`} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                <span className="font-medium">{c.aName}</span> overlaps with{" "}
                <span className="font-medium">{c.bName}</span>{" "}
                <span className="text-[10px] opacity-80">({c.overlapStart} → {c.overlapEnd})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </aside>
  );
}

function Section({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function BucketBars({ buckets, emptyLabel }: { buckets: CoverageBucket[]; emptyLabel: string }) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.pipeline, b.total)));
  if (buckets.every((b) => b.total === 0)) {
    return <p className="text-xs italic text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-1.5">
      {buckets.map((b) => {
        const committedPct = (b.committed / max) * 100;
        const pipelineExtraPct = ((b.pipeline - b.committed) / max) * 100;
        const empty = b.committed === 0 && b.pipeline === 0;
        return (
          <div key={b.key} className="text-xs">
            <div className="mb-0.5 flex items-center justify-between">
              <span className={empty ? "text-muted-foreground" : "text-foreground"}>{b.key}</span>
              <span className="tabular-nums text-muted-foreground">
                {b.committed} / {b.total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="flex h-full">
                <div className="h-full bg-emerald-500" style={{ width: `${committedPct}%` }} />
                <div className="h-full bg-amber-400/60" style={{ width: `${pipelineExtraPct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
