import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Conference, Tier } from "@/lib/conferences";
import { ConferenceDetail } from "./ConferenceDetail";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const TIER_CHIP: Record<Tier, string> = {
  "Tier 1": "bg-emerald-100 text-emerald-900 ring-emerald-200 hover:bg-emerald-200",
  "Tier 2": "bg-amber-100 text-amber-900 ring-amber-200 hover:bg-amber-200",
  "Tier 3": "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200",
};

const YEAR = 2026;

interface Props {
  conferences: Conference[];
}

interface ChipData {
  conference: Conference;
  clusterId: number | null;
}

const dayMs = 24 * 60 * 60 * 1000;

export function TimelineView({ conferences }: Props) {
  // Filter to YEAR and group by month index of startDate.
  const byMonth = useMemo(() => {
    const groups: ChipData[][] = Array.from({ length: 12 }, () => []);
    const inYear = conferences
      .filter((c) => new Date(c.startDate).getFullYear() === YEAR)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    // Find clusters: any conference within 14 days of another (by start date).
    let nextCluster = 0;
    const clusterOf = new Map<string, number>();
    for (let i = 0; i < inYear.length; i++) {
      for (let j = i + 1; j < inYear.length; j++) {
        const ti = new Date(inYear[i].startDate).getTime();
        const tj = new Date(inYear[j].startDate).getTime();
        if (Math.abs(tj - ti) <= 14 * dayMs) {
          const ci = clusterOf.get(inYear[i].id);
          const cj = clusterOf.get(inYear[j].id);
          let cid: number;
          if (ci != null && cj != null) {
            cid = Math.min(ci, cj);
            // unify
            clusterOf.forEach((v, k) => {
              if (v === Math.max(ci, cj)) clusterOf.set(k, cid);
            });
          } else if (ci != null) cid = ci;
          else if (cj != null) cid = cj;
          else {
            cid = nextCluster++;
          }
          clusterOf.set(inYear[i].id, cid);
          clusterOf.set(inYear[j].id, cid);
        }
      }
    }

    inYear.forEach((c) => {
      const month = new Date(c.startDate).getMonth();
      groups[month].push({
        conference: c,
        clusterId: clusterOf.get(c.id) ?? null,
      });
    });
    return groups;
  }, [conferences]);

  const totalInYear = byMonth.reduce((s, g) => s + g.length, 0);
  const otherCount = conferences.length - totalInYear;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{YEAR} timeline</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <LegendDot className="bg-emerald-400" label="Tier 1" />
            <LegendDot className="bg-amber-400" label="Tier 2" />
            <LegendDot className="bg-slate-400" label="Tier 3" />
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-fuchsia-500/70" />
              Cluster (≤2 weeks apart)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 items-start gap-2">
          {MONTHS.map((m, idx) => {
            const items = byMonth[idx];
            const isEmpty = items.length === 0;
            return (
              <div
                key={m}
                className={cn(
                  "flex min-h-[260px] flex-col rounded-md border bg-background p-2",
                  isEmpty ? "border-dashed border-border/60" : "border-border",
                )}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{m}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{items.length || ""}</span>
                </div>
                {isEmpty ? (
                  <div className="flex flex-1 items-center justify-center text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    No events
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map(({ conference, clusterId }) => (
                      <li key={conference.id}>
                        <TimelineChip conference={conference} clusterId={clusterId} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
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

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}

function TimelineChip({ conference, clusterId }: { conference: Conference; clusterId: number | null }) {
  const [open, setOpen] = useState(false);
  const c = conference;
  const start = new Date(c.startDate);
  const end = new Date(c.endDate);
  const range =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()}`
      : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
  const isGap = c.tier === "Tier 1" && c.assignedReps.length === 0;

  return (
  const fullRange =
    start.getMonth() === end.getMonth() && start.getDate() === end.getDate()
      ? `${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`
      : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "group relative block w-full rounded-md px-2 py-1.5 text-left text-[11px] ring-1 ring-inset transition",
                TIER_CHIP[c.tier],
              )}
            >
              {clusterId !== null && (
                <span
                  className="absolute left-0 top-0 h-full w-1 rounded-l-md bg-fuchsia-500/80"
                  aria-hidden="true"
                />
              )}
              <div className="flex items-start justify-between gap-1 pl-1">
                <span className="line-clamp-2 break-words font-medium leading-tight">{c.name}</span>
                {isGap && (
                  <span className="shrink-0 rounded-full bg-red-600 px-1 text-[9px] font-bold uppercase text-white">
                    Gap
                  </span>
                )}
              </div>
              <div className="pl-1 text-[10px] opacity-80 tabular-nums">{range}</div>
            </button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="font-medium">{c.name}</div>
          <div className="text-xs opacity-80">{fullRange}</div>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-auto p-3">
        <ConferenceDetail conference={c} />
      </PopoverContent>
    </Popover>
  );
}
