import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Check,
  CheckCircle2,
  CircleDot,
  LayoutGrid,
  List as ListIcon,
  Map as MapIcon,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  getActivePlan,
  listAllConferencesWithCost,
  setPlanItemStatus as setPlanItemStatusFn,
  setPlanStatus as setPlanStatusFn,
} from "@/lib/planning.functions";
import { toggleRep as toggleRepFn } from "@/lib/conferences.functions";
import {
  isCommitted,
  regionCoverage,
  verticalCoverage,
  type PlanItemStatus,
  type PlanItemWithConference,
} from "@/lib/planning";
import { REGIONS, SALES_TEAM, type Conference, type Vertical } from "@/lib/conferences";
import { buildRecommendations, findCalendarConflicts } from "@/lib/recommendations";
import { TopNav } from "@/components/TopNav";
import { TierBadge } from "@/components/conference-radar/TierBadge";
import { TimelineView } from "@/components/conference-radar/TimelineView";
import { MapView } from "@/components/conference-radar/MapView";
import { RepAssigner } from "@/components/conference-radar/RepAssigner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planning_/build")({
  head: () => ({
    meta: [
      { title: "Build plan — Conference Management" },
      { name: "description", content: "Anchors, coverage, reps, approve — guided plan build." },
    ],
  }),
  component: PlanBuilderPage,
});

const ICP_VERTICALS: Vertical[] = ["Payments", "Fintech", "Treasury"];

type StepId = 1 | 2 | 3 | 4;

const STEPS: { id: StepId; title: string; subtitle: string }[] = [
  { id: 1, title: "Anchors", subtitle: "The events you attend every year." },
  { id: 2, title: "Additionally", subtitle: "Fill the gaps & add more events." },
  { id: 3, title: "Reps", subtitle: "Who's going." },
  { id: 4, title: "Review & Approve", subtitle: "Lock the plan." },
];

function PlanBuilderPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchPlan = useServerFn(getActivePlan);
  const fetchAll = useServerFn(listAllConferencesWithCost);
  const callSetStatus = useServerFn(setPlanItemStatusFn);
  const callToggleRep = useServerFn(toggleRepFn);
  const callSetPlanStatus = useServerFn(setPlanStatusFn);

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

  const repMutation = useMutation({
    mutationFn: (v: { id: string; rep: string }) => callToggleRep({ data: v }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update reps"),
  });

  const approveMutation = useMutation({
    mutationFn: () => callSetPlanStatus({ data: { planId: planQuery.data!.plan.id, status: "approved" } }),
    onSuccess: () => {
      invalidate();
      toast.success("Plan approved");
      navigate({ to: "/planning" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to approve"),
  });

  const [step, setStep] = useState<StepId>(1);

  const loading = planQuery.isLoading || allQuery.isLoading;
  const plan = planQuery.data?.plan;
  const items = planQuery.data?.items ?? [];
  const allConferences = allQuery.data ?? [];

  const onApprove = () => approveMutation.mutate();

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        rightSlot={
          <Button asChild variant="outline" size="sm">
            <Link to="/planning">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Exit wizard
            </Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-7xl space-y-5 px-6 py-6">
        {loading || !plan ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {loading ? "Loading…" : "No active plan found."}
          </div>
        ) : (
          <>
            <header className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Planning wizard · {plan.name}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    plan.status === "approved"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                  )}
                >
                  {plan.status === "approved" ? "Approved" : "Draft"}
                </span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Build your {plan.year} plan
              </h1>
              {plan.status === "approved" && (
                <p className="text-xs text-muted-foreground">
                  Editing an approved plan — re-approve at the end to publish your changes.
                </p>
              )}
            </header>

            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" size="xs" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as StepId) : s))} disabled={step === 1}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <div className="flex-1 flex justify-center">
                <Stepper current={step} onJump={setStep} />
              </div>
              {step < 4 ? (
                <Button size="xs" onClick={() => setStep((s) => (s < 4 ? ((s + 1) as StepId) : s))}>
                  Next <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              ) : (
                <Button size="xs" onClick={onApprove}>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                </Button>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              {step === 1 && (
                <Step1Anchors
                  items={items}
                  allConferences={allConferences}
                  onSet={(conferenceId, planStatus) => statusMutation.mutate({ conferenceId, planStatus })}
                />
              )}
              {step === 2 && (
                <Step2Coverage
                  items={items}
                  allConferences={allConferences}
                  planYear={plan.year}
                  onAdd={(conferenceId) => statusMutation.mutate({ conferenceId, planStatus: "approved" })}
                  onRemove={(conferenceId: string) => statusMutation.mutate({ conferenceId, planStatus: "dropped" })}
                />
              )}
              {step === 3 && (
                <Step3Reps
                  items={items}
                  onToggleRep={(id, rep) => repMutation.mutate({ id, rep })}
                />
              )}
              {step === 4 && (
                <Step4Review items={items} onApprove={onApprove} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ---------- Stepper ---------- */

function Stepper({ current, onJump }: { current: StepId; onJump: (s: StepId) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => {
        const isCurrent = s.id === current;
        const isDone = s.id < current;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJump(s.id)}
              className={cn(
                "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground"
                  : isDone
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  isCurrent
                    ? "bg-primary-foreground/20"
                    : isDone
                    ? "bg-emerald-200 text-emerald-900"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : s.id}
              </span>
              <span>{s.title}</span>
            </button>
            {i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function WizardFooter({
  step,
  onBack,
  onNext,
  onApprove,
}: {
  step: StepId;
  onBack: () => void;
  onNext: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm" onClick={onBack} disabled={step === 1}>
        <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
      </Button>
      {step < 4 ? (
        <Button size="sm" onClick={onNext}>
          Next <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button size="sm" onClick={onApprove}>
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve plan
        </Button>
      )}
    </div>
  );
}

/* ---------- Step 1 · Anchors ---------- */

type ViewMode = "list" | "timeline" | "map";

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { id: ViewMode; label: string; Icon: typeof ListIcon }[] = [
    { id: "list", label: "List", Icon: ListIcon },
    { id: "timeline", label: "Timeline", Icon: CalendarRange },
    { id: "map", label: "Map", Icon: MapIcon },
  ];
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5">
      {opts.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition",
            value === id
              ? "bg-brand-base text-brand-base-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

function Step1Anchors({
  items,
  allConferences,
  onSet,
}: {
  items: PlanItemWithConference[];
  allConferences: Conference[];
  onSet: (conferenceId: string, planStatus: PlanItemStatus) => void;
}) {
  const itemByConfId = useMemo(() => {
    const m = new Map<string, PlanItemWithConference>();
    for (const it of items) m.set(it.conferenceId, it);
    return m;
  }, [items]);

  // Anchor candidates: Tier 1 OR high past-performance (>= 70).
  const anchors = useMemo(() => {
    return [...allConferences]
      .filter((c) => c.tier === "Tier 1" || (c.subScores?.pastPerformance ?? 0) >= 70)
      .sort((a, b) => {
        const pa = a.subScores?.pastPerformance ?? 0;
        const pb = b.subScores?.pastPerformance ?? 0;
        if (pb !== pa) return pb - pa;
        return b.icpScore - a.icpScore;
      });
  }, [allConferences]);

  const mustGoCount = items.filter((i) => i.planStatus === "must_go").length;
  const mustGoIds = useMemo(
    () => new Set(items.filter((i) => i.planStatus === "must_go").map((i) => i.conferenceId)),
    [items],
  );

  const [view, setView] = useState<ViewMode>("list");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StepHeader
          title="Step 1 · Anchors"
          subtitle="The events you attend every year."
          kicker={`${mustGoCount} marked must-go`}
        />
        <ViewToggle value={view} onChange={setView} />
      </div>
      <p className="text-sm text-muted-foreground">
        These are your Tier 1 and best-performing past events. One tap locks them as must-go.
      </p>

      {view === "timeline" ? (
        <TimelineView conferences={anchors} committedIds={mustGoIds} />
      ) : view === "map" ? (
        <MapView conferences={anchors} committedIds={mustGoIds} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {anchors.map((c) => {
            const item = itemByConfId.get(c.id);
            const isMustGo = item?.planStatus === "must_go";
            return (
              <li
                key={c.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-md border p-3 transition",
                  isMustGo ? "border-brand-accent bg-brand-accent/10" : "border-border bg-background hover:bg-muted/40",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TierBadge tier={c.tier} />
                    <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {c.city}, {c.country} · {c.vertical} · ICP {c.icpScore}
                    {(c.subScores?.pastPerformance ?? 0) >= 70 && (
                      <> · <span className="text-amber-700">★ past {c.subScores.pastPerformance}</span></>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isMustGo ? "secondary" : "default"}
                  onClick={() => onSet(c.id, isMustGo ? "considering" : "must_go")}
                  className="shrink-0"
                >
                  {isMustGo ? (
                    <><Check className="mr-1 h-3.5 w-3.5" /> Must-go</>
                  ) : (
                    <><Star className="mr-1 h-3.5 w-3.5" /> Mark must-go</>
                  )}
                </Button>
              </li>
            );
          })}
          {anchors.length === 0 && (
            <li className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:col-span-2">
              No anchor candidates found.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}


/* ---------- Step 2 · Coverage ---------- */

function Step2Coverage({
  items,
  allConferences,
  planYear,
  onAdd,
  onRemove,
}: {
  items: PlanItemWithConference[];
  allConferences: (Conference & { estimatedCostUsd: number | null })[];
  planYear: number;
  onAdd: (conferenceId: string) => void;
  onRemove: (conferenceId: string) => void;
}) {
  const recs = useMemo(
    () =>
      buildRecommendations({
        allConferences,
        items,
        // plan budget no longer used; pass a stub
        plan: { id: "", name: "", year: planYear, annualBudgetUsd: 0, plannedRepsPerConference: 1, isActive: true, status: "draft", createdAt: "", updatedAt: "", archivedAt: null },
        planYear,
      }).filter((r) => r.kind === "region_gap" || r.kind === "vertical_gap"),
    [allConferences, items, planYear],
  );

  const confById = useMemo(() => {
    const m = new Map<string, Conference>();
    for (const c of allConferences) m.set(c.id, c);
    return m;
  }, [allConferences]);

  // Rank candidates inside each rec by icpScore.
  const rankedRecs = useMemo(
    () =>
      recs.map((r) => ({
        ...r,
        conferenceIds: [...r.conferenceIds].sort((a, b) => {
          const ca = confById.get(a)?.icpScore ?? 0;
          const cb = confById.get(b)?.icpScore ?? 0;
          return cb - ca;
        }),
      })),
    [recs, confById],
  );

  const inPlanIds = new Set(items.map((i) => i.conferenceId));
  const conflicts = useMemo(() => findCalendarConflicts(items), [items]);

  const committed = items.filter((i) => isCommitted(i.planStatus));
  const regions = regionCoverage(committed, REGIONS);
  const icpVerticalCoverage = verticalCoverage(committed, ICP_VERTICALS);

  // In-plan conferences (committed) — editable list, can remove
  const inPlanConferences = useMemo(() => {
    return items
      .filter((i) => isCommitted(i.planStatus))
      .map((i) => ({ item: i, conf: confById.get(i.conferenceId) }))
      .filter((x): x is { item: PlanItemWithConference; conf: Conference } => !!x.conf);
  }, [items, confById]);

  // Browse-all: anything not yet in plan
  const [browseQuery, setBrowseQuery] = useState("");
  const browseable = useMemo(() => {
    const q = browseQuery.trim().toLowerCase();
    return allConferences
      .filter((c) => !inPlanIds.has(c.id))
      .filter((c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.vertical.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q),
      )
      .sort((a, b) => b.icpScore - a.icpScore)
      .slice(0, 12);
  }, [allConferences, inPlanIds, browseQuery]);

  const [view, setView] = useState<ViewMode>("list");
  const [browseLayout, setBrowseLayout] = useState<"cards" | "table">("table");

  const committedIds = useMemo(
    () => new Set(committed.map((i) => i.conferenceId)),
    [committed],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StepHeader
          title="Step 2 · Additionally"
          subtitle="Fill region & ICP-vertical gaps — and add anything else worth attending."
          kicker={`${recs.length} gap${recs.length === 1 ? "" : "s"} to address`}
        />
        <ViewToggle value={view} onChange={setView} />
      </div>

      {/* Compact coverage chips — verticals + regions in one strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
        <CoverageChipRow label="ICP" buckets={icpVerticalCoverage} />
        <span className="hidden h-4 w-px bg-border sm:inline" />
        <CoverageChipRow label="Region" buckets={regions} />
      </div>

      {/* Calendar conflicts — always visible */}
      {conflicts.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" /> Calendar conflicts · {conflicts.length}
          </div>
          <ul className="space-y-1 text-xs text-amber-900">
            {conflicts.map((c) => (
              <li key={`${c.aId}-${c.bId}`}>
                <span className="font-medium">{c.aName}</span> overlaps with{" "}
                <span className="font-medium">{c.bName}</span>{" "}
                <span className="opacity-80">({c.overlapStart} → {c.overlapEnd})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "timeline" ? (
        <TimelineView conferences={allConferences} committedIds={committedIds} />
      ) : view === "map" ? (
        <MapView conferences={allConferences} committedIds={committedIds} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* LEFT: Selected + Browse */}
          <div className="space-y-5 lg:col-span-2">
            {/* Currently in plan */}
            <div className="rounded-md border border-border bg-background p-3">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                In plan · {inPlanConferences.length}
              </h3>
              {inPlanConferences.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nothing in the plan yet.
                </p>
              ) : (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {inPlanConferences.map(({ item, conf }) => (
                    <li
                      key={conf.id}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <TierBadge tier={conf.tier} />
                          <span className="truncate text-xs font-medium text-foreground">{conf.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {conf.city} · {conf.vertical} · {item.planStatus === "must_go" ? "must-go" : "approved"}
                        </div>
                      </div>
                      {item.planStatus !== "must_go" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemove(conf.id)}
                          className="h-7 px-2 text-muted-foreground hover:text-red-700"
                          title="Remove from plan"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Browse all */}
            <div className="rounded-md border border-border bg-background p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Add any conference</h3>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5">
                    {(["table", "cards"] as const).map((l) => {
                      const Icon = l === "table" ? ListIcon : LayoutGrid;
                      return (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setBrowseLayout(l)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition",
                            browseLayout === l
                              ? "bg-brand-base text-brand-base-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {l === "table" ? "Table" : "Cards"}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="search"
                    value={browseQuery}
                    onChange={(e) => setBrowseQuery(e.target.value)}
                    placeholder="Search name, city, vertical…"
                    className="h-8 w-56 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              {browseable.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No matching conferences.
                </p>
              ) : browseLayout === "table" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5 font-semibold">Conference</th>
                        <th className="px-2 py-1.5 font-semibold">Tier</th>
                        <th className="px-2 py-1.5 font-semibold">Vertical</th>
                        <th className="px-2 py-1.5 font-semibold">Region</th>
                        <th className="px-2 py-1.5 text-right font-semibold">ICP</th>
                        <th className="px-2 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {browseable.map((c) => (
                        <tr key={c.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/40">
                          <td className="px-2 py-1.5">
                            <div className="font-medium text-foreground">{c.name}</div>
                            <div className="text-[10px] text-muted-foreground">{c.city}, {c.country}</div>
                          </td>
                          <td className="px-2 py-1.5"><TierBadge tier={c.tier} /></td>
                          <td className="px-2 py-1.5 text-muted-foreground">{c.vertical}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{c.region}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{c.icpScore}</td>
                          <td className="px-2 py-1.5 text-right">
                            <Button size="sm" onClick={() => onAdd(c.id)} className="h-7">Add</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {browseable.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <TierBadge tier={c.tier} />
                          <span className="truncate text-xs font-medium text-foreground">{c.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.city} · {c.vertical} · ICP {c.icpScore}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => onAdd(c.id)} className="h-7">Add</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* RIGHT: Recommendations */}
          <aside className="lg:col-span-1">
            <div className="sticky top-4 rounded-md border border-brand-accent/40 bg-brand-accent/5 p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-brand-accent" /> Recommendations
              </h3>
              {rankedRecs.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
                  Nice — no obvious region or vertical gaps.
                </p>
              ) : (
                <div className="space-y-3">
                  {rankedRecs.map((r) => (
                    <div key={r.id} className="rounded-md border border-border bg-background p-2.5">
                      <div className="text-xs font-semibold text-foreground">{r.title}</div>
                      <div className="text-[10px] text-muted-foreground">{r.detail}</div>
                      <ul className="mt-2 space-y-1">
                        {r.conferenceIds.slice(0, 4).map((id) => {
                          const c = confById.get(id);
                          if (!c) return null;
                          const already = inPlanIds.has(id);
                          return (
                            <li
                              key={id}
                              className="flex items-center justify-between gap-2 rounded border border-border/70 bg-card px-2 py-1.5"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-foreground">{c.name}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {c.city} · ICP {c.icpScore}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={already ? "secondary" : "default"}
                                onClick={() => onAdd(id)}
                                disabled={already}
                                className="h-7"
                              >
                                {already ? <Check className="h-3.5 w-3.5" /> : "Add"}
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function CoverageChipRow({
  label,
  buckets,
}: {
  label: string;
  buckets: { key: string; committed: number; total: number }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {buckets.map((b) => {
        const gap = b.committed === 0;
        return (
          <span
            key={b.key}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tabular-nums",
              gap
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800",
            )}
            title={`${b.committed} committed`}
          >
            <span className="font-medium">{b.key}</span>
            <span className="opacity-70">·</span>
            <span>{b.committed}</span>
          </span>
        );
      })}
    </div>
  );
}



/* ---------- Step 3 · Reps ---------- */

function Step3Reps({
  items,
  onToggleRep,
}: {
  items: PlanItemWithConference[];
  onToggleRep: (conferenceId: string, rep: string) => void;
}) {
  const committed = useMemo(
    () =>
      items
        .filter((i) => isCommitted(i.planStatus))
        .sort((a, b) => new Date(a.conference.startDate).getTime() - new Date(b.conference.startDate).getTime()),
    [items],
  );

  const noReps = committed.filter((i) => (i.conference.assignedReps?.length ?? 0) === 0).length;

  return (
    <div className="space-y-4">
      <StepHeader
        title="Step 3 · Reps"
        subtitle="Who's going."
        kicker={
          noReps > 0
            ? `${noReps} conference${noReps === 1 ? "" : "s"} need reps`
            : "All committed conferences have reps"
        }
      />

      {committed.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No committed conferences yet — go back to step 1 or 2.
        </p>
      ) : (
        <ul className="space-y-3">
          {committed.map((item) => {
            const c = item.conference;
            const reps = c.assignedReps ?? [];
            const empty = reps.length === 0;
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-md border p-3",
                  empty ? "border-red-300 bg-red-50/60" : "border-border bg-background",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <TierBadge tier={c.tier} />
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      {empty && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
                          <AlertTriangle className="h-3 w-3" /> No rep
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {c.city}, {c.country} · {new Date(c.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    <Users className="mr-1 inline h-3.5 w-3.5" />
                    {reps.length} / target
                  </div>
                </div>
                <div className="mt-3">
                  <RepAssigner
                    assigned={reps}
                    allReps={SALES_TEAM}
                    onToggle={(rep) => onToggleRep(c.id, rep)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- Step 4 · Review & Approve ---------- */

function Step4Review({
  items,
  onApprove,
}: {
  items: PlanItemWithConference[];
  onApprove: () => void;
}) {
  const mustGo = items.filter((i) => i.planStatus === "must_go");
  const approved = items.filter((i) => i.planStatus === "approved");
  const committed = [...mustGo, ...approved];

  const verticals = new Set(committed.map((i) => i.conference.vertical));
  const regions = new Set(committed.map((i) => i.conference.region));
  const verticalGaps = ICP_VERTICALS.filter((v) => !verticals.has(v));
  const regionGaps = REGIONS.filter((r) => !regions.has(r));
  const repsMissing = committed.filter((i) => (i.conference.assignedReps?.length ?? 0) === 0);

  return (
    <div className="space-y-5">
      <StepHeader title="Step 4 · Review & Approve" subtitle="Lock the plan." />

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Must-go" value={mustGo.length} />
        <Metric label="Approved" value={approved.length} />
        <Metric label="ICP verticals covered" value={`${ICP_VERTICALS.length - verticalGaps.length}/${ICP_VERTICALS.length}`} />
        <Metric label="Regions covered" value={`${REGIONS.length - regionGaps.length}/${REGIONS.length}`} />
      </div>

      <ReviewSection title="Open gaps & issues">
        {verticalGaps.length === 0 && regionGaps.length === 0 && repsMissing.length === 0 ? (
          <p className="text-xs text-emerald-700">All set — no coverage gaps and every conference has a rep.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {regionGaps.map((r) => (
              <li key={`r-${r}`} className="text-red-700">
                <span className="font-medium">• Region: {r}</span>
                <span className="text-red-700/80"> — no conference in this region. Buyers in {r} won't be reached this year; add at least one event or accept the gap.</span>
              </li>
            ))}
            {verticalGaps.map((v) => (
              <li key={`v-${v}`} className="text-red-700">
                <span className="font-medium">• Vertical: {v}</span>
                <span className="text-red-700/80"> — no event covering {v}. Pipeline in this ICP vertical will have no field touchpoint; consider adding a {v}-focused conference.</span>
              </li>
            ))}
            {repsMissing.length > 0 && (
              <li className="text-amber-800">
                <span className="font-medium">
                  ⚠ Reps: {repsMissing.length} conference{repsMissing.length === 1 ? "" : "s"} without an assigned rep
                </span>
                <span className="text-amber-800/80">
                  {" "}— {repsMissing.map((i) => i.conference.name).join(", ")}. You can approve now and assign reps later in step 3.
                </span>
              </li>
            )}
          </ul>
        )}
      </ReviewSection>

      <ReviewSection title={`Committed conferences · ${committed.length}`}>
        {committed.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {committed
              .sort((a, b) => new Date(a.conference.startDate).getTime() - new Date(b.conference.startDate).getTime())
              .map((i) => {
                const c = i.conference;
                const noRep = (c.assignedReps?.length ?? 0) === 0;
                return (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="text-muted-foreground"> · {c.city} · {c.vertical}</span>
                    </div>
                    {noRep ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
                        <X className="h-3 w-3" /> No rep
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{c.assignedReps.join(", ")}</span>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </ReviewSection>


      <div className="flex justify-end">
        <Button onClick={onApprove}>
          <CheckCircle2 className="mr-1 h-4 w-4" /> Approve plan
        </Button>
      </div>
    </div>
  );
}

/* ---------- Shared ---------- */

function StepHeader({ title, subtitle, kicker }: { title: string; subtitle: string; kicker?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {kicker && (
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{kicker}</span>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
