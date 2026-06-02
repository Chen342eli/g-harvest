import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type SubNavItem = { to: string; label: string };

export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
      {items.map((it) => {
        const active = pathname === it.to;
        return (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
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
