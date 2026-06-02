import { useMemo, useState } from "react";
import { Calendar, MapPin, Plus, Trash2, User } from "lucide-react";
import {
  useSchedule,
  addScheduleItem,
  removeScheduleItem,
  genScheduleId,
  type ScheduleItem,
  type ScheduleKind,
} from "@/lib/schedule-store";
import { SALES_TEAM } from "@/lib/conferences";
import { cn } from "@/lib/utils";

interface Props {
  conferenceId: string;
  conferenceStartDate: string;
  conferenceEndDate: string;
}

const KIND_LABEL: Record<ScheduleKind, string> = {
  booth: "Booth",
  session: "Session",
  meeting: "1:1",
};

const KIND_COLOR: Record<ScheduleKind, string> = {
  booth: "bg-brand-base/10 text-brand-base border-brand-base/30",
  session: "bg-brand-accent/15 text-brand-accent-foreground border-brand-accent/40",
  meeting: "bg-signal-buying/15 text-signal-buying border-signal-buying/40",
};

export function SchedulePanel({ conferenceId, conferenceStartDate, conferenceEndDate }: Props) {
  const items = useSchedule();
  const [adding, setAdding] = useState(false);

  const days = useMemo(() => {
    const out: string[] = [];
    const s = new Date(conferenceStartDate);
    const e = new Date(conferenceEndDate);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [conferenceStartDate, conferenceEndDate]);

  const myItems = useMemo(
    () =>
      items
        .filter((i) => i.conferenceId === conferenceId)
        .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)),
    [items, conferenceId],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, ScheduleItem[]>();
    for (const d of days) m.set(d, []);
    for (const it of myItems) {
      if (!m.has(it.date)) m.set(it.date, []);
      m.get(it.date)!.push(it);
    }
    return m;
  }, [myItems, days]);

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Schedule — who's where</h2>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </header>

      {adding && (
        <AddRow
          days={days}
          onCancel={() => setAdding(false)}
          onSave={(item) => {
            addScheduleItem({ ...item, conferenceId });
            setAdding(false);
          }}
        />
      )}

      {myItems.length === 0 && !adding ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No schedule yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add booth shifts, sessions, or 1:1s so the team knows who's where.
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-base px-3 py-1.5 text-xs font-medium text-brand-base-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add first item
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            return (
              <div key={d} className="px-4 py-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {new Date(d).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {list.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
                            {it.startTime}
                            {it.endTime ? `–${it.endTime}` : ""}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              KIND_COLOR[it.kind],
                            )}
                          >
                            {KIND_LABEL[it.kind]}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">
                              {it.kind === "meeting" && it.personName ? (
                                <span className="inline-flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  {it.personName}
                                </span>
                              ) : (
                                it.title
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {it.repId ?? "Unassigned"}
                              {it.location ? (
                                <>
                                  {" · "}
                                  <MapPin className="inline h-3 w-3" /> {it.location}
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeScheduleItem(it.id)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AddRow({
  days,
  onSave,
  onCancel,
}: {
  days: string[];
  onSave: (item: ScheduleItem) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<ScheduleKind>("session");
  const [date, setDate] = useState(days[0] ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [repId, setRepId] = useState<string>("");
  const [location, setLocation] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !startTime) return;
    onSave({
      id: genScheduleId(),
      conferenceId: "",
      kind,
      date,
      startTime,
      endTime: endTime || undefined,
      title: title.trim(),
      repId: repId || undefined,
      location: location.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-2 border-b border-border bg-muted/30 p-3 text-xs sm:grid-cols-[110px_120px_90px_90px_1fr_140px_140px_auto]"
    >
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as ScheduleKind)}
        className="rounded-md border border-input bg-background px-2 py-1.5"
      >
        <option value="session">Session</option>
        <option value="booth">Booth shift</option>
        <option value="meeting">1:1 meeting</option>
      </select>
      <select
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5"
      >
        {days.map((d) => (
          <option key={d} value={d}>
            {new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </option>
        ))}
      </select>
      <input
        type="time"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5"
      />
      <input
        type="time"
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
        placeholder="end"
        className="rounded-md border border-input bg-background px-2 py-1.5"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === "meeting" ? "Person name" : "Title"}
        className="rounded-md border border-input bg-background px-2 py-1.5"
        autoFocus
      />
      <select
        value={repId}
        onChange={(e) => setRepId(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5"
      >
        <option value="">— Rep —</option>
        {SALES_TEAM.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (optional)"
        className="rounded-md border border-input bg-background px-2 py-1.5"
      />
      <div className="flex gap-1">
        <button
          type="submit"
          className="rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
