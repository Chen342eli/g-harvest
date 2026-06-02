import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Building2,
  Calendar,
  ChevronRight,
  Flame,
  ImageIcon,
  MapPin,
  Pencil,
  Radar,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/TopNav";
import { listConferences } from "@/lib/conferences.functions";
import { getActivePlan } from "@/lib/planning.functions";
import { getPlanLifecycle, isCommitted } from "@/lib/planning";
import { usePeopleData } from "@/lib/people-store";
import { derivePerson } from "@/lib/matching";
import { TierBadge } from "@/components/conference-radar/TierBadge";
import { updateSettings } from "@/lib/settings-store";
import { cn } from "@/lib/utils";
import type { Conference } from "@/lib/conferences";
// Logo for the currently featured event. Swap this import when the next-up event changes.
import eventLogo from "@/assets/event-logo.png.asset.json";

const EVENT_LOGO_URL: string | null = eventLogo.url;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Grain Harvest" },
      { name: "description", content: "Next conference, hot deals, and follow-ups at a glance." },
    ],
  }),
  component: Dashboard,
});

const TIER_DOT: Record<string, string> = {
  S: "bg-temp-hot",
  A: "bg-brand-accent",
  B: "bg-brand-base",
  C: "bg-muted-foreground",
};

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

  const planItemConfIds = useMemo(
    () =>
      new Set(
        (activePlan?.items ?? [])
          .filter((i) => isCommitted(i.planStatus))
          .map((i) => i.conferenceId),
      ),
    [activePlan],
  );
  const lifecycle = getPlanLifecycle(activePlan);
  const planApproved = lifecycle === "approved";

  const upcoming = useMemo(() => {
    const now = Date.now();
    const base = conferences.filter((c) => new Date(c.endDate).getTime() >= now);
    const scoped = planApproved
      ? base.filter((c) => planItemConfIds.has(c.id))
      : base;
    return scoped
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 6);
  }, [conferences, planApproved, planItemConfIds]);

  const next = upcoming[0];
  const rest = upcoming.slice(1);

  const derivedPeople = useMemo(
    () =>
      peopleData.people.map((p) => {
        const d = derivePerson(p, peopleData.encounters);
        const last = d.encounters[d.encounters.length - 1];
        return { person: p, derived: d, last };
      }),
    [peopleData],
  );

  const hotLeads = useMemo(
    () =>
      derivedPeople
        .filter((x) => x.last?.temperature === "hot")
        .sort((a, b) => (b.last?.timestamp ?? "").localeCompare(a.last?.timestamp ?? ""))
        .slice(0, 6),
    [derivedPeople],
  );

  const chaseNow = useMemo(
    () =>
      derivedPeople
        .filter(
          (x) =>
            x.person.aiSignal === "Warming" &&
            (x.person.followUpStatus ?? "pending") !== "done",
        )
        .sort((a, b) => (b.last?.timestamp ?? "").localeCompare(a.last?.timestamp ?? "")),
    [derivedPeople],
  );

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto max-w-[1400px] space-y-8 px-6 py-6">
        {/* Planning CTA / active-plan banner */}
        {lifecycle === "none" && (
          <section className="rounded-xl border border-brand-accent/40 bg-brand-accent/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-accent text-brand-accent-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">No annual plan yet</h2>
                  <p className="text-xs text-muted-foreground">
                    Start by picking anchors and let the system suggest coverage.
                  </p>
                </div>
              </div>
              <Link
                to="/planning/build"
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-base px-4 py-2 text-sm font-medium text-brand-base-foreground hover:opacity-90"
              >
                Start planning <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}


        {lifecycle === "approved" && activePlan && (
          <section className="flex justify-center">
            <div className="inline-flex flex-wrap items-center gap-3 rounded-lg border border-emerald-400/60 bg-emerald-50 px-4 py-2 dark:bg-emerald-950/30">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {activePlan.plan.name}
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Approved
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {activePlan.items.filter((i) => isCommitted(i.planStatus)).length} approved conference
                    {activePlan.items.filter((i) => isCommitted(i.planStatus)).length === 1 ? "" : "s"} for {activePlan.plan.year}.
                  </p>
                </div>
              </div>
              <Button asChild size="sm">
                <Link to="/planning/build">
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit plan
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* Hero — Next up: only when plan is approved */}
        {planApproved ? (
          <>
            <NextUpHero conference={next} inPlan={next ? planItemConfIds.has(next.id) : false} />

            <section className="space-y-4">
              <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
                    What's coming
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {upcoming.length} upcoming
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to="/agent"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:border-brand-accent/60 hover:text-brand-accent"
                  >
                    <Radar className="h-3.5 w-3.5" /> Discovery agent
                  </Link>
                  <Link
                    to="/planning"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Full catalog →
                  </Link>
                </div>
              </header>
              <Timeline conferences={upcoming} inPlanIds={planItemConfIds} />
              {rest.length === 0 && upcoming.length <= 1 && (
                <p className="text-center text-xs text-muted-foreground">
                  No additional conferences scheduled.
                </p>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">
              {lifecycle === "draft" ? "Approve the plan to see your next event" : "No approved plan yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upcoming events and the "In plan" view appear here once a plan is approved.
            </p>
            <Link
              to="/planning/build"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-base px-4 py-2 text-sm font-medium text-brand-base-foreground hover:opacity-90"
            >
              {lifecycle === "draft" ? "Resume planning" : "Start planning"} <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        {/* Hot deals + Follow-ups */}
        <div className="grid gap-6 lg:grid-cols-2">
          <HotDealsCard hotLeads={hotLeads} />
          <FollowUpsCard chaseNow={chaseNow} />
        </div>
      </main>
    </div>
  );
}

/* ─────────── Hero ─────────── */

function NextUpHero({
  conference,
  inPlan,
}: {
  conference: Conference | undefined;
  inPlan: boolean;
}) {
  if (!conference) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-semibold text-foreground">Nothing on the horizon</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run the discovery agent to surface new conferences.
        </p>
        <Link
          to="/agent"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-base px-4 py-2 text-sm font-medium text-brand-base-foreground hover:opacity-90"
        >
          <Radar className="h-4 w-4" /> Open discovery agent
        </Link>
      </section>
    );
  }

  const setActive = () => {
    updateSettings({
      activeConferenceId: conference.id,
      activeConferenceName: conference.name,
    });
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-brand-base/30 bg-gradient-to-br from-brand-base/10 via-brand-accent/5 to-transparent p-6 sm:p-8",
      )}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-brand-base/10 blur-3xl" />

      <div className="relative grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
        {/* Event logo — replace EVENT_LOGO_URL below when the next-up event changes */}
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background/80 shadow-sm sm:h-28 sm:w-28">
          {EVENT_LOGO_URL ? (
            <img
              src={EVENT_LOGO_URL}
              alt={`${conference.name} logo`}
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                Next up
              </span>
              <TierBadge tier={conference.tier} />
              {inPlan && (
                <span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-accent">
                  In plan
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {daysUntil(conference.startDate)}
              </span>
            </div>
            <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              {conference.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateRange(conference.startDate, conference.endDate)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {conference.city}, {conference.country}
              </span>
            </div>
          </div>

          {/* Who's going */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Who's going
            </span>
            {conference.assignedReps.length === 0 ? (
              <span className="text-xs italic text-muted-foreground">
                Nobody assigned yet
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {conference.assignedReps.map((rep) => (
                  <RepAvatarChip key={rep} name={rep} />
                ))}
              </div>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              to="/floor"
              onClick={setActive}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-base px-4 py-2 text-sm font-semibold text-brand-base-foreground shadow-sm transition hover:opacity-90"
            >
              Open in Event Mode <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/planning"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-background"
            >
              View in planner
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function RepAvatarChip({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      title={name}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 py-0.5 pl-0.5 pr-2 text-xs text-foreground shadow-sm"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-base text-[10px] font-bold text-brand-base-foreground">
        {initials || "?"}
      </span>
      {name}
    </span>
  );
}

/* ─────────── Timeline ─────────── */

function Timeline({
  conferences,
  inPlanIds,
}: {
  conferences: Conference[];
  inPlanIds: Set<string>;
}) {
  if (conferences.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
        No upcoming conferences.
      </div>
    );
  }

  // group by month label for axis ticks
  const months: { key: string; label: string; idx: number }[] = [];
  conferences.forEach((c, idx) => {
    const d = new Date(c.startDate);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!months.find((m) => m.key === key)) {
      months.push({
        key,
        label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        idx,
      });
    }
  });

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-6">
      <div className="relative min-w-[640px]">
        {/* month markers */}
        <div
          className="mb-3 grid text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          style={{ gridTemplateColumns: `repeat(${conferences.length}, minmax(0, 1fr))` }}
        >
          {conferences.map((_, i) => {
            const marker = months.find((m) => m.idx === i);
            return (
              <div key={i} className="text-center">
                {marker?.label ?? ""}
              </div>
            );
          })}
        </div>

        {/* baseline */}
        <div className="relative h-0.5 w-full bg-gradient-to-r from-border via-brand-accent/40 to-border" />

        {/* nodes */}
        <div
          className="grid pt-3"
          style={{ gridTemplateColumns: `repeat(${conferences.length}, minmax(0, 1fr))` }}
        >
          {conferences.map((c) => {
            const dotClass = TIER_DOT[c.tier] ?? "bg-muted-foreground";
            const inPlan = inPlanIds.has(c.id);
            return (
              <Link
                key={c.id}
                to="/planning"
                className="group relative -mt-[22px] flex flex-col items-center gap-2 px-2 text-center"
              >
                <span
                  className={cn(
                    "block h-3.5 w-3.5 rounded-full ring-4 ring-card transition group-hover:scale-125",
                    dotClass,
                  )}
                />
                <div className="space-y-0.5">
                  <div className="line-clamp-2 max-w-[140px] text-xs font-semibold text-foreground group-hover:text-brand-accent">
                    {c.name}
                  </div>
                  <div className="text-[10px] tabular-nums text-muted-foreground">
                    {shortDateRange(c.startDate, c.endDate)}
                  </div>
                  {inPlan && (
                    <span className="inline-block rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-accent">
                      In plan
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Hot deals ─────────── */

type HotLead = {
  person: ReturnType<typeof usePeopleData>["people"][number];
  derived: ReturnType<typeof derivePerson>;
  last: ReturnType<typeof derivePerson>["encounters"][number] | undefined;
};

function HotDealsCard({ hotLeads }: { hotLeads: HotLead[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-temp-hot" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            Hot deals
          </h2>
          <span className="rounded-full bg-temp-hot/15 px-2 py-0.5 text-[10px] font-bold text-temp-hot">
            {hotLeads.length}
          </span>
        </div>
        <Link
          to="/people"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          All people <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {hotLeads.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No hot leads yet.
        </div>
      ) : (
        <ul className="grid gap-2 p-3 sm:grid-cols-2">
          {hotLeads.map(({ person, last }) => (
            <li
              key={person.id}
              className="group rounded-xl border border-border bg-background/60 p-3 transition hover:border-temp-hot/50 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate text-sm font-semibold text-foreground">
                      {person.currentCompany ?? "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {person.fullName}
                    {person.currentRole ? ` · ${person.currentRole}` : ""}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-temp-hot px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-temp-hot-foreground">
                  🔥 hot
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                {person.aiSignal ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-accent">
                    <Sparkles className="h-3 w-3" /> {person.aiSignal}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}
                {last && (
                  <span className="truncate text-[10px] text-muted-foreground">
                    {last.conferenceName}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─────────── Follow-ups ─────────── */

function FollowUpsCard({ chaseNow }: { chaseNow: HotLead[] }) {
  const top = chaseNow.slice(0, 3);
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-brand-accent" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            Follow-ups
          </h2>
        </div>
        <Link
          to="/follow-ups"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Manage all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {top.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-background/40 px-4 py-6 text-center text-xs text-muted-foreground">
            Inbox zero. Nothing to chase right now.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {top.map(({ person }) => (
              <li
                key={person.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {person.fullName}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {[person.currentRole, person.currentCompany].filter(Boolean).join(" @ ") || "—"}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-accent">
                  Warming
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ─────────── Helpers ─────────── */

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const yr = s.getFullYear() !== new Date().getFullYear() ? `, ${s.getFullYear()}` : "";
  if (s.toDateString() === e.toDateString()) return `${fmt(s)}${yr}`;
  return `${fmt(s)} – ${fmt(e)}${yr}`;
}

function shortDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (s.toDateString() === e.toDateString()) return fmt(s);
  if (s.getMonth() === e.getMonth())
    return `${s.toLocaleDateString(undefined, { month: "short" })} ${s.getDate()}–${e.getDate()}`;
  return `${fmt(s)} – ${fmt(e)}`;
}

function daysUntil(start: string): string {
  const diff = Math.ceil((new Date(start).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Happening now";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return `In ${diff} days`;
  if (diff < 30) return `In ${Math.round(diff / 7)} weeks`;
  return `In ${Math.round(diff / 30)} months`;
}
