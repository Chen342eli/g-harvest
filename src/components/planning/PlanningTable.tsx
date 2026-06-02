import { useMemo } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanStatusChip } from "./PlanStatusChip";
import {
  PLAN_ITEM_STATUS_ORDER,
  type PlanItemStatus,
  type PlanItemWithConference,
} from "@/lib/planning";

interface Props {
  items: PlanItemWithConference[];
  onSetStatus: (conferenceId: string, status: PlanItemStatus) => void;
  onRemove: (conferenceId: string) => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PlanningTable({ items, onSetStatus, onRemove }: Props) {
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const sa = PLAN_ITEM_STATUS_ORDER.indexOf(a.planStatus);
      const sb = PLAN_ITEM_STATUS_ORDER.indexOf(b.planStatus);
      if (sa !== sb) return sa - sb;
      return new Date(a.conference.startDate).getTime() - new Date(b.conference.startDate).getTime();
    });
  }, [items]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Conference</Th>
              <Th>Dates</Th>
              <Th>Region · Vertical</Th>
              <Th>Plan status</Th>
              <th className="w-8 px-2 py-2.5" aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const c = item.conference;
              return (
                <tr key={item.id} className="group border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 align-top">
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {c.name}
                      <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                    </a>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {c.city}, {c.country}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                    {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-foreground">{c.region}</div>
                    <div className="text-xs text-muted-foreground">{c.vertical}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <PlanStatusChip status={item.planStatus} onChange={(s) => onSetStatus(c.id, s)} />
                  </td>
                  <td className="w-8 px-2 py-3 align-top text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(c.id)}
                      className="h-7 w-7 p-0 opacity-0 transition group-hover:opacity-100"
                      title="Remove from plan"
                      aria-label="Remove from plan"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No conferences in this plan yet. Use the Catalog to add some.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground ${className ?? ""}`}>
      {children}
    </th>
  );
}
