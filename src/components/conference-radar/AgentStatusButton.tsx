import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, ExternalLink, Loader2, Square } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getLastRun, cancelRunningAgent } from "@/lib/agent.functions";
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
  const cancelRun = useServerFn(cancelRunningAgent);

  const { data: lastRun } = useQuery({
    queryKey: ["lastAgentRun"],
    queryFn: () => fetchLastRun(),
    refetchInterval: 15_000,
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

  const running = lastRun?.status === "running";
  const cancelRequested = !!(lastRun as { cancel_requested?: boolean } | null)?.cancel_requested;
  const statusColor =
    lastRun?.status === "error" ? "bg-red-500"
    : lastRun?.status === "running" ? "bg-amber-500 animate-pulse"
    : lastRun?.status === "success" ? "bg-emerald-500"
    : "bg-zinc-300";

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-[11px]"
      title="Discovery agent"
    >
      <Bot className="h-3 w-3 text-muted-foreground" />
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor}`} />
      <span className="text-muted-foreground">{formatRelative(lastRun?.started_at)}</span>
      {lastRun ? (
        <span className="font-medium text-foreground tabular-nums">
          +{lastRun.added_count ?? 0}
        </span>
      ) : null}
      {running && (
        <button
          type="button"
          onClick={() => cancelMutation.mutate()}
          disabled={cancelRequested || cancelMutation.isPending}
          className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 hover:bg-amber-500/20 disabled:opacity-60 dark:text-amber-400"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          {cancelRequested ? "Stopping" : "Stop"}
          {!cancelRequested && <Square className="h-2 w-2 fill-current" />}
        </button>
      )}
      <Link
        to="/agent"
        className="inline-flex items-center text-muted-foreground hover:text-foreground"
        title="History"
        aria-label="Agent history"
      >
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
