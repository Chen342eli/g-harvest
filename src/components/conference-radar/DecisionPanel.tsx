import { useMemo, useState } from "react";
import { Sparkles, X, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Conference, DecisionStatus } from "@/lib/conferences";
import { DECISION_STATUSES } from "@/lib/conferences";
import { evaluateInsights, recommendShortlist, type Insight } from "@/lib/insights";
import { StatusChip, StatusDot } from "./StatusChip";
import { CoverageMeters } from "./CoverageMeters";
import { InsightCard } from "./InsightCard";
import { cn } from "@/lib/utils";

interface Props {
  conferences: Conference[];
  onClose: () => void;
  onSetStatus: (id: string, status: DecisionStatus) => void;
  onApplyInsight: (insight: Insight) => void;
}

export function DecisionPanel({ conferences, onClose, onSetStatus, onApplyInsight }: Props) {
  const insights = useMemo(() => evaluateInsights(conferences), [conferences]);
  const going = useMemo(() => conferences.filter((c) => c.status === "Going"), [conferences]);
  const totalAudience = useMemo(
    () => going.reduce((sum, c) => sum + c.estimatedAudienceSize, 0),
    [going],
  );
  const warnCount = insights.filter((i) => i.severity === "warn").length;
  const infoCount = insights.length - warnCount;

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Decision panel</div>
          <div className="text-[11px] text-muted-foreground">
            {going.length} Going · {warnCount} warning{warnCount === 1 ? "" : "s"} · {infoCount} idea{infoCount === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <Tabs defaultValue="insights" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="m-3 grid grid-cols-3">
          <TabsTrigger value="insights" className="text-xs">
            Insights {insights.length > 0 && <span className="ml-1 rounded bg-muted px-1 text-[10px]">{insights.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="shortlist" className="text-xs">Shortlist</TabsTrigger>
          <TabsTrigger value="auto" className="text-xs">Auto-pick</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="flex-1 overflow-y-auto px-3 pb-3">
          {insights.length === 0 ? (
            <EmptyState
              title="All clear"
              detail="No coverage gaps, concentration risks, or trip opportunities right now."
            />
          ) : (
            <div className="space-y-2">
              {insights.map((i) => (
                <InsightCard key={i.id} insight={i} onAction={onApplyInsight} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shortlist" className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="mb-4 rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Coverage of {going.length} Going
            </div>
            <div className="mb-3 text-xs text-muted-foreground">
              Reach: <span className="font-medium tabular-nums text-foreground">{new Intl.NumberFormat("en-US").format(totalAudience)}</span> attendees
            </div>
            <CoverageMeters going={going} />
          </div>

          {DECISION_STATUSES.map((s) => {
            const list = conferences
              .filter((c) => c.status === s)
              .sort((a, b) => b.icpScore - a.icpScore);
            return (
              <div key={s} className="mb-4">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <StatusDot status={s} /> {s} <span className="tabular-nums">({list.length})</span>
                </div>
                {list.length === 0 ? (
                  <div className="text-xs italic text-muted-foreground">None.</div>
                ) : (
                  <ul className="space-y-1">
                    {list.map((c) => (
                      <ShortlistRow key={c.id} conference={c} onSetStatus={onSetStatus} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="auto" className="flex-1 overflow-y-auto px-3 pb-3">
          <AutoPick conferences={conferences} onSetStatus={onSetStatus} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function ShortlistRow({
  conference,
  onSetStatus,
}: {
  conference: Conference;
  onSetStatus: (id: string, s: DecisionStatus) => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-foreground">{conference.name}</span>
          <a
            href={conference.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="text-[10px] text-muted-foreground">
          ICP {conference.icpScore} · {conference.vertical} · {conference.city}
        </div>
      </div>
      <StatusChip status={conference.status} onChange={(s) => onSetStatus(conference.id, s)} size="xs" />
    </li>
  );
}

function AutoPick({
  conferences,
  onSetStatus,
}: {
  conferences: Conference[];
  onSetStatus: (id: string, s: DecisionStatus) => void;
}) {
  const [budget, setBudget] = useState(6);
  const [preview, setPreview] = useState<string[] | null>(null);

  const previewList = useMemo(
    () => (preview ? preview.map((id) => conferences.find((c) => c.id === id)!).filter(Boolean) : []),
    [preview, conferences],
  );

  const run = () => setPreview(recommendShortlist(conferences, budget));
  const apply = () => {
    if (!preview) return;
    const set = new Set(preview);
    conferences.forEach((c) => {
      const desired: DecisionStatus = set.has(c.id) ? "Going" : c.status === "Going" ? "Considering" : c.status;
      if (desired !== c.status) onSetStatus(c.id, desired);
    });
    setPreview(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Rule-based recommendation. Picks top ICP scores while covering every vertical present and at least 2 regions.
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Budget</span>
          <span className="tabular-nums text-muted-foreground">{budget} conferences</span>
        </div>
        <Slider
          value={[budget]}
          min={2}
          max={Math.min(12, conferences.length)}
          step={1}
          onValueChange={(v) => setBudget(v[0])}
        />
      </div>

      <Button onClick={run} className="w-full" size="sm">
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        Suggest a shortlist
      </Button>

      {previewList.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Proposed shortlist
          </div>
          <ul className="space-y-1">
            {previewList.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "flex items-center justify-between rounded-md border px-2 py-1.5 text-xs",
                  c.status === "Going"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-border bg-background",
                )}
              >
                <div className="flex-1 overflow-hidden">
                  <div className="truncate font-medium text-foreground">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    ICP {c.icpScore} · {c.vertical} · {c.region}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button onClick={apply} size="sm" className="flex-1">Apply (mark Going)</Button>
            <Button onClick={() => setPreview(null)} size="sm" variant="ghost">Dismiss</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-10 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 max-w-[240px] text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
