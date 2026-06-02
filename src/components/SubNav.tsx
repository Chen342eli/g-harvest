import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type SubNavItem = { to: string; label: string };

export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex items-center gap-1" role="tablist">
      {items.map((it) => {
        const active = pathname === it.to;
        return (
          <Link
            key={it.to}
            to={it.to}
            role="tab"
            aria-selected={active}
            className={cn(
              "relative px-3 py-2 text-xs font-medium transition border-b-2 -mb-px",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const CONFERENCE_SUBNAV: SubNavItem[] = [
  { to: "/today", label: "Today" },
  { to: "/capture", label: "Capture" },
  { to: "/import", label: "Import" },
  { to: "/recap", label: "Recap" },
];

export const LEADS_SUBNAV: SubNavItem[] = [
  { to: "/people", label: "People" },
  { to: "/follow-ups", label: "Follow-ups" },
];
