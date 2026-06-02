import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Calendar,
  Flame,
  MapPin,
  Radar,
  Sparkles,
  Users,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { listConferences } from "@/lib/conferences.functions";
import { getActivePlan } from "@/lib/planning.functions";
import { usePeopleData } from "@/lib/people-store";
import { derivePerson } from "@/lib/matching";
import { TierBadge } from "@/components/conference-radar/TierBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Grain Conference Radar" },
      { name: "description", content: "Upcoming conferences, planning status, and hot leads at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchAll = useServerFn(listConferences);
  const fetchActivePlan = useServerFn(getActivePlan);

  const { data: conferences = [] } = useQuery({
    queryKey: ["conferences"],
    queryFn: () => fetchAll(),
  });
  const { data: activePlan } = useQuery({
    queryKey: ["activePlan"],
    queryFn: () => fetchActivePlan(),
  });
  const peopleData = usePeopleData();

  const upcoming = useMemo(() => {
    const now = Date.now();
    return conferences
      .filter((c) => new Date(c.endDate).getTime() >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 6);
  }, [conferences]);

  const planItemConfIds = useMemo(
    () => new Set((activePlan?.items ?? []).map((i) => i.conferenceId)),
    [activePlan],
  );
  const planningNeeded = !activePlan || (activePlan.items?.length ?? 0) === 0;

  const hotLeads = useMemo(() => {
    return peopleData.people
      .map((p) => {
        const d = derivePerson(p, peopleData.encounters);
        const last = d.encounters[d.encounters.length - 1];
        return { person: p, derived: d, last };
      })
      .filter((x) => x.last?.temperature === "hot")
      .sort((a, b) => (b.last?.timestamp ?? "").localeCompare(a.last?.timestamp ?? ""))
      .slice(0, 6);
  }, [peopleData]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Radar className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">Grain Conference Radar</h1>
              <p className="text-xs text-muted-foreground">Your week, your plan, your hottest leads.</p>
            </div>
          </div>
          <TopNav />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        {/* Planning CTA */}
        {planningNeeded ? (
          <section className="rounded-xl border border-brand-accent/40 bg-brand-accent/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-accent text-brand-accent-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Planning not started yet</h2>
                  <p className="text-xs text-muted-foreground">
                    Pick must-go conferences, set a budget, and let the system suggest coverage.
                  </p>
                </div>
              </div>
              <Link
                to="/planning"
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-base px-4 py-2 text-sm font-medium text-brand-base-foreground hover:opacity-90"
              >
                Start planning <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Active plan</div>
                <div className="text-sm font-semibold text-foreground">
                  {activePlan!.plan.name} · {activePlan!.items.length} conferences
                </div>
              </div>
              <Link
                to="/planning"
                className="text-xs font-medium text-brand-accent hover:underline inline-flex items-center gap-1"
              >
                Open planning workspace <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          {/* Upcoming conferences */}
          <section className="rounded-xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Upcoming conferences</h2>
              </div>
              <Link to="/catalog" className="text-xs text-muted-foreground hover:text-foreground">
                Full catalog →
              </Link>
            </header>
            <ul className="divide-y divide-border">
              {upcoming.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">No upcoming conferences.</li>
              )}
              {upcoming.map((c) => {
                const inPlan = planItemConfIds.has(c.id);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                        <TierBadge tier={c.tier} />
                        {inPlan && (
                          <span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-[10px] font-medium text-brand-accent">
                            In plan
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateRange(c.startDate, c.endDate)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {c.city}, {c.country}
                        </span>
                      </div>
                    </div>
                    <Link
                      to="/catalog"
                      className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      View
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Hot leads */}
          <section className="rounded-xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-temp-hot" />
                <h2 className="text-sm font-semibold text-foreground">Hot leads</h2>
              </div>
              <Link to="/people" className="text-xs text-muted-foreground hover:text-foreground">
                All people →
              </Link>
            </header>
            <ul className="divide-y divide-border">
              {hotLeads.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hot leads yet.{" "}
                  <Link to="/capture" className="text-brand-accent hover:underline">
                    Capture one
                  </Link>
                  .
                </li>
              )}
              {hotLeads.map(({ person, derived, last }) => (
                <li key={person.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-foreground">
                        {person.currentCompany ?? "—"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {person.fullName}
                        {person.currentRole ? ` · ${person.currentRole}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-temp-hot px-2 py-0.5 text-[10px] font-medium text-temp-hot-foreground">
                      🔥 hot
                    </span>
                  </div>
                  {last && (
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      {last.conferenceName} · {derived.encounterCount} encounter
                      {derived.encounterCount === 1 ? "" : "s"}
                    </div>
                  )}
                </li>

              ))}
            </ul>
          </section>
        </div>

        {/* Quick links */}
        <section className="grid gap-3 sm:grid-cols-3">
          <QuickLink
            to="/capture"
            icon={<Users className="h-4 w-4" />}
            title="Capture a lead"
            desc="Log a conversation in 15 seconds."
          />
          <QuickLink
            to="/recap"
            icon={<Sparkles className="h-4 w-4" />}
            title="End-of-day recap"
            desc="Review today's signals and send."
          />
          <QuickLink
            to="/agent"
            icon={<Radar className="h-4 w-4" />}
            title="Discovery agent"
            desc="Find new conferences to evaluate."
          />
        </section>
      </main>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition hover:border-brand-accent/60 hover:bg-muted/40",
      )}
    >
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-brand-accent">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Link>
  );
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const yr = s.getFullYear() !== new Date().getFullYear() ? `, ${s.getFullYear()}` : "";
  if (s.toDateString() === e.toDateString()) return `${fmt(s)}${yr}`;
  return `${fmt(s)} – ${fmt(e)}${yr}`;
}
