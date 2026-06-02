import { SchedulePanel } from "./SchedulePanel";
import { HotLeadsSidebar } from "./HotLeadsSidebar";

interface Props {
  conferenceId: string;
  conferenceStartDate: string;
  conferenceEndDate: string;
}

export function BeforePhase({ conferenceId, conferenceStartDate, conferenceEndDate }: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Prep mode.</span> Line up meetings and
        agree on the Hot Accounts to watch for. Both lists carry into <em>During</em>.
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SchedulePanel
          conferenceId={conferenceId}
          conferenceStartDate={conferenceStartDate}
          conferenceEndDate={conferenceEndDate}
        />
        <HotLeadsSidebar />
      </div>
    </div>
  );
}
