import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Copy, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { updatePerson } from "@/lib/people-store";
import { analyzeRelationship } from "@/lib/relationship-ai.functions";
import { computeBadges } from "@/lib/matching";
import type { AiConfidence, AiSignal, Encounter, Person } from "@/lib/people-types";
import { TempDot } from "@/components/people/TempControls";
import { BadgeList } from "@/components/people/Badges";
import { cn } from "@/lib/utils";

const SIGNAL_STYLE: Record<AiSignal, string> = {
  "Warming": "bg-temp-hot/15 text-temp-hot border-temp-hot/30",
  "Steady": "bg-temp-warm/15 text-temp-warm border-temp-warm/30",
  "Too early": "bg-muted text-muted-foreground border-border",
  "Tire-kicker": "bg-temp-cold/15 text-temp-cold border-temp-cold/30",
};

export function SignalBadge({ signal, confidence }: { signal?: AiSignal; confidence?: AiConfidence }) {
  if (!signal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
        <Sparkles className="h-2.5 w-2.5" />no read
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", SIGNAL_STYLE[signal])}>
      <Sparkles className="h-2.5 w-2.5" />
      {signal}
      {confidence && <span className="opacity-70">· {confidence}</span>}
    </span>
  );
}

export function PersonDetail({
  person,
  encounters,
  badges,
}: {
  person: Person;
  encounters: Encounter[];
  badges: ReturnType<typeof computeBadges>;
}) {
  return (
    <div className="space-y-4 p-5 pr-12">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{person.fullName}</h2>
        {person.nameVariations.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Also known as: {person.nameVariations.join(", ")}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {person.currentRole ?? "—"}{person.currentCompany ? ` @ ${person.currentCompany}` : ""}
          {person.currentVertical ? ` · ${person.currentVertical}` : ""}
        </p>
        {person.linkedInUrl && (
          <a
            href={person.linkedInUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-primary underline"
          >
            LinkedIn ↗
          </a>
        )}
      </div>

      <BadgeList badges={badges} />

      <AiPanel person={person} encounters={encounters} />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Touchpoints</h3>
        <ol className="space-y-2">
          {encounters.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">{e.conferenceName}</div>
                <TempDot t={e.temperature} />
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.timestamp).toLocaleDateString()} · by {e.repId}
              </div>
              <div className="mt-1 text-xs text-foreground">
                {e.roleAtTime ?? "—"}{e.companyAtTime ? ` @ ${e.companyAtTime}` : ""}
                {e.vertical ? ` · ${e.vertical}` : ""}
              </div>
              {e.note && <div className="mt-1 text-xs italic text-muted-foreground">"{e.note}"</div>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function AiPanel({ person, encounters }: { person: Person; encounters: Encounter[] }) {
  const analyze = useServerFn(analyzeRelationship);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const ranForRef = useRef<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        person: {
          fullName: person.fullName,
          nameVariations: person.nameVariations,
          linkedInUrl: person.linkedInUrl ?? null,
          currentRole: person.currentRole ?? null,
          currentCompany: person.currentCompany ?? null,
          currentVertical: person.currentVertical ?? null,
        },
        encounters: encounters.map((e) => ({
          date: e.timestamp.slice(0, 10),
          conferenceName: e.conferenceName,
          repName: e.repId,
          temperature: e.temperature,
          roleAtTime: e.roleAtTime ?? null,
          companyAtTime: e.companyAtTime ?? null,
          note: e.note ?? null,
        })),
      };
      const out = await analyze({ data: payload });
      updatePerson(person.id, {
        aiSignal: out.signal,
        aiConfidence: out.confidence,
        aiReasoning: out.reasoning,
        aiNudge: out.nudge,
        aiArcSummary: out.arcSummary,
        aiGeneratedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to analyze relationship";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (person.aiSignal) return;
    if (ranForRef.current === person.id) return;
    ranForRef.current = person.id;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id]);

  const copyNudge = async () => {
    if (!person.aiNudge) return;
    const text = `Subject: ${person.aiNudge.subject}\n\n${person.aiNudge.body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Nudge copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const hasRead = !!person.aiSignal;

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Signal</span>
      </div>

      {loading && !hasRead && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          Analyzing relationship…
        </div>
      )}

      {error && !hasRead && (
        <div className="space-y-2">
          <div className="text-xs text-destructive">{error}</div>
          <button
            type="button"
            onClick={run}
            className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-muted"
          >
            Retry
          </button>
        </div>
      )}

      {hasRead && (
        <>
          <SignalBadge signal={person.aiSignal} confidence={person.aiConfidence} />
          {person.aiReasoning && (
            <p className="text-sm text-foreground leading-relaxed">{person.aiReasoning}</p>
          )}

          {person.aiNudge && (
            <div className="rounded-md border border-border bg-muted/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setNudgeOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition"
              >
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                  Suggested follow-up
                </span>
                <span className="truncate text-xs text-foreground flex-1">
                  {person.aiNudge.subject}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                    nudgeOpen && "rotate-180",
                  )}
                />
              </button>
              {nudgeOpen && (
                <div className="border-t border-border bg-background/50 p-3 space-y-2">
                  <div className="whitespace-pre-wrap text-xs text-foreground leading-relaxed">
                    {person.aiNudge.body}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={copyNudge}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-foreground hover:bg-muted"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground opacity-60 cursor-not-allowed"
                    >
                      <Mail className="h-3 w-3" />
                      Open in email
                      <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide">coming soon</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
