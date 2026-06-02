import { cn } from "@/lib/utils";
import type { Badge as BadgeType } from "@/lib/matching";

export function BadgeChip({ badge }: { badge: BadgeType }) {
  return (
    <span
      title={badge.tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        badge.emphasis
          ? "bg-signal-buying text-signal-buying-foreground border-transparent"
          : "bg-muted text-foreground border-border",
      )}
    >
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  );
}

export function BadgeList({ badges }: { badges: BadgeType[] }) {
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <BadgeChip key={b.key} badge={b} />
      ))}
    </div>
  );
}
