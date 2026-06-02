import { cn } from "@/lib/utils";
import type { Temperature } from "@/lib/people-types";

const STYLE: Record<Temperature, string> = {
  hot: "bg-temp-hot text-temp-hot-foreground",
  warm: "bg-temp-warm text-temp-warm-foreground",
  cold: "bg-temp-cold text-temp-cold-foreground",
};

const ICON: Record<Temperature, string> = {
  hot: "🔥",
  warm: "🟡",
  cold: "⚪",
};

export function TempDot({ t, size = "sm" }: { t: Temperature; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        STYLE[t],
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
      )}
      title={t}
    >
      <span>{ICON[t]}</span>
      <span className="capitalize">{t}</span>
    </span>
  );
}

export function TempPickerButtons({
  value,
  onChange,
}: {
  value: Temperature | null;
  onChange: (t: Temperature) => void;
}) {
  const opts: { t: Temperature; label: string }[] = [
    { t: "hot", label: "🔥 Hot" },
    { t: "warm", label: "🟡 Warm" },
    { t: "cold", label: "⚪ Cold" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map(({ t, label }) => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "h-16 rounded-xl text-base font-semibold transition border-2",
              active
                ? cn(STYLE[t], "border-foreground/20 scale-[1.02] shadow")
                : "bg-card text-foreground border-border hover:bg-muted",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
