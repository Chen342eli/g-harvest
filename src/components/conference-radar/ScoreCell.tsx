import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SCORE_WEIGHTS, WEIGHT_LABELS, type SubScores } from "@/lib/conferences";

export function ScoreCell({ score, subScores }: { score: number; subScores: SubScores }) {
  const keys = Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[];
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-md bg-secondary px-2 text-sm font-semibold tabular-nums text-secondary-foreground hover:bg-secondary/80"
          >
            {score}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="w-72 p-3">
          <div className="mb-2 text-xs font-semibold text-foreground">ICP score breakdown</div>
          <div className="space-y-1.5">
            {keys.map((k) => {
              const weight = Math.round(SCORE_WEIGHTS[k] * 100);
              const val = subScores[k];
              return (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-44 text-muted-foreground">
                    {WEIGHT_LABELS[k]}{" "}
                    <span className="text-muted-foreground/70">({weight}%)</span>
                  </span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary"
                      style={{ width: `${val}%` }}
                    />
                  </div>
                  <span className="w-7 text-right font-medium tabular-nums">{val}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
            Scoring methodology is managed by Sales Ops.
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
