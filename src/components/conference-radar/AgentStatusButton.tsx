import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, ExternalLink, Loader2, Square } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { runAgentNow, getLastRun, cancelRunningAgent } from "@/lib/agent.functions";
import { toast } from "sonner";

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function AgentStatusButton() {
  const qc = useQueryClient();
  const fetchLastRun = useServerFn(getLastRun);
  const triggerRun = useServerFn(runAgentNow);
  const cancelRun = useServerFn(cancelRunningAgent);

  const { data: lastRun } = useQuery({
    queryKey: ["lastAgentRun"],
    queryFn: () => fetchLastRun(),
    refetchInterval: 15_000,
  });

  const mutation = useMutation({
    mutationFn: () => triggerRun(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["lastAgentRun"] });
      qc.invalidateQueries({ queryKey: ["conferences"] });
      qc.invalidateQueries({ queryKey: ["agentRuns"] });
      qc.invalidateQueries({ queryKey: ["changeFlags"] });
      if (result.error) {
        toast.error(`Agent finished with errors: ${result.error}`);
      } else {
        toast.success(`Agent done · ${result.added} added · ${result.flagged} flagged · ${result.skipped} skipped`);
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Agent failed");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRun(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["lastAgentRun"] });
      if (r.cancelled > 0) toast.success("Stopping scan… will halt after current candidate.");
      else toast.info("No running scan to stop.");
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Cancel failed"),
  });

  const running = mutation.isPending || lastRun?.status === "running";
  const cancelRequested = !!(lastRun as { cancel_requested?: boolean } | null)?.cancel_requested;
  const statusColor =
    lastRun?.status === "error" ? "bg-red-500"
    : lastRun?.status === "running" ? "bg-amber-500 animate-pulse"
    : lastRun?.status === "success" ? "bg-emerald-500"
    : "bg-zinc-300";

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Agent</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-foreground">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor}`} />
        <span className="text-muted-foreground">{formatRelative(lastRun?.started_at)}</span>
        {lastRun && (
          <span className="text-muted-foreground">
            · <span className="font-medium text-foreground">+{lastRun.added_count ?? 0}</span>
          </span>
        )}
      </div>
      {running ? (
        <button
          type="button"
          onClick={() => cancelMutation.mutate()}
          disabled={cancelRequested || cancelMutation.isPending}
          className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
        >
          <Square className="h-3 w-3" />
          {cancelRequested ? "Stopping…" : "Stop"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => mutation.mutate()}
          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Run now
        </button>
      )}
      <Link
        to="/agent"
        className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
      >
        History <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
