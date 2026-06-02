import { Check, ChevronDown, Lock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PLAN_ITEM_STATUSES,
  PLAN_ITEM_STATUS_LABEL,
  type PlanItemStatus,
} from "@/lib/planning";
import { cn } from "@/lib/utils";

const STYLES: Record<PlanItemStatus, string> = {
  must_go: "bg-violet-100 text-violet-900 ring-violet-300 hover:bg-violet-200",
  approved: "bg-emerald-100 text-emerald-900 ring-emerald-300 hover:bg-emerald-200",
  shortlist: "bg-amber-100 text-amber-900 ring-amber-300 hover:bg-amber-200",
  considering: "bg-sky-100 text-sky-800 ring-sky-200 hover:bg-sky-200",
  dropped: "bg-zinc-100 text-zinc-500 ring-zinc-200 hover:bg-zinc-200 line-through",
};

const DOT: Record<PlanItemStatus, string> = {
  must_go: "bg-violet-600",
  approved: "bg-emerald-500",
  shortlist: "bg-amber-500",
  considering: "bg-sky-500",
  dropped: "bg-zinc-400",
};

export function PlanStatusDot({ status }: { status: PlanItemStatus }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", DOT[status])} aria-hidden="true" />;
}

export function PlanStatusChip({
  status,
  onChange,
  size = "sm",
  lockedReason,
}: {
  status: PlanItemStatus;
  onChange: (s: PlanItemStatus) => void;
  size?: "sm" | "xs";
  lockedReason?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full ring-1 ring-inset font-medium transition",
            STYLES[status],
            size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
          )}
          title={lockedReason}
        >
          <PlanStatusDot status={status} />
          {status === "must_go" && <Lock className="h-2.5 w-2.5" />}
          <span>{PLAN_ITEM_STATUS_LABEL[status]}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {PLAN_ITEM_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <PlanStatusDot status={s} />
              {PLAN_ITEM_STATUS_LABEL[s]}
            </span>
            <Check className={cn("h-4 w-4", s === status ? "opacity-100" : "opacity-0")} />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
