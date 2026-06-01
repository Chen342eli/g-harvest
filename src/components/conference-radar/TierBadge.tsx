import type { Tier } from "@/lib/conferences";
import { cn } from "@/lib/utils";

export function TierBadge({ tier }: { tier: Tier }) {
  const styles: Record<Tier, string> = {
    "Tier 1": "bg-emerald-100 text-emerald-800 ring-emerald-200",
    "Tier 2": "bg-amber-100 text-amber-800 ring-amber-200",
    "Tier 3": "bg-muted text-muted-foreground ring-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[tier],
      )}
    >
      {tier}
    </span>
  );
}

export function CoverageGapBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-200">
      Coverage gap
    </span>
  );
}
