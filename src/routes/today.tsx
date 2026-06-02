import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Flame, Snowflake, ThermometerSun, UserPlus, Users } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { ActiveConferenceBar } from "@/components/conference-mode/ActiveConferenceBar";
import { listConferences } from "@/lib/conferences.functions";
import { useSettings } from "@/lib/settings-store";
import { usePeopleData } from "@/lib/people-store";
import { cn } from "@/lib/utils";
import type { Temperature } from "@/lib/people-types";

export const Route = createFileRoute("/today")({
  head: () => ({ meta: [{ title: "Today · Conference Mode" }] }),
  component: TodayPage,
});

function TodayPage() {
  const fetchConfs = useServerFn(listConferences);
  const { data: conferences = [] } = useQuery({ queryKey: ["conferences"], queryFn: () => fetchConfs() });
  const settings = useSettings();
  const data = usePeopleData();

  const activeConf = conferences.find((c) => c.id === settings.activeConferenceId);

  const confEncs = useMemo(
    () => data.encounters.filter((e) => e.conferenceId === settings.activeConferenceId),
    [data.encounters, settings.activeConferenceId],
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEncs = useMemo(
    () => confEncs.filter((e) => e.timestamp.slice(0, 10) === todayKey),
    [confEncs, todayKey],
  );

  const byTemp = countBy(todayEncs, (e) => e.temperature) as Record<Temperature, number>;
  const byRep = countBy(todayEncs, (e) => e.repId);
  const byHour = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of todayEncs) {
      const h = new Date(e.timestamp).getHours();
      map.set(h, (map.get(h) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [todayEncs]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <ActiveConferenceBar />

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        {!activeConf ? (
          <EmptyState />
        ) : (
          <>
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    <CalendarCheck className="mr-1 inline h-3 w-3" /> Live
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{activeConf.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {activeConf.city}, {activeConf.country}
                  </p>
                </div>
                <Link
                  to="/capture"
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-base px-4 py-2 text-sm font-medium text-brand-base-foreground hover:opacity-90"
                >
                  <UserPlus className="h-4 w-4" /> Capture lead
                </Link>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-4">
              <Kpi label="Today" value={todayEncs.length} icon={<Users className="h-4 w-4" />} />
              <Kpi
                label="Hot"
                value={byTemp.hot ?? 0}
                icon={<Flame className="h-4 w-4" />}
                accent="bg-temp-hot/10 text-temp-hot"
              />
              <Kpi
                label="Warm"
                value={byTemp.warm ?? 0}
                icon={<ThermometerSun className="h-4 w-4" />}
                accent="bg-amber-500/10 text-amber-600"
              />
              <Kpi
                label="Cold"
                value={byTemp.cold ?? 0}
                icon={<Snowflake className="h-4 w-4" />}
                accent="bg-sky-500/10 text-sky-600"
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-border bg-card">
                <header className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                  Leads per rep (today)
                </header>
                <ul className="divide-y divide-border">
                  {Object.keys(byRep).length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No leads captured yet today.
                    </li>
                  )}
                  {Object.entries(byRep)
                    .sort((a, b) => b[1] - a[1])
                    .map(([rep, n]) => (
                      <li key={rep} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="font-medium text-foreground">{rep}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {n}
                        </span>
                      </li>
                    ))}
                </ul>
              </section>

              <section className="rounded-xl border border-border bg-card">
                <header className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                  Pace (per hour, today)
                </header>
                <div className="p-4">
                  {byHour.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">No activity yet.</p>
                  ) : (
                    <HourBars data={byHour} />
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-xl border border-border bg-card">
              <header className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                Recent captures
              </header>
              <ul className="divide-y divide-border">
                {todayEncs.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">No captures today.</li>
                )}
                {[...todayEncs]
                  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                  .slice(0, 10)
                  .map((e) => {
                    const p = data.people.find((x) => x.id === e.personId);
                    return (
                      <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {p?.currentCompany ?? p?.fullName ?? "—"}
                            {p?.currentCompany && p?.fullName ? (
                              <span className="font-normal text-muted-foreground"> · {p.fullName}</span>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                            {e.repId}
                            {e.note ? ` · ${e.note}` : ""}
                          </div>
                        </div>
                        <TempPill t={e.temperature} />
                      </li>
                    );
                  })}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <CalendarCheck className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 text-sm font-semibold text-foreground">No active conference</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick one in the bar above to see live KPIs, per-rep pace, and recent captures.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md", accent ?? "bg-muted text-foreground")}>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function TempPill({ t }: { t: Temperature }) {
  const cls =
    t === "hot"
      ? "bg-temp-hot text-temp-hot-foreground"
      : t === "warm"
      ? "bg-amber-500 text-white"
      : "bg-sky-500 text-white";
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}>{t}</span>;
}

function HourBars({ data }: { data: [number, number][] }) {
  const max = Math.max(...data.map(([, n]) => n));
  return (
    <div className="flex h-32 items-end gap-1.5">
      {data.map(([h, n]) => (
        <div key={h} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-brand-accent"
            style={{ height: `${(n / max) * 100}%`, minHeight: 4 }}
            title={`${n} lead${n === 1 ? "" : "s"} at ${h}:00`}
          />
          <span className="text-[10px] text-muted-foreground">{h}h</span>
        </div>
      ))}
    </div>
  );
}

function countBy<T>(arr: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of arr) {
    const k = key(x);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
