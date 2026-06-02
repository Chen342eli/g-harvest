import { useRouterState } from "@tanstack/react-router";
import { SubNav, CONFERENCE_SUBNAV, LEADS_SUBNAV } from "./SubNav";

const CONFERENCE_PATHS = new Set(["/today", "/capture", "/import", "/recap"]);
const LEADS_PATHS = new Set(["/people", "/follow-ups"]);

export function ContextSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (CONFERENCE_PATHS.has(pathname)) {
    return (
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Conference
          </span>
          <SubNav items={CONFERENCE_SUBNAV} />
        </div>
      </div>
    );
  }
  if (LEADS_PATHS.has(pathname)) {
    return (
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Leads
          </span>
          <SubNav items={LEADS_SUBNAV} />
        </div>
      </div>
    );
  }
  return null;
}
