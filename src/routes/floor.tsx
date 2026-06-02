import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarCheck,
  ChevronDown,
  FileDown,
  Mail,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { listConferences } from "@/lib/conferences.functions";
import { useSettings, updateSettings } from "@/lib/settings-store";
import { SALES_TEAM } from "@/lib/conferences";
import { HotLeadsSidebar } from "@/components/floor/HotLeadsSidebar";
import { SchedulePanel } from "@/components/floor/SchedulePanel";
import { GameTimeOverlay } from "@/components/floor/GameTimeOverlay";

export const Route = createFileRoute("/floor")({
  head: () => ({ meta: [{ title: "Floor · Grain Harvest" }] }),
  component: FloorPage,
});

function FloorPage() {
  const fetchConfs = useServerFn(listConferences);
  const { data: conferences = [] } = useQuery({ queryKey: ["conferences"], queryFn: () => fetchConfs() });
  const settings = useSettings();
  const [gameTime, setGameTime] = useState(false);

  // Default: pick the next upcoming conference if none selected
  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...conferences]
      .filter((c) => new Date(c.endDate).getTime() >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [conferences]);

  const effectiveActiveId =
    settings.activeConferenceId ||
    upcoming[0]?.id ||
    conferences[0]?.id;

  const activeConf = conferences.find((c) => c.id === effectiveActiveId);

  // Auto-persist default selection once data loads
  if (
    !settings.activeConferenceId &&
    activeConf &&
    typeof window !== "undefined"
  ) {
    updateSettings({
      activeConferenceId: activeConf.id,
      activeConferenceName: activeConf.name,
    });
  }

  if (!settings.activeRepId && SALES_TEAM.length && typeof window !== "undefined") {
    updateSettings({ activeRepId: SALES_TEAM[0] });
  }

  const canEnterGameTime = !!activeConf && !!settings.activeRepId;

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        rightSlot={
          <button
            type="button"
            disabled={!canEnterGameTime}
            onClick={() => setGameTime(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-temp-hot px-4 py-1.5 text-xs font-semibold text-temp-hot-foreground transition hover:opacity-90 disabled:opacity-40"
            title={canEnterGameTime ? "Enter Game Time" : "Pick conference + rep first"}
          >
            <Zap className="h-3.5 w-3.5" /> Game Time
          </button>
        }
      />

      {/* Conference selector bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-6 py-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5" />
            Active conference
          </span>
          <div className="relative">
            <select
              value={effectiveActiveId ?? ""}
              onChange={(e) => {
                const c = conferences.find((x) => x.id === e.target.value);
                updateSettings({
                  activeConferenceId: c?.id,
                  activeConferenceName: c?.name,
                });
              }}
              className="appearance-none rounded-md border border-border bg-background py-1.5 pl-3 pr-8 text-sm font-semibold text-foreground"
            >
              <option value="">— Select —</option>
              {conferences.map((c) => {
                const now = Date.now();
                const s = new Date(c.startDate).getTime();
                const e = new Date(c.endDate).getTime();
                const tag = s <= now && e >= now ? "🟢 live" : s > now ? "upcoming" : "past";
                return (
                  <option key={c.id} value={c.id}>
                    📍 {c.name} · {tag}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <span className="text-muted-foreground">·</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You</span>
          <select
            value={settings.activeRepId ?? ""}
            onChange={(e) => updateSettings({ activeRepId: e.target.value || undefined })}
            className="rounded-md border border-border bg-background py-1.5 px-2 text-sm font-medium text-foreground"
          >
            <option value="">—</option>
            {SALES_TEAM.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {activeConf && (
            <span className="text-xs text-muted-foreground">
              {activeConf.city}, {activeConf.country} ·{" "}
              {new Date(activeConf.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {" – "}
              {new Date(activeConf.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
        {!activeConf ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <CalendarCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No conference selected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick one above to see the schedule and enter Game Time.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <SchedulePanel
              conferenceId={activeConf.id}
              conferenceStartDate={activeConf.startDate}
              conferenceEndDate={activeConf.endDate}
            />
            <HotLeadsSidebar />
          </div>
        )}

        {/* Secondary desk tools */}
        <section>
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Desk tools
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DeskTool
              to="/import"
              icon={<Upload className="h-4 w-4" />}
              title="Import CSV"
              desc="Bulk-load scanner exports."
            />
            <DeskTool
              to="/capture"
              icon={<Sparkles className="h-4 w-4" />}
              title="Detailed capture"
              desc="Full form with all fields."
            />
            <DeskTool
              to="/recap"
              icon={<FileDown className="h-4 w-4" />}
              title="End-of-day recap"
              desc="Review today's signals."
            />
            <DeskTool
              to="/follow-ups"
              icon={<Mail className="h-4 w-4" />}
              title="Follow-up emails"
              desc="Draft and send next steps."
            />
          </div>
        </section>
      </main>

      {gameTime && <GameTimeOverlay onExit={() => setGameTime(false)} />}
    </div>
  );
}

function DeskTool({
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
      className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition hover:border-brand-accent/60 hover:bg-muted/40"
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
