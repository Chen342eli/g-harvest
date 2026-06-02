import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Send, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { usePeopleData, updatePerson } from "@/lib/people-store";
import { useBulkAiReads } from "@/lib/use-bulk-ai";
import type { AiSignal } from "@/lib/people-types";
import { cn } from "@/lib/utils";

interface Props {
  conferenceId: string;
}

const SIGNAL_STYLE: Record<AiSignal, string> = {
  Warming: "bg-temp-hot/15 text-temp-hot border-temp-hot/30",
  Steady: "bg-temp-warm/15 text-temp-warm border-temp-warm/30",
  "Too early": "bg-muted text-muted-foreground border-border",
  "Tire-kicker": "bg-temp-cold/15 text-temp-cold border-temp-cold/30",
};

const ACTION: Record<AiSignal, string> = {
  Warming: "Send follow-up now",
  Steady: "Nurture with a light touch",
  "Too early": "Park and revisit later",
  "Tire-kicker": "Deprioritize",
};

export function AfterPhase({ conferenceId }: Props) {
  // Make sure AI reads are generated for this event's people
  useBulkAiReads();
  const data = usePeopleData();

  const eventLeads = useMemo(() => {
    const personIds = new Set(
      data.encounters.filter((e) => e.conferenceId === conferenceId).map((e) => e.personId),
    );
    return data.people
      .filter((p) => personIds.has(p.id))
      .map((p) => {
        const missing: string[] = [];
        if (!p.linkedInUrl) missing.push("LinkedIn");
        if (!p.currentRole) missing.push("role");
        const personEncs = data.encounters.filter(
          (e) => e.personId === p.id && e.conferenceId === conferenceId,
        );
        if (!personEncs.some((e) => e.note && e.note.trim().length > 0)) {
          missing.push("note");
        }
        return { person: p, missing };
      });
  }, [data, conferenceId]);

  const needsInfo = eventLeads.filter((l) => l.missing.length > 0);
  const ready = eventLeads.filter((l) => l.missing.length === 0);

  const sendToFollowUps = (id: string, name: string) => {
    updatePerson(id, { followUpStatus: "pending" });
    toast.success(`${name} → Follow-ups`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Wrap-up mode.</span> Plug gaps from
        scanner exports, then push the right leads into the Follow-ups inbox.
      </div>

      {/* Missing-info section */}
      <section className="space-y-2">
        <header className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Needs cleanup</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {needsInfo.length}
            </span>
          </div>
          <Link
            to="/import"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <Upload className="h-3.5 w-3.5" /> Import from scans
          </Link>
        </header>

        {needsInfo.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-4 text-center text-xs text-muted-foreground">
            All leads have core info filled. Nothing to clean up.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {needsInfo.map(({ person, missing }) => (
              <li key={person.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{person.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {[person.currentRole, person.currentCompany].filter(Boolean).join(" @ ") || "—"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-amber-700">
                    Missing: {missing.join(", ")}
                  </div>
                </div>
                <Link
                  to="/people"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-accent hover:underline"
                >
                  Edit <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Follow-up suggestions */}
      <section className="space-y-2">
        <header className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-accent" />
          <h2 className="text-sm font-bold uppercase tracking-widest">Follow-up suggestions</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {eventLeads.length}
          </span>
        </header>

        {eventLeads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-4 text-center text-xs text-muted-foreground">
            No leads captured for this event yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {eventLeads.map(({ person }) => {
              const signal = person.aiSignal;
              const isPending = (person.followUpStatus ?? "pending") === "pending";
              return (
                <li key={person.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {person.fullName}
                      </span>
                      {signal ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                            SIGNAL_STYLE[signal],
                          )}
                        >
                          <Sparkles className="h-2.5 w-2.5" /> {signal}
                          {person.aiConfidence && (
                            <span className="opacity-70">· {person.aiConfidence}</span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                          <Sparkles className="h-2.5 w-2.5 animate-pulse" /> analyzing…
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[person.currentRole, person.currentCompany].filter(Boolean).join(" @ ") || "—"}
                    </div>
                    <div className="mt-1 text-xs text-foreground/80">
                      {signal ? ACTION[signal] : "Generating recommendation…"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendToFollowUps(person.id, person.fullName)}
                    disabled={!isPending}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-base px-2.5 py-1.5 text-[11px] font-bold text-brand-base-foreground hover:opacity-90 disabled:opacity-40"
                    title={isPending ? "Send to Follow-ups inbox" : "Already in Follow-ups"}
                  >
                    <Send className="h-3 w-3" />
                    {isPending ? "Send to Follow-ups" : "In inbox"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
