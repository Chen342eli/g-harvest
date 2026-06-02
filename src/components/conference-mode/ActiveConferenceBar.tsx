import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { CalendarCheck, ChevronDown } from "lucide-react";
import { listConferences } from "@/lib/conferences.functions";
import { useSettings, updateSettings } from "@/lib/settings-store";
import { SALES_TEAM } from "@/lib/conferences";

/**
 * Shown at the top of every Conference Mode page.
 * Lets the user pick the "active" conference + their rep identity once.
 * All Conference Mode actions reference these implicitly.
 */
export function ActiveConferenceBar() {
  const fetchConfs = useServerFn(listConferences);
  const { data: conferences = [] } = useQuery({
    queryKey: ["conferences"],
    queryFn: () => fetchConfs(),
  });
  const settings = useSettings();

  // Order: ongoing first, then upcoming, then past
  const ordered = useMemo(() => {
    const now = Date.now();
    const score = (c: { startDate: string; endDate: string }) => {
      const s = new Date(c.startDate).getTime();
      const e = new Date(c.endDate).getTime();
      if (s <= now && e >= now) return 0; // live
      if (s > now) return 1; // upcoming
      return 2; // past
    };
    return [...conferences].sort((a, b) => {
      const d = score(a) - score(b);
      if (d !== 0) return d;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  }, [conferences]);

  const activeId = settings.activeConferenceId ?? "";

  return (
    <div className="border-b border-border bg-muted/30">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-6 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarCheck className="h-3.5 w-3.5" />
          Active conference
        </span>
        <div className="relative">
          <select
            value={activeId}
            onChange={(e) => {
              const c = conferences.find((x) => x.id === e.target.value);
              updateSettings({
                activeConferenceId: c?.id,
                activeConferenceName: c?.name,
              });
            }}
            className="appearance-none rounded-md border border-border bg-background py-1 pl-2 pr-7 text-xs font-medium text-foreground"
          >
            <option value="">— Select a conference —</option>
            {ordered.map((c) => {
              const now = Date.now();
              const s = new Date(c.startDate).getTime();
              const e = new Date(c.endDate).getTime();
              const tag = s <= now && e >= now ? "🟢 live" : s > now ? "upcoming" : "past";
              return (
                <option key={c.id} value={c.id}>
                  {c.name} · {tag}
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>

        <span className="text-muted-foreground">·</span>

        <span className="font-semibold uppercase tracking-wider text-muted-foreground">You</span>
        <select
          value={settings.activeRepId ?? ""}
          onChange={(e) => updateSettings({ activeRepId: e.target.value || undefined })}
          className="rounded-md border border-border bg-background py-1 px-2 text-xs font-medium text-foreground"
        >
          <option value="">—</option>
          {SALES_TEAM.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {!activeId && (
          <span className="text-amber-600">
            Pick a conference to enable capture, today view, and recap.
          </span>
        )}
      </div>
    </div>
  );
}
