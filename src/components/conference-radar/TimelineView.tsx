import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Conference, DecisionStatus, Region, Tier, Vertical } from "@/lib/conferences";
import { isCoverageGap } from "@/lib/conferences";
import { ConferenceDetail } from "./ConferenceDetail";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const YEAR = 2026;
const dayMs = 24 * 60 * 60 * 1000;

// Tier → color family for bar fills.
const TIER_FILL: Record<Tier, { solid: string; soft: string; outline: string; text: string; ring: string }> = {
  "Tier 1": {
    solid: "bg-emerald-500 text-white",
    soft: "bg-emerald-100 text-emerald-900",
    outline: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300 ring-inset",
    text: "text-emerald-900",
    ring: "ring-emerald-400",
  },
  "Tier 2": {
    solid: "bg-amber-500 text-white",
    soft: "bg-amber-100 text-amber-900",
    outline: "bg-amber-50 text-amber-900 ring-1 ring-amber-300 ring-inset",
    text: "text-amber-900",
    ring: "ring-amber-400",
  },
  "Tier 3": {
    solid: "bg-slate-500 text-white",
    soft: "bg-slate-200 text-slate-800",
    outline: "bg-slate-50 text-slate-700 ring-1 ring-slate-300 ring-inset",
    text: "text-slate-700",
    ring: "ring-slate-400",
  },
};

type GroupBy = "rep" | "vertical" | "region" | "tier" | "none";

interface Props {
  conferences: Conference[];
  onSetStatus?: (id: string, status: DecisionStatus) => void;
  onOpenInTable?: (id: string) => void;
}

interface PlacedBar {
  conference: Conference;
  startPct: number;
  widthPct: number;
  subRow: number;
  inCluster: boolean;
}

interface Lane {
  key: string;
  label: string;
  bars: PlacedBar[];
  height: number;
}

const ROW_H = 30; // px per sub-row
const ROW_GAP = 4;
const LANE_PAD_Y = 8;

const YEAR_START = new Date(YEAR, 0, 1).getTime();
const YEAR_END = new Date(YEAR + 1, 0, 1).getTime();
const YEAR_SPAN = YEAR_END - YEAR_START;

function pctOf(ts: number) {
  return ((ts - YEAR_START) / YEAR_SPAN) * 100;
}

export function TimelineView({ conferences, onSetStatus, onOpenInTable }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const inYear = useMemo(
    () =>
      conferences
        .filter((c) => new Date(c.startDate).getFullYear() === YEAR)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [conferences],
  );

  // Cluster detection (same rule as before): within 14 days of another start.
  const clusterIds = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < inYear.length; i++) {
      for (let j = i + 1; j < inYear.length; j++) {
        const ti = new Date(inYear[i].startDate).getTime();
        const tj = new Date(inYear[j].startDate).getTime();
        if (Math.abs(tj - ti) <= 14 * dayMs) {
          set.add(inYear[i].id);
          set.add(inYear[j].id);
        }
      }
    }
    return set;
  }, [inYear]);

  const lanes = useMemo<Lane[]>(() => {
    // Build groups → array of conferences
    const groups = new Map<string, { label: string; items: Conference[] }>();
    const push = (key: string, label: string, c: Conference) => {
      const g = groups.get(key);
      if (g) g.items.push(c);
      else groups.set(key, { label, items: [c] });
    };

    for (const c of inYear) {
      if (groupBy === "none") {
        push("all", "All conferences", c);
      } else if (groupBy === "rep") {
        if (c.assignedReps.length === 0) push("__unassigned", "Unassigned", c);
        else for (const r of c.assignedReps) push(`rep:${r}`, r, c);
      } else if (groupBy === "vertical") {
        push(`v:${c.vertical}`, c.vertical as Vertical, c);
      } else if (groupBy === "region") {
        push(`r:${c.region}`, c.region as Region, c);
      } else if (groupBy === "tier") {
        push(`t:${c.tier}`, c.tier as Tier, c);
      }
    }

    // Order lanes: Unassigned last, otherwise alpha.
    const entries = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "__unassigned") return 1;
      if (b[0] === "__unassigned") return -1;
      return a[1].label.localeCompare(b[1].label);
    });

    // Greedy packing per lane: assign each bar the lowest sub-row where it doesn't overlap.
    const result: Lane[] = entries.map(([key, { label, items }]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
      // subRowEnds[i] = end timestamp of last bar placed in sub-row i
      const subRowEnds: number[] = [];
      const placed: PlacedBar[] = sorted.map((c) => {
        const startTs = Math.max(YEAR_START, new Date(c.startDate).getTime());
        // Add 1 day so single-day events still occupy width.
        const endTs = Math.min(YEAR_END, new Date(c.endDate).getTime() + dayMs);
        let sub = 0;
        while (sub < subRowEnds.length && subRowEnds[sub] > startTs) sub++;
        subRowEnds[sub] = endTs;
        return {
          conference: c,
          startPct: pctOf(startTs),
          widthPct: Math.max(0.6, pctOf(endTs) - pctOf(startTs)),
          subRow: sub,
          inCluster: clusterIds.has(c.id),
        };
      });
      const depth = Math.max(1, subRowEnds.length);
      return {
        key,
        label,
        bars: placed,
        height: LANE_PAD_Y * 2 + depth * ROW_H + (depth - 1) * ROW_GAP,
      };
    });

    return result;
  }, [inYear, groupBy, clusterIds]);

  const otherCount = conferences.length - inYear.length;

  // Today marker
  const now = Date.now();
  const showToday = now >= YEAR_START && now < YEAR_END;
  const todayPct = showToday ? pctOf(now) : 0;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">{YEAR} timeline</h2>
              <span className="text-xs text-muted-foreground">
                {inYear.length} conference{inYear.length === 1 ? "" : "s"} · {lanes.length} {groupBy === "none" ? "lane" : "lanes"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <GroupBySelect value={groupBy} onChange={setGroupBy} />
              <div className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
                <LegendSwatch className="bg-emerald-500" label="Tier 1" />
                <LegendSwatch className="bg-amber-500" label="Tier 2" />
                <LegendSwatch className="bg-slate-500" label="Tier 3" />
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-fuchsia-500" />
                  Cluster
                </span>
              </div>
            </div>
          </div>

          {/* Scroll container */}
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              {/* Month axis header */}
              <div className="sticky top-0 z-10 flex border-b border-border bg-card/95 backdrop-blur">
                {groupBy !== "none" && (
                  <div className="w-[180px] shrink-0 border-r border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {groupBy === "rep" ? "Rep" : groupBy === "vertical" ? "Vertical" : groupBy === "region" ? "Region" : "Tier"}
                  </div>
                )}
                <div className="relative flex-1">
                  <div className="grid grid-cols-12">
                    {MONTHS.map((m, i) => (
                      <div
                        key={m}
                        className={cn(
                          "px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                          i > 0 && "border-l border-border",
                        )}
                      >
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lanes */}
              {lanes.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                  No conferences in {YEAR}.
                </div>
              ) : (
                <div>
                  {lanes.map((lane, laneIdx) => (
                    <div
                      key={lane.key}
                      className={cn(
                        "flex border-b border-border last:border-b-0",
                        laneIdx % 2 === 1 && "bg-muted/20",
                      )}
                    >
                      {/* Sticky left gutter */}
                      {groupBy !== "none" && (
                        <div
                          className="flex w-[180px] shrink-0 items-center border-r border-border px-3 text-xs font-medium text-foreground"
                          style={{ minHeight: lane.height }}
                        >
                          <span className="truncate" title={lane.label}>
                            {lane.label}
                            <span className="ml-1.5 text-[10px] font-normal tabular-nums text-muted-foreground">
                              {lane.bars.length}
                            </span>
                          </span>
                        </div>
                      )}


                      {/* Track */}
                      <div className="relative flex-1" style={{ height: lane.height }}>
                        {/* Month gridlines */}
                        <div className="pointer-events-none absolute inset-0 grid grid-cols-12">
                          {MONTHS.map((m, i) => (
                            <div
                              key={m}
                              className={cn(i > 0 && "border-l border-border/60")}
                            />
                          ))}
                        </div>

                        {/* Today line */}
                        {showToday && (
                          <div
                            className="pointer-events-none absolute top-0 bottom-0 z-[1] w-px bg-primary/70"
                            style={{ left: `${todayPct}%` }}
                          >
                            <span className="absolute -top-0.5 -translate-x-1/2 rounded-sm bg-primary px-1 text-[9px] font-bold uppercase leading-3 text-primary-foreground">
                              Today
                            </span>
                          </div>
                        )}

                        {/* Bars */}
                        {lane.bars.map((bar) => (
                          <BarChip
                            key={`${lane.key}:${bar.conference.id}`}
                            bar={bar}
                            top={LANE_PAD_Y + bar.subRow * (ROW_H + ROW_GAP)}
                            onSetStatus={onSetStatus}
                            onOpenInTable={onOpenInTable}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {otherCount > 0 && (
          <div className="text-xs text-muted-foreground">
            {otherCount} conference{otherCount === 1 ? "" : "s"} outside {YEAR} hidden from this view (adjust date filters to inspect).
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function GroupBySelect({ value, onChange }: { value: GroupBy; onChange: (v: GroupBy) => void }) {
  const opts: { id: GroupBy; label: string }[] = [
    { id: "rep", label: "Rep" },
    { id: "vertical", label: "Vertical" },
    { id: "region", label: "Region" },
    { id: "tier", label: "Tier" },
    { id: "none", label: "None" },
  ];
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Group by</span>
      <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium transition",
              value === o.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block h-2.5 w-4 rounded-sm", className)} />
      {label}
    </span>
  );
}

function BarChip({
  bar,
  top,
  onSetStatus,
}: {
  bar: PlacedBar;
  top: number;
  onSetStatus?: (id: string, status: DecisionStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const c = bar.conference;
  const palette = TIER_FILL[c.tier];
  const gap = isCoverageGap(c);

  const start = new Date(c.startDate);
  const end = new Date(c.endDate);
  const range =
    start.getMonth() === end.getMonth() && start.getDate() === end.getDate()
      ? `${start.getDate()} ${MONTHS[start.getMonth()]}`
      : start.getMonth() === end.getMonth()
        ? `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()]}`
        : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;

  // Fill style by status.
  const fillClass =
    c.status === "Going"
      ? palette.solid
      : c.status === "Considering"
        ? palette.soft
        : c.status === "Passed"
          ? cn(palette.soft, "opacity-50")
          : palette.outline;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "group absolute flex items-center gap-1 overflow-hidden rounded-md px-2 text-[11px] font-medium shadow-sm transition hover:z-20 hover:shadow-md focus:outline-none focus:ring-2",
                fillClass,
                palette.ring,
              )}
              style={{
                top,
                left: `${bar.startPct}%`,
                width: `calc(${bar.widthPct}% - 2px)`,
                height: ROW_H,
              }}
            >
              {bar.inCluster && (
                <span
                  className="absolute left-0 top-0 h-full w-1 bg-fuchsia-500"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "truncate pl-1",
                  c.status === "Passed" && "line-through",
                )}
              >
                {c.name}
              </span>
              <span className="ml-auto hidden shrink-0 pl-1 text-[10px] opacity-80 tabular-nums sm:inline">
                {range}
              </span>
              {gap && (
                <span className="ml-1 shrink-0 rounded-full bg-red-600 px-1 text-[9px] font-bold uppercase text-white">
                  Gap
                </span>
              )}
            </button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="font-medium">{c.name}</div>
          <div className="text-xs opacity-80">{range} · {c.tier}</div>
          <div className="text-xs opacity-80">Status: {c.status}</div>
          {c.assignedReps.length > 0 && (
            <div className="text-xs opacity-80">Reps: {c.assignedReps.join(", ")}</div>
          )}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-auto p-3">
        <ConferenceDetail conference={c} onSetStatus={onSetStatus} />
      </PopoverContent>
    </Popover>
  );
}
