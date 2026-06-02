import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, CheckCheck, ChevronDown, ChevronRight, Play, X, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { listAgentRuns, listChangeFlags, listRunCandidates, resolveFlag, runAgentNow } from "@/lib/agent.functions";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/agent")({
  head: () => ({ meta: [{ title: "Discovery Agent · Conference Radar" }] }),
  component: AgentPage,
});

function formatDuration(ms: number | null | undefined) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

function formatTokens(n: number | null | undefined) {
  if (!n) return "0";
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}k`;
}

// Rough cost: Gemini Flash ~$0.075/1M input, $0.30/1M output. Use blended estimate.
function estimateCost(total: number | null | undefined) {
  if (!total) return "—";
  const usd = (total / 1_000_000) * 0.2;
  return usd < 0.01 ? `<$0.01` : `$${usd.toFixed(3)}`;
}

function AgentPage() {
  const qc = useQueryClient();
  const fetchRuns = useServerFn(listAgentRuns);
  const fetchFlags = useServerFn(listChangeFlags);
  const resolve = useServerFn(resolveFlag);
  const triggerRun = useServerFn(runAgentNow);

  const { data: runs = [] } = useQuery({ queryKey: ["agentRuns"], queryFn: () => fetchRuns(), refetchInterval: 15_000 });
  const { data: flags = [] } = useQuery({ queryKey: ["changeFlags"], queryFn: () => fetchFlags() });

  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: (v: { id: string; action: "accept" | "dismiss" }) => resolve({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changeFlags"] });
      qc.invalidateQueries({ queryKey: ["conferences"] });
    },
  });

  const runMutation = useMutation({
    mutationFn: () => triggerRun(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agentRuns"] });
      qc.invalidateQueries({ queryKey: ["changeFlags"] });
      qc.invalidateQueries({ queryKey: ["conferences"] });
      toast.success("Agent run complete");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Agent run failed"),
  });

  const acceptAllMutation = useMutation({
    mutationFn: async () => {
      for (const f of flags) {
        await resolve({ data: { id: f.id, action: "accept" } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changeFlags"] });
      qc.invalidateQueries({ queryKey: ["conferences"] });
      toast.success("All pending flags accepted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to accept all"),
  });


  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto max-w-[1200px] space-y-4 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/planning">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Conference Management
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Running…</>
            ) : (
              <><Play className="mr-1 h-3.5 w-3.5" /> Run agent now</>
            )}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Run history</h2>
            <p className="text-xs text-muted-foreground">Click a row to see every candidate the agent considered.</p>
          </div>
          <div className="divide-y divide-border">
            {runs.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No runs yet.</p>}
            {runs.map((r) => {
              const isOpen = expandedRun === r.id;
              return (
                <div key={r.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedRun(isOpen ? null : r.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        r.status === "success" ? "bg-emerald-500" : r.status === "error" ? "bg-red-500" : "bg-amber-500",
                      )} />
                      <span className="font-medium text-foreground">{new Date(r.started_at).toLocaleString()}</span>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{r.trigger}</span>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                      <span>found <span className="font-medium text-foreground">{r.found_count}</span></span>
                      <span>added <span className="font-medium text-emerald-700">{r.added_count}</span></span>
                      <span>flagged <span className="font-medium text-amber-700">{r.flagged_count}</span></span>
                      <span>skipped <span className="font-medium text-foreground">{r.skipped_count}</span></span>
                      <span className="border-l border-border pl-3">⏱ {formatDuration((r as { duration_ms?: number }).duration_ms)}</span>
                      <span>🪙 {formatTokens((r as { total_tokens?: number }).total_tokens)}</span>
                      <span>{estimateCost((r as { total_tokens?: number }).total_tokens)}</span>
                    </div>
                  </button>
                  {r.error && <p className="px-9 pb-2 text-xs text-red-600">{r.error}</p>}
                  {isOpen && <CandidateList runId={r.id} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card self-start">
          <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Pending change flags</h2>
              <p className="text-xs text-muted-foreground">Source has changed — review and accept or dismiss.</p>
            </div>
            {flags.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => acceptAllMutation.mutate()}
                disabled={acceptAllMutation.isPending}
              >
                {acceptAllMutation.isPending ? (
                  <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Accepting…</>
                ) : (
                  <><CheckCheck className="mr-1 h-3.5 w-3.5" /> Accept all ({flags.length})</>
                )}
              </Button>
            )}
          </div>

          <div className="divide-y divide-border">
            {flags.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No pending flags.</p>}
            {flags.map((f) => {
              const conf = (f as unknown as { conferences?: { name: string; city: string } | null }).conferences;
              return (
                <div key={f.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{conf?.name ?? "Conference"}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{f.field}</span> ·{" "}
                        <span className="text-red-600 line-through">{String(f.old_value)}</span>{" "}
                        →{" "}
                        <span className="text-emerald-700">{String(f.new_value)}</span>
                      </p>
                      {f.source_url && (
                        <a href={f.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground underline">
                          source
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => m.mutate({ id: f.id, action: "accept" })} className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs text-emerald-700 hover:bg-muted">
                        <Check className="h-3 w-3" /> Accept
                      </button>
                      <button type="button" onClick={() => m.mutate({ id: f.id, action: "dismiss" })} className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
                        <X className="h-3 w-3" /> Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        </div>
      </main>
    </div>
  );
}

const DECISION_STYLE: Record<string, string> = {
  added: "bg-emerald-50 text-emerald-700 border-emerald-200",
  flagged: "bg-amber-50 text-amber-700 border-amber-200",
  skipped: "bg-zinc-50 text-zinc-600 border-zinc-200",
  error: "bg-red-50 text-red-700 border-red-200",
};

function CandidateList({ runId }: { runId: string }) {
  const fetchCandidates = useServerFn(listRunCandidates);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["agentCandidates", runId],
    queryFn: () => fetchCandidates({ data: { runId } }),
  });
  const [filter, setFilter] = useState<"all" | "added" | "flagged" | "skipped" | "error">("all");

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.decision] = (acc[r.decision] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = filter === "all" ? rows : rows.filter((r) => r.decision === filter);

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      {isLoading && <p className="text-xs text-muted-foreground">Loading candidates…</p>}
      {!isLoading && rows.length === 0 && <p className="text-xs text-muted-foreground">No candidates logged for this run.</p>}
      {rows.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            {(["all", "added", "flagged", "skipped", "error"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  "rounded border px-2 py-0.5 text-[11px] capitalize",
                  filter === k ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {k} {k !== "all" && <span className="tabular-nums">({counts[k] ?? 0})</span>}
              </button>
            ))}
          </div>
          <ul className="space-y-1.5">
            {filtered.map((c) => (
              <li key={c.id} className="rounded border border-border bg-card px-2.5 py-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", DECISION_STYLE[c.decision] ?? "")}>
                    {c.decision}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground" title={c.title ?? c.url}>{c.title ?? c.url}</p>
                    <p className="text-muted-foreground">{c.reason}</p>
                    <a href={c.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 truncate text-[10px] text-muted-foreground underline">
                      <ExternalLink className="h-2.5 w-2.5" />
                      {c.url}
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
