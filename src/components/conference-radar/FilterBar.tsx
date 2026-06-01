import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DecisionStatus, Region, Tier, Vertical } from "@/lib/conferences";
import { DECISION_STATUSES } from "@/lib/conferences";

export interface Filters {
  search: string;
  verticals: Vertical[];
  regions: Region[];
  tiers: Tier[];
  statuses: DecisionStatus[];
  dateFrom: string;
  dateTo: string;
  gapsOnly: boolean;
  ids: string[];
}

export const DEFAULT_FILTERS: Filters = {
  search: "",
  verticals: [],
  regions: [],
  tiers: [],
  statuses: [],
  dateFrom: "",
  dateTo: "",
  gapsOnly: false,
  ids: [],
};

const VERTICALS: Vertical[] = ["Payments", "Fintech", "Treasury", "Travel", "SaaS", "General Tech"];
const REGIONS: Region[] = ["North America", "Europe", "APAC", "Middle East", "LATAM"];
const TIERS: Tier[] = ["Tier 1", "Tier 2", "Tier 3"];

function MultiSelect<T extends string>({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: readonly T[];
  values: T[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (v: T) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 justify-between gap-2 font-normal">
          <span className="text-muted-foreground">{label}</span>
          {values.length > 0 && (
            <span className="rounded-sm bg-secondary px-1.5 text-xs font-medium">
              {values.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {options.map((opt) => {
          const on = values.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span>{opt}</span>
              <Check className={cn("h-4 w-4", on ? "opacity-100" : "opacity-0")} />
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const isDirty =
    filters.search ||
    filters.verticals.length ||
    filters.regions.length ||
    filters.tiers.length ||
    filters.statuses.length ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.gapsOnly ||
    filters.ids.length;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search conferences..."
          className="h-9 pl-8"
        />
      </div>
      <MultiSelect label="Vertical" options={VERTICALS} values={filters.verticals} onChange={(v) => set("verticals", v)} />
      <MultiSelect label="Region" options={REGIONS} values={filters.regions} onChange={(v) => set("regions", v)} />
      <MultiSelect label="Tier" options={TIERS} values={filters.tiers} onChange={(v) => set("tiers", v)} />
      <MultiSelect label="Status" options={DECISION_STATUSES} values={filters.statuses} onChange={(v) => set("statuses", v)} />
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => set("dateFrom", e.target.value)}
          className="h-9 w-[150px]"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => set("dateTo", e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>
      {isDirty && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="h-9 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
