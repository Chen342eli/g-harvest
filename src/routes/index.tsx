import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Radar } from "lucide-react";
import { SEED_CONFERENCES, type Conference } from "@/lib/conferences";
import { ConferenceTable } from "@/components/conference-radar/ConferenceTable";
import { FilterBar, DEFAULT_FILTERS, type Filters } from "@/components/conference-radar/FilterBar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grain Conference Radar" },
      { name: "description", content: "Internal tool to prioritize industry conferences and coverage for the sales team." },
    ],
  }),
  component: Index,
});

function applyFilters(items: Conference[], f: Filters): Conference[] {
  const q = f.search.trim().toLowerCase();
  const from = f.dateFrom ? new Date(f.dateFrom).getTime() : null;
  const to = f.dateTo ? new Date(f.dateTo).getTime() : null;
  return items.filter((c) => {
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (f.verticals.length && !f.verticals.includes(c.vertical)) return false;
    if (f.regions.length && !f.regions.includes(c.region)) return false;
    if (f.tiers.length && !f.tiers.includes(c.tier)) return false;
    const start = new Date(c.startDate).getTime();
    const end = new Date(c.endDate).getTime();
    if (from !== null && end < from) return false;
    if (to !== null && start > to) return false;
    if (f.gapsOnly && !(c.tier === "Tier 1" && c.assignedReps.length === 0)) return false;
    return true;
  });
}

function Index() {
  const [conferences, setConferences] = useState<Conference[]>(SEED_CONFERENCES);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const filtered = useMemo(() => applyFilters(conferences, filters), [conferences, filters]);

  const stats = useMemo(() => {
    const tier1 = conferences.filter((c) => c.tier === "Tier 1");
    const gaps = tier1.filter((c) => c.assignedReps.length === 0);
    return {
      total: conferences.length,
      tier1: tier1.length,
      gaps: gaps.length,
    };
  }, [conferences]);

  const toggleRep = (conferenceId: string, rep: string) => {
    setConferences((prev) =>
      prev.map((c) =>
        c.id === conferenceId
          ? {
              ...c,
              assignedReps: c.assignedReps.includes(rep)
                ? c.assignedReps.filter((r) => r !== rep)
                : [...c.assignedReps, rep],
            }
          : c,
      ),
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Radar className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Grain Conference Radar
              </h1>
              <p className="text-xs text-muted-foreground">
                Prioritize where to invest and who covers it.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Stat label="Conferences" value={stats.total} />
            <Stat label="Tier 1" value={stats.tier1} accent="text-emerald-700" />
            <Stat label="Coverage gaps" value={stats.gaps} accent={stats.gaps > 0 ? "text-red-700" : "text-foreground"} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-6 py-6">
        <FilterBar filters={filters} onChange={setFilters} />
        <div className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> of {conferences.length} conferences
        </div>
        <ConferenceTable conferences={filtered} onToggleRep={toggleRep} />
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className={`text-lg font-semibold tabular-nums ${accent ?? "text-foreground"}`}>{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}
