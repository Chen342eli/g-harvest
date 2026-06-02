import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Inbox, Sparkles } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { usePeopleData } from "@/lib/people-store";
import { useBulkAiReads } from "@/lib/use-bulk-ai";
import type { AiConfidence, Person } from "@/lib/people-types";
import { cn } from "@/lib/utils";
import { FollowUpRow } from "@/components/follow-ups/FollowUpRow";

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
                      <FollowUpRow key={p.id} person={p} muted />
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
            <FollowUpRow key={p.id} person={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FollowUpRow({ person, muted = false }: { person: Person; muted?: boolean }) {
  const [open, setOpen] = useState(false);

  const markDone = () => {
    updatePerson(person.id, { followUpStatus: "done" });
    toast.success(`Marked ${person.fullName} as done`);
  };

  const copyNudge = async () => {
    if (!person.aiNudge) return;
    try {
      await navigator.clipboard.writeText(
        `Subject: ${person.aiNudge.subject}\n\n${person.aiNudge.body}`,
      );
      toast.success("Nudge copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const subline = [person.currentRole, person.currentCompany ? `@ ${person.currentCompany}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={cn("p-4 space-y-3", muted && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{person.fullName}</span>
            {person.aiSignal && (
              <SignalBadge signal={person.aiSignal} confidence={person.aiConfidence} />
            )}
          </div>
          {subline && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subline}</p>
          )}
          {person.aiReasoning && (
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
              {person.aiReasoning}
            </p>
          )}
        </div>
        {!muted && (
          <button
            type="button"
            onClick={markDone}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted"
          >
            <Check className="h-3 w-3" /> Mark done
          </button>
        )}
      </div>

      {person.aiNudge && !muted && (
        <div className="rounded-lg border border-border bg-background/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate text-xs font-medium text-foreground">
                {person.aiNudge.subject}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {open ? "hide" : "open"}
            </span>
          </button>
          {open && (
            <div className="border-t border-border bg-background p-3 space-y-2">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                {person.aiNudge.body}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyNudge}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground hover:opacity-90"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground cursor-not-allowed"
                >
                  <Mail className="h-3 w-3" /> Open in email
                  <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[8px] uppercase tracking-wide">
                    soon
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
