import { useState } from "react";
import { Check, Copy, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { updatePerson } from "@/lib/people-store";
import type { AiConfidence, AiSignal, Person } from "@/lib/people-types";
import { cn } from "@/lib/utils";

const SIGNAL_STYLE: Record<AiSignal, string> = {
  Warming: "bg-temp-hot/15 text-temp-hot border-temp-hot/30",
  Steady: "bg-temp-warm/15 text-temp-warm border-temp-warm/30",
  "Too early": "bg-muted text-muted-foreground border-border",
  "Tire-kicker": "bg-temp-cold/15 text-temp-cold border-temp-cold/30",
};

export function SignalBadge({
  signal,
  confidence,
}: {
  signal: AiSignal;
  confidence?: AiConfidence;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        SIGNAL_STYLE[signal],
      )}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {signal}
      {confidence && <span className="opacity-70">· {confidence}</span>}
    </span>
  );
}

export function FollowUpRow({
  person,
  muted = false,
}: {
  person: Person;
  muted?: boolean;
}) {
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

  const subline = [
    person.currentRole,
    person.currentCompany ? `@ ${person.currentCompany}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={cn("p-4 space-y-3", muted && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {person.fullName}
            </span>
            {person.aiSignal && (
              <SignalBadge
                signal={person.aiSignal}
                confidence={person.aiConfidence}
              />
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
