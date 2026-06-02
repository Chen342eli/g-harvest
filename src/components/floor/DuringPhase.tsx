import { useMemo, useState } from "react";
import { CalendarClock, Flame, User, Zap } from "lucide-react";
import { usePeopleData } from "@/lib/people-store";
import { useSchedule } from "@/lib/schedule-store";
import { useSettings } from "@/lib/settings-store";
import { useHotAccounts, isHotAccountCompany } from "@/lib/hot-accounts-store";
import { openPersonDrawer } from "@/lib/person-drawer-store";
import { HotLeadsSidebar } from "./HotLeadsSidebar";
import { cn } from "@/lib/utils";

interface Props {
  conferenceId: string;
  onEnterGameTime: () => void;
  canEnterGameTime: boolean;
}

const TEMP_RANK = { hot: 0, warm: 1, cold: 2 } as const;

export function DuringPhase({ conferenceId, onEnterGameTime, canEnterGameTime }: Props) {
  const data = usePeopleData();
  const schedule = useSchedule();
  const settings = useSettings();
  const accounts = useHotAccounts();
  const repId = settings.activeRepId;
  const [mineOnly, setMineOnly] = useState(false);

  const myMeetingPeople = useMemo(() => {
    const items = schedule.filter(
      (s) => s.conferenceId === conferenceId && s.kind === "meeting" && s.personId,
    );
    const map = new Map<string, { time: string; personId: string }>();
    for (const it of items) {
      const key = it.personId!;
      const stamp = `${it.date}T${it.startTime}`;
      const prev = map.get(key);
      if (!prev || stamp < prev.time) map.set(key, { time: stamp, personId: key });
    }
    return Array.from(map.values())
      .map((m) => ({
        ...m,
        person: data.people.find((p) => p.id === m.personId),
      }))
      .filter((x) => !!x.person);
  }, [schedule, conferenceId, data.people]);

  const myLeads = useMemo(() => {
    const encs = data.encounters
      .filter((e) => {
        if (e.conferenceId !== conferenceId) return false;
        if (mineOnly && repId && e.repId !== repId) return false;
        return true;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    // dedupe by personId — keep latest
    const seen = new Set<string>();
    const rows = encs
      .filter((e) => {
        if (seen.has(e.personId)) return false;
        seen.add(e.personId);
        return true;
      })
      .map((e) => {
        const person = data.people.find((p) => p.id === e.personId);
        if (!person) return null;
        const isHot =
          e.temperature === "hot" ||
          isHotAccountCompany(person.currentCompany, accounts);
        return { person, encounter: e, isHot };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    rows.sort((a, b) => {
      const h = Number(b.isHot) - Number(a.isHot);
      if (h !== 0) return h;
      return TEMP_RANK[a.encounter.temperature] - TEMP_RANK[b.encounter.temperature];
    });
    return rows;
  }, [data, conferenceId, repId, mineOnly, accounts]);

  return (
    <div className="space-y-4">
      {/* Game Time call-to-action */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canEnterGameTime}
          onClick={onEnterGameTime}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-temp-hot px-4 py-2 text-xs font-bold uppercase tracking-wide text-temp-hot-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <Zap className="h-3.5 w-3.5" /> Enter Game Time
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-4">
          {/* Today's meetings */}
          <div className="rounded-xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Scheduled 1:1s</h2>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                from prep
              </span>
            </header>
            {myMeetingPeople.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                No meetings scheduled for this event.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {myMeetingPeople.map(({ person, time }) => (
                  <li key={person!.id}>
                    <button
                      type="button"
                      onClick={() => openPersonDrawer(person!.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-muted/50"
                      title="Open contact card"
                    >
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {time.slice(11, 16)}
                      </span>
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{person!.fullName}</span>
                      {person!.currentCompany && (
                        <span className="text-xs text-muted-foreground">@ {person!.currentCompany}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Leads at this event */}
          <div className="rounded-xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Flame className="h-4 w-4 text-temp-hot" />
              <h2 className="text-sm font-semibold">Leads at this event</h2>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                {myLeads.length} captured
              </span>
              <button
                type="button"
                onClick={() => setMineOnly((v) => !v)}
                disabled={!repId}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide transition disabled:opacity-40",
                  mineOnly
                    ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
                title={repId ? "Show only leads I captured" : "Set active rep in Settings"}
              >
                Mine only
              </button>
            </header>
            {myLeads.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                Nothing captured yet. Open Game Time when you meet someone.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {myLeads.map(({ person, encounter, isHot }) => (
                  <li key={encounter.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        "mt-1 inline-block h-2 w-2 rounded-full",
                        encounter.temperature === "hot" && "bg-temp-hot",
                        encounter.temperature === "warm" && "bg-temp-warm",
                        encounter.temperature === "cold" && "bg-temp-cold",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{person.fullName}</span>
                        {isHot && (
                          <span className="rounded-full bg-temp-hot/15 px-1.5 py-0.5 text-[10px] font-medium text-temp-hot">
                            🔥 hot
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[person.currentRole, person.currentCompany].filter(Boolean).join(" @ ") || "—"}
                      </div>
                      {encounter.note && (
                        <div className="mt-0.5 text-xs italic text-muted-foreground">
                          "{encounter.note}"
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {new Date(encounter.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        entered by {encounter.repId}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </section>

        <HotLeadsSidebar />
      </div>
    </div>
  );
}
