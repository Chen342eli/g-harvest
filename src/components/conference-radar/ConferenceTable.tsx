import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import type { Conference, DecisionStatus } from "@/lib/conferences";
import { SALES_TEAM, isCoverageGap } from "@/lib/conferences";
import { TierBadge, CoverageGapBadge } from "./TierBadge";
import { ScoreCell } from "./ScoreCell";
import { RepAssigner } from "./RepAssigner";
import { StatusChip } from "./StatusChip";
import { cn } from "@/lib/utils";

type SortKey = "name" | "startDate" | "city" | "vertical" | "estimatedAudienceSize" | "icpScore" | "status";
type SortDir = "asc" | "desc";

interface Props {
  conferences: Conference[];
  onToggleRep: (conferenceId: string, rep: string) => void;
  onSetStatus: (conferenceId: string, status: DecisionStatus) => void;
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric" });
  if (sameMonth) {
    return `${monthFmt.format(s)}–${e.getDate()}, ${yearFmt.format(s)}`;
  }
  return `${monthFmt.format(s)} – ${monthFmt.format(e)}, ${yearFmt.format(e)}`;
}

const audienceFmt = new Intl.NumberFormat("en-US");

export function ConferenceTable({ conferences, onToggleRep }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("icpScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...conferences];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [conferences, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir(k === "icpScore" || k === "estimatedAudienceSize" ? "desc" : "asc");
    }
  };

  const Th = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th className={cn("px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground", className)}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {sortKey === k ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th k="name" label="Conference" />
              <Th k="startDate" label="Dates" />
              <Th k="city" label="Location" />
              <Th k="vertical" label="Vertical" />
              <Th k="estimatedAudienceSize" label="Audience" className="text-right" />
              <Th k="icpScore" label="Score" />
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tier</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned reps</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const isGap = c.tier === "Tier 1" && c.assignedReps.length === 0;
              return (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 align-top">
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary hover:underline"
                      title="Visit site"
                    >
                      {c.name}
                      <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                    </a>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                    {formatDateRange(c.startDate, c.endDate)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-foreground">{c.city}</div>
                    <div className="text-xs text-muted-foreground">{c.country} · {c.region}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-foreground">{c.vertical}</td>
                  <td className="px-4 py-3 align-top text-right tabular-nums text-foreground">
                    {audienceFmt.format(c.estimatedAudienceSize)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ScoreCell score={c.icpScore} subScores={c.subScores} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col items-start gap-1">
                      <TierBadge tier={c.tier} />
                      {isGap && <CoverageGapBadge />}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top min-w-[260px]">
                    <RepAssigner
                      assigned={c.assignedReps}
                      allReps={SALES_TEAM}
                      onToggle={(rep) => onToggleRep(c.id, rep)}
                    />
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No conferences match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
