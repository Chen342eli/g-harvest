import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, X } from "lucide-react";
import { listAgentRuns, listChangeFlags, resolveFlag } from "@/lib/agent.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/agent")({
  head: () => ({ meta: [{ title: "Discovery Agent · Conference Radar" }] }),
  component: AgentPage,
});

function AgentPage() {
  const qc = useQueryClient();
  const fetchRuns = useServerFn(listAgentRuns);
  const fetchFlags = useServerFn(listChangeFlags);
  const resolve = useServerFn(resolveFlag);

  const { data: runs = [] } = useQuery({ queryKey: ["agentRuns"], queryFn: () => fetchRuns(), refetchInterval: 15_000 });
  const { data: flags = [] } = useQuery({ queryKey: ["changeFlags"], queryFn: () => fetchFlags() });

  const m = useMutation({
    mutationFn: (v: { id: string; action: "accept" | "dismiss" }) => resolve({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changeFlags"] });
      qc.invalidateQueries({ queryKey: ["conferences"] });
      toast.success("Flag resolved");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <div>
            <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back to radar
            </Link>
            <h1 className="mt-1 text-base font-semibold tracking-tight text-foreground">Discovery Agent</h1>
            <p className="text-xs text-muted-foreground">Weekly scans for new conferences and flagged changes.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-6 px-6 py-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Run history</h2>
            <p className="text-xs text-muted-foreground">Most recent first · last 25 runs</p>
          </div>
          <div className="divide-y divide-border">
            {runs.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No runs yet.</p>}
            {runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                      r.status === "success" ? "bg-emerald-500"
                      : r.status === "error" ? "bg-red-500"
                      : "bg-amber-500"
                    }`} />
                    <span className="font-medium text-foreground">{new Date(r.started_at).toLocaleString()}</span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{r.trigger}</span>
                  </div>
                  {r.error && <p className="mt-0.5 truncate text-xs text-red-600" title={r.error}>{r.error}</p>}
                </div>
                <div className="flex shrink-0 gap-3 text-xs tabular-nums text-muted-foreground">
                  <span>found <span className="font-medium text-foreground">{r.found_count}</span></span>
                  <span>added <span className="font-medium text-emerald-700">{r.added_count}</span></span>
                  <span>flagged <span className="font-medium text-amber-700">{r.flagged_count}</span></span>
                  <span>skipped <span className="font-medium text-foreground">{r.skipped_count}</span></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Pending change flags</h2>
            <p className="text-xs text-muted-foreground">Source has changed — review and accept or dismiss.</p>
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
                      <button
                        type="button"
                        onClick={() => m.mutate({ id: f.id, action: "accept" })}
                        className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs text-emerald-700 hover:bg-muted"
                      >
                        <Check className="h-3 w-3" /> Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => m.mutate({ id: f.id, action: "dismiss" })}
                        className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-3 w-3" /> Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
