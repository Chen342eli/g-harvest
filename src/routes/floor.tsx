import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, ChevronDown } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { listConferences } from "@/lib/conferences.functions";
import { useSettings, updateSettings } from "@/lib/settings-store";
import { SALES_TEAM } from "@/lib/conferences";
import { GameTimeOverlay } from "@/components/floor/GameTimeOverlay";
import { BeforePhase } from "@/components/floor/BeforePhase";
import { DuringPhase } from "@/components/floor/DuringPhase";
import { AfterPhase } from "@/components/floor/AfterPhase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/floor")({
  head: () => ({ meta: [{ title: "Floor · Grain Harvest" }] }),
  component: FloorPage,
});

type Phase = "before" | "during" | "after";

function inferPhase(startDate: string, endDate: string): Phase {
  const now = Date.now();
  const s = new Date(startDate).getTime();
  const e = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1; // include end day
  if (now < s) return "before";
  if (now > e) return "after";
  return "during";
}

function FloorPage() {
  const fetchConfs = useServerFn(listConferences);
  const { data: conferences = [] } = useQuery({
    queryKey: ["conferences"],
    queryFn: () => fetchConfs(),
  });
  const settings = useSettings();
  const [gameTime, setGameTime] = useState(false);
  const [phaseOverride, setPhaseOverride] = useState<Phase | null>(null);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...conferences]
      .filter((c) => new Date(c.endDate).getTime() >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [conferences]);

  const effectiveActiveId =
    settings.activeConferenceId || upcoming[0]?.id || conferences[0]?.id;
  const activeConf = conferences.find((c) => c.id === effectiveActiveId);

  useEffect(() => {
    if (!settings.activeConferenceId && activeConf) {
      updateSettings({
        activeConferenceId: activeConf.id,
        activeConferenceName: activeConf.name,
      });
    }
    if (!settings.activeRepId && SALES_TEAM.length) {
      updateSettings({ activeRepId: SALES_TEAM[0] });
    }
  }, [settings.activeConferenceId, settings.activeRepId, activeConf]);

  // Reset override when conference changes
  useEffect(() => {
    setPhaseOverride(null);
  }, [effectiveActiveId]);

  const autoPhase: Phase = activeConf
    ? inferPhase(activeConf.startDate, activeConf.endDate)
    : "before";
  const phase: Phase = phaseOverride ?? autoPhase;

  const canEnterGameTime = !!activeConf && !!settings.activeRepId;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

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
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            You
          </span>
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
              {new Date(activeConf.startDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
              {" – "}
              {new Date(activeConf.endDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>

        {/* Phase tabs */}
        {activeConf && (
          <div className="mx-auto max-w-[1600px] px-6 pb-3">
            <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
              {(["before", "during", "after"] as const).map((p) => {
                const active = p === phase;
                const isAuto = p === autoPhase;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPhaseOverride(p === autoPhase ? null : p)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                      active
                        ? "bg-background text-foreground shadow"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                    {isAuto && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[8px] font-medium normal-case tracking-normal",
                          active
                            ? "bg-temp-hot/15 text-temp-hot"
                            : "bg-muted text-muted-foreground/70",
                        )}
                      >
                        now
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <span className="ml-3 text-[11px] text-muted-foreground">
              {phase === "before" && "Plan meetings & line up Hot Accounts."}
              {phase === "during" && "Capture leads as you meet them."}
              {phase === "after" && "Clean up data & route to Follow-ups."}
            </span>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
        {!activeConf ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <CalendarCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No conference selected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick one above to run the event end-to-end.
            </p>
          </div>
        ) : phase === "before" ? (
          <BeforePhase
            conferenceId={activeConf.id}
            conferenceStartDate={activeConf.startDate}
            conferenceEndDate={activeConf.endDate}
          />
        ) : phase === "during" ? (
          <DuringPhase
            conferenceId={activeConf.id}
            canEnterGameTime={canEnterGameTime}
            onEnterGameTime={() => setGameTime(true)}
          />
        ) : (
          <AfterPhase conferenceId={activeConf.id} />
        )}
      </main>

      {gameTime && <GameTimeOverlay onExit={() => setGameTime(false)} />}
    </div>
  );
}
