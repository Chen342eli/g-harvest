import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Flame, Inbox, ThermometerSun } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { usePeopleData } from "@/lib/people-store";
import { derivePerson } from "@/lib/matching";
import { cn } from "@/lib/utils";
import type { Temperature } from "@/lib/people-types";

export const Route = createFileRoute("/follow-ups")({
  head: () => ({ meta: [{ title: "Follow-ups · Leads" }] }),
  component: FollowUpsPage,
});

function FollowUpsPage() {
  const data = usePeopleData();

  const rows = useMemo(() => {
    return data.people
      .map((p) => {
        const d = derivePerson(p, data.encounters);
        const last = d.encounters[d.encounters.length - 1];
        return { person: p, derived: d, last };
      })
      .filter((r) => r.last && (r.last.temperature === "hot" || r.last.temperature === "warm"))
      .sort((a, b) => {
        // hot first, then most recent
        const t = tempRank(b.last!.temperature) - tempRank(a.last!.temperature);
        if (t !== 0) return t;
        return (b.last?.timestamp ?? "").localeCompare(a.last?.timestamp ?? "");
      });
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">Follow-ups</h1>
            <p className="text-xs text-muted-foreground">Hot &amp; warm leads waiting for action</p>
          </div>
          <TopNav />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] space-y-4 px-6 py-6">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-sm font-semibold text-foreground">Nothing to follow up on</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Capture hot or warm leads and they will queue up here.
            </p>
            <Link
              to="/capture"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-base px-4 py-2 text-sm font-medium text-brand-base-foreground hover:opacity-90"
            >
              Capture a lead
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map(({ person, derived, last }) => (
              <li key={person.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold text-foreground">
                      {person.currentCompany ?? "—"}
                    </span>
                    <TempPill t={last!.temperature} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {person.fullName}
                    {person.currentRole ? ` · ${person.currentRole}` : ""}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Last seen at {last!.conferenceName} · by {last!.repId} ·{" "}
                    {new Date(last!.timestamp).toLocaleDateString()} ·{" "}
                    {derived.encounterCount} encounter{derived.encounterCount === 1 ? "" : "s"}
                    {last!.note ? ` · "${last!.note}"` : ""}
                  </div>
                </div>
                <Link
                  to="/people"
                  className="shrink-0 text-xs font-medium text-brand-accent hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function tempRank(t: Temperature): number {
  return t === "hot" ? 2 : t === "warm" ? 1 : 0;
}

function TempPill({ t }: { t: Temperature }) {
  const cls =
    t === "hot"
      ? "bg-temp-hot text-temp-hot-foreground"
      : t === "warm"
      ? "bg-amber-500 text-white"
      : "bg-sky-500 text-white";
  const Icon = t === "hot" ? Flame : ThermometerSun;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}>
      <Icon className="h-3 w-3" />
      {t}
    </span>
  );
}
