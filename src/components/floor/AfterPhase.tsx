import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Pencil, Sparkles, Upload } from "lucide-react";
import { usePeopleData } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { useBulkAiReads } from "@/lib/use-bulk-ai";
import { FollowUpRow } from "@/components/follow-ups/FollowUpRow";
import { AddTouchpointDialog } from "@/components/people/AddTouchpointDialog";

interface Props {
  conferenceId: string;
}

export function AfterPhase({ conferenceId }: Props) {
  // Make sure AI reads are generated for this event's people
  useBulkAiReads();
  const data = usePeopleData();
  const settings = useSettings();
  const activeRepId = settings.activeRepId;

  const { needsInfo, followUps } = useMemo(() => {
    const personIds = new Set(
      data.encounters
        .filter((e) => {
          if (e.conferenceId !== conferenceId) return false;
          if (activeRepId && e.repId !== activeRepId) return false;
          return true;
        })
        .map((e) => e.personId),
    );
    const eventPeople = data.people.filter((p) => personIds.has(p.id));

    const needs = eventPeople
      .map((p) => {
        const missing: string[] = [];
        if (!p.linkedInUrl) missing.push("LinkedIn");
        if (!p.currentRole) missing.push("title");
        const personEncs = data.encounters.filter(
          (e) => e.personId === p.id && e.conferenceId === conferenceId,
        );
        if (!personEncs.some((e) => e.note && e.note.trim().length > 0)) {
          missing.push("note");
        }
        // Latest encounter for this conference — the one Edit will open
        const latestEnc = personEncs[personEncs.length - 1];
        return { person: p, missing, encounterId: latestEnc?.id };
      })
      .filter((l) => l.missing.length > 0);

    // Same filter as Follow-ups page: only pending entries
    const followUps = eventPeople.filter(
      (p) => (p.followUpStatus ?? "pending") === "pending",
    );

    return { needsInfo: needs, followUps };
  }, [data, conferenceId, activeRepId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          to="/import"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          <Upload className="h-3.5 w-3.5" /> Import from scans
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enhancement */}
        <section className="space-y-2">
          <header className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Enhancement</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {needsInfo.length}
            </span>
          </header>

          {needsInfo.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-4 text-center text-xs text-muted-foreground">
              All leads have core info filled.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {needsInfo.map(({ person, missing, encounterId }) => (
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
                  <button
                    type="button"
                    onClick={() =>
                      setEditTarget({ personId: person.id, encounterId: encounterId ?? null })
                    }
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition hover:border-foreground/30 hover:bg-muted"
                    title="Add the missing details for this touchpoint"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>


        {/* Follow-up suggestions — same rows as the Follow-ups inbox */}
        <section className="space-y-2">
          <header className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-accent" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Follow-up suggestions</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {followUps.length}
            </span>
          </header>

          {followUps.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-4 text-center text-xs text-muted-foreground">
              Inbox zero for this event.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {followUps.map((person) => (
                <FollowUpRow key={person.id} person={person} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
