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
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
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
