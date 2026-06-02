import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Inbox, Sparkles } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { usePeopleData } from "@/lib/people-store";
import { useBulkAiReads } from "@/lib/use-bulk-ai";
import type { AiConfidence, Person } from "@/lib/people-types";
import { cn } from "@/lib/utils";
import { FollowUpRow as Row } from "@/components/follow-ups/FollowUpRow";

export const Route = createFileRoute("/follow-ups")({
  head: () => ({ meta: [{ title: "Follow-ups · Grain Harvest" }] }),
  component: FollowUpsPage,
});

const CONF_RANK: Record<AiConfidence, number> = { high: 3, medium: 2, low: 1 };


function FollowUpsPage() {
  // Auto-generate AI reads for any person without one cached
  useBulkAiReads();
  const data = usePeopleData();
  const [deprioOpen, setDeprioOpen] = useState(false);

  const { chaseNow, worthTouch, deprioritized, generatingCount } = useMemo(() => {
    const pending = data.people.filter((p) => (p.followUpStatus ?? "pending") === "pending");

    const chase = pending
      .filter((p) => p.aiSignal === "Warming")
      .sort((a, b) => {
        const c = (CONF_RANK[b.aiConfidence ?? "low"] ?? 0) - (CONF_RANK[a.aiConfidence ?? "low"] ?? 0);
        if (c !== 0) return c;
        return (b.aiGeneratedAt ?? "").localeCompare(a.aiGeneratedAt ?? "");
      });

    const worth = pending
      .filter((p) => p.aiSignal === "Steady" || p.aiSignal === "Too early")
      .sort((a, b) => (b.aiGeneratedAt ?? "").localeCompare(a.aiGeneratedAt ?? ""));

    const deprio = pending.filter((p) => p.aiSignal === "Tire-kicker");

    const generating = data.people.filter((p) => !p.aiSignal).length;

    return { chaseNow: chase, worthTouch: worth, deprioritized: deprio, generatingCount: generating };
  }, [data.people]);

  const totalActive = chaseNow.length + worthTouch.length;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto max-w-[1100px] space-y-6 px-6 py-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">
            Prioritized action inbox · {totalActive} active
            {generatingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground/70">
                <Sparkles className="h-3 w-3 animate-pulse" />
                analyzing {generatingCount}…
              </span>
            )}
          </p>
        </header>

        {totalActive === 0 && deprioritized.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-sm font-semibold text-foreground">Inbox zero</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing to chase right now. New encounters will queue up here.
            </p>
            <Link
              to="/floor"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Go to Floor
            </Link>
          </div>
        ) : (
          <>
            <Section
              title="Chase now"
              accent="hot"
              description="Warming signal · move while it's hot"
              count={chaseNow.length}
              items={chaseNow}
              emptyText="No urgent follow-ups."
            />
            <Section
              title="Worth a touch"
              accent="warm"
              description="Steady or too early · light nurture"
              count={worthTouch.length}
              items={worthTouch}
              emptyText="Nothing to nurture."
            />

            {deprioritized.length > 0 && (
              <section className="rounded-xl border border-border bg-card/40">
                <button
                  type="button"
                  onClick={() => setDeprioOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Deprioritized
                    </span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {deprioritized.length}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      tire-kickers · not counted as actions
                    </span>
                  </div>
                  {deprioOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {deprioOpen && (
                  <ul className="divide-y divide-border border-t border-border">
                    {deprioritized.map((p) => (
                      <Row key={p.id} person={p} muted />
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  accent,
  description,
  count,
  items,
  emptyText,
}: {
  title: string;
  accent: "hot" | "warm";
  description: string;
  count: number;
  items: Person[];
  emptyText: string;
}) {
  const dot = accent === "hot" ? "bg-temp-hot" : "bg-temp-warm";

  return (
    <section className="space-y-2">
      <header className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">{title}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {count}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{description}</span>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((p) => (
            <Row key={p.id} person={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

