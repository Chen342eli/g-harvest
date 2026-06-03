import { ExternalLink, Table as TableIcon } from "lucide-react";
import type { Conference } from "@/lib/conferences";
import { isCoverageGap } from "@/lib/conferences";
import { TierBadge, CoverageGapBadge } from "./TierBadge";

const dateRange = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric" });
  if (sameMonth) return `${monthFmt.format(s)}–${e.getDate()}, ${yearFmt.format(s)}`;
  return `${monthFmt.format(s)} – ${monthFmt.format(e)}, ${yearFmt.format(e)}`;
};

const audienceFmt = new Intl.NumberFormat("en-US");

export function ConferenceDetail({
  conference,
  onOpenInTable,
  committedIds,
}: {
  conference: Conference;
  onOpenInTable?: (id: string) => void;
  committedIds?: Set<string>;
}) {
  const c = conference;
  const gap = isCoverageGap(c, committedIds);
  const inPlan = committedIds?.has(c.id) ?? false;
  return (
    <div className="w-[280px] space-y-2 text-sm text-foreground">
      <div>
        {onOpenInTable ? (
          <button
            type="button"
            onClick={() => onOpenInTable(c.id)}
            className="inline-flex items-center gap-1 text-left font-semibold text-foreground hover:text-primary hover:underline"
          >
            {c.name}
            <TableIcon className="h-3.5 w-3.5 opacity-70" />
          </button>
        ) : (
          <span className="font-semibold text-foreground">{c.name}</span>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          {c.city}, {c.country}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <TierBadge tier={c.tier} />
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-secondary-foreground">
          Score {c.icpScore}
        </span>
        {inPlan && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            In plan
          </span>
        )}
        {gap && <CoverageGapBadge />}
      </div>

      <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-xs">
        <dt className="text-muted-foreground">Dates</dt>
        <dd className="text-foreground">{dateRange(c.startDate, c.endDate)}</dd>
        <dt className="text-muted-foreground">Vertical</dt>
        <dd className="text-foreground">{c.vertical}</dd>
        <dt className="text-muted-foreground">Audience</dt>
        <dd className="text-foreground tabular-nums">{audienceFmt.format(c.estimatedAudienceSize)}</dd>
        <dt className="text-muted-foreground">Reps</dt>
        <dd className="text-foreground">
          {c.assignedReps.length ? c.assignedReps.join(", ") : <span className="text-muted-foreground">Unassigned</span>}
        </dd>
        {(c.officialUrl ?? c.sourceUrl) && (
          <>
            <dt className="text-muted-foreground">Website</dt>
            <dd className="truncate">
              <a
                href={c.officialUrl ?? c.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            </dd>
            {c.officialUrl && c.sourceUrl && c.officialUrl !== c.sourceUrl && (
              <>
                <dt className="text-muted-foreground">Found via</dt>
                <dd className="truncate">
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:underline"
                  >
                    {(() => { try { return new URL(c.sourceUrl).host; } catch { return c.sourceUrl; } })()}
                  </a>
                </dd>
              </>
            )}
          </>
        )}
      </dl>
    </div>
  );
}
