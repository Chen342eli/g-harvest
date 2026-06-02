import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarRange,
  Settings,
  Sprout,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: LucideIcon; match?: string[] };

const MODULES: Item[] = [
  {
    to: "/planning",
    label: "Season Planner",
    icon: CalendarRange,
    match: ["/catalog", "/agent"],
  },
  {
    to: "/floor",
    label: "Floor",
    icon: CalendarCheck,
    match: ["/today", "/capture", "/import", "/recap"],
  },
  {
    to: "/people",
    label: "Leads",
    icon: Users,
    match: ["/follow-ups"],
  },
];

export interface TopNavProps {
  rightSlot?: ReactNode;
  maxWidth?: string;
}

export function TopNav({ rightSlot, maxWidth = "max-w-[1600px]" }: TopNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (it: Item) => {
    if (pathname === it.to || pathname.startsWith(it.to + "/")) return true;
    return (it.match ?? []).some((m) => pathname === m || pathname.startsWith(m + "/"));
  };

  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <header className="border-b border-border bg-card">
      <div className={cn("mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-3", maxWidth)}>
        <div className="flex items-center gap-6">
          {/* Brand = Home */}
          <Link
            to="/"
            className="group flex items-center gap-2.5"
            aria-label="Grain Harvest — Home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition group-hover:opacity-90">
              <Sprout className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Grain Harvest
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            {MODULES.map((it) => {
              const Icon = it.icon;
              const active = isActive(it);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {rightSlot}
          <Link
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md transition",
              settingsActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
