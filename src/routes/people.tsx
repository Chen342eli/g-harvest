import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { usePeopleData } from "@/lib/people-store";
import { computeBadges, derivePerson } from "@/lib/matching";
import type { BadgeKey } from "@/lib/matching";
import type { Temperature } from "@/lib/people-types";
import { TempDot } from "@/components/people/TempControls";
import { BadgeList } from "@/components/people/Badges";
import { cn } from "@/lib/utils";
import { SALES_TEAM } from "@/lib/conferences";

export const Route = createFileRoute("/people")({
  head: () => ({ meta: [{ title: "People · Conference Radar" }] }),
  component: PeoplePage,
});

const ALL_BADGES: { key: BadgeKey; label: string }[] = [
  { key: "returning", label: "↩ Returning" },
  { key: "cross-rep", label: "👥 Cross-rep" },
  { key: "decision-maker", label: "👤 Decision-maker" },
  { key: "icp-vertical", label: "🎯 ICP" },
  { key: "moved-to-icp", label: "🏢↗ Moved to ICP" },
];

function PeoplePage() {
  const data = usePeopleData();
  const [search, setSearch] = useState("");
  const [tempFilter, setTempFilter] = useState<Temperature | "all">("all");
  const [badgeFilter, setBadgeFilter] = useState<BadgeKey | "all">("all");
  const [repFilter, setRepFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const enriched = useMemo(() => {
    return data.people
      .map((p) => {
        const derived = derivePerson(p, data.encounters);
        const badges = computeBadges(p, data.encounters);
        const latestTemp = derived.encounters[derived.encounters.length - 1]?.temperature;
        return { person: p, derived, badges, latestTemp };
      })
      .sort((a, b) => (b.derived.lastSeenAt ?? "").localeCompare(a.derived.lastSeenAt ?? ""));
  }, [data]);

  const filtered = enriched.filter(({ person, badges, latestTemp, derived }) => {
    if (search) {
      const q = search.toLowerCase();
      const hay = [person.fullName, ...person.nameVariations, person.currentCompany, person.currentRole]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (tempFilter !== "all" && latestTemp !== tempFilter) return false;
    if (badgeFilter !== "all" && !badges.some((b) => b.key === badgeFilter)) return false;
    if (repFilter !== "all" && !derived.repsMetIds.includes(repFilter)) return false;
    return true;
  });

  const selected = selectedId ? enriched.find((e) => e.person.id === selectedId) ?? null : null;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto grid max-w-[1200px] gap-4 px-6 py-6 lg:grid-cols-[2fr_3fr]">
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-3 space-y-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, role…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2 text-xs">
              <select value={tempFilter} onChange={(e) => setTempFilter(e.target.value as Temperature | "all")} className="rounded-md border border-input bg-background px-2 py-1">
                <option value="all">All temps</option>
                <option value="hot">🔥 Hot</option>
                <option value="warm">🟡 Warm</option>
                <option value="cold">⚪ Cold</option>
              </select>
              <select value={badgeFilter} onChange={(e) => setBadgeFilter(e.target.value as BadgeKey | "all")} className="rounded-md border border-input bg-background px-2 py-1">
                <option value="all">All badges</option>
                {ALL_BADGES.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
              <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
                <option value="all">All reps</option>
                {SALES_TEAM.map((r) => <option key={r} value={r}>{r}</option>)}
                {/* seed uses non-roster names too */}
                {["Yossi", "Dana", "Avi"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <ul className="max-h-[70vh] divide-y divide-border overflow-auto">
            {filtered.length === 0 && <li className="p-4 text-sm text-muted-foreground">No matches.</li>}
            {filtered.map(({ person, badges, latestTemp, derived }) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(person.id)}
                  className={cn(
                    "block w-full px-3 py-3 text-left hover:bg-muted/40",
                    selectedId === person.id && "bg-muted/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{person.fullName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {person.currentRole ?? "—"}{person.currentCompany ? ` @ ${person.currentCompany}` : ""}
                      </div>
                    </div>
                    {latestTemp && <TempDot t={latestTemp} />}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <BadgeList badges={badges} />
                    <span className="shrink-0 text-[10px] text-muted-foreground">×{derived.encounterCount}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card">
          {!selected ? (
            <div className="p-6 text-sm text-muted-foreground">Select a person to see their cross-conference arc.</div>
          ) : (
            <PersonDetail person={selected.person} encounters={selected.derived.encounters} badges={selected.badges} />
          )}
        </section>
      </main>
    </div>
  );
}

function PersonDetail({
  person,
  encounters,
  badges,
}: {
  person: import("@/lib/people-types").Person;
  encounters: import("@/lib/people-types").Encounter[];
  badges: ReturnType<typeof computeBadges>;
}) {
  return (
    <div className="p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{person.fullName}</h2>
        {person.nameVariations.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Also known as: {person.nameVariations.join(", ")}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {person.currentRole ?? "—"}{person.currentCompany ? ` @ ${person.currentCompany}` : ""}
          {person.currentVertical ? ` · ${person.currentVertical}` : ""}
        </p>
        {person.linkedInUrl && (
          <a href={person.linkedInUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-base underline">
            LinkedIn ↗
          </a>
        )}
      </div>

      <BadgeList badges={badges} />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arc</h3>
        <ol className="space-y-2">
          {encounters.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">{e.conferenceName}</div>
                <TempDot t={e.temperature} />
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.timestamp).toLocaleDateString()} · by {e.repId}
              </div>
              <div className="mt-1 text-xs text-foreground">
                {e.roleAtTime ?? "—"}{e.companyAtTime ? ` @ ${e.companyAtTime}` : ""}
                {e.vertical ? ` · ${e.vertical}` : ""}
              </div>
              {e.note && <div className="mt-1 text-xs italic text-muted-foreground">"{e.note}"</div>}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        🤖 AI relationship read — coming next unit
      </div>
    </div>
  );
}
