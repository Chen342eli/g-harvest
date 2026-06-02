import { useRouterState } from "@tanstack/react-router";
import { SubNav, CONFERENCE_SUBNAV } from "./SubNav";

const CONFERENCE_PATHS = new Set(["/today", "/capture", "/import", "/recap"]);

export function ContextSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  let items = null;
  let label = "";
  if (CONFERENCE_PATHS.has(pathname)) {
    items = CONFERENCE_SUBNAV;
    label = "Conference";
  }
  if (!items) return null;
  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-6">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <SubNav items={items} />
      </div>
    </div>
  );
}
