import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DECISION_STATUSES, type DecisionStatus } from "@/lib/conferences";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<DecisionStatus, string> = {
  Going: "bg-emerald-100 text-emerald-800 ring-emerald-200 hover:bg-emerald-200",
  Considering: "bg-sky-100 text-sky-800 ring-sky-200 hover:bg-sky-200",
  Passed: "bg-zinc-100 text-zinc-600 ring-zinc-200 hover:bg-zinc-200 line-through",
};

const DOT: Record<DecisionStatus, string> = {
  Going: "bg-emerald-500",
  Considering: "bg-sky-500",
  Passed: "bg-zinc-400",
};

export function StatusDot({ status }: { status: DecisionStatus }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", DOT[status])} aria-hidden="true" />;
}

export function StatusChip({
  status,
  onChange,
  size = "sm",
}: {
  status: DecisionStatus;
  onChange: (s: DecisionStatus) => void;
  size?: "sm" | "xs";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full ring-1 ring-inset font-medium transition",
            STATUS_STYLES[status],
            size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
          )}
        >
          <StatusDot status={status} />
          <span>{status}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-40 p-1">
        {DECISION_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <StatusDot status={s} />
              {s}
            </span>
            <Check className={cn("h-4 w-4", s === status ? "opacity-100" : "opacity-0")} />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
