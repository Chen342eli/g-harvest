import { AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import type { Insight } from "@/lib/insights";
import { cn } from "@/lib/utils";

interface Props {
  insight: Insight;
  onAction: (insight: Insight) => void;
}

export function InsightCard({ insight, onAction }: Props) {
  const isWarn = insight.severity === "warn";
  const Icon = isWarn ? AlertTriangle : Lightbulb;
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        isWarn
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-sky-200 bg-sky-50 text-sky-950",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            isWarn ? "text-amber-600" : "text-sky-600",
          )}
        />
        <div className="flex-1">
          <div className="font-medium">{insight.title}</div>
          <div className="mt-0.5 text-xs opacity-80">{insight.detail}</div>
          {insight.action && (
            <button
              type="button"
              onClick={() => onAction(insight)}
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline",
                isWarn ? "text-amber-900" : "text-sky-900",
              )}
            >
              Show involved <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
