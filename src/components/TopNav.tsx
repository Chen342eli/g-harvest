import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarRange,
  HelpCircle,
  Mail,
  Settings,
  Sprout,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ContextSubNav } from "@/components/ContextSubNav";
import { usePeopleData } from "@/lib/people-store";

type Item = { to: string; label: string; icon: LucideIcon; match?: string[]; badge?: "follow-ups" };

const MODULES: Item[] = [
  { to: "/planning", label: "Conference Management", icon: CalendarRange, match: ["/agent"] },
  { to: "/floor", label: "Event Mode", icon: CalendarCheck, match: ["/today", "/capture", "/import", "/recap"] },
  { to: "/people", label: "People", icon: Users },
  { to: "/follow-ups", label: "Follow-ups", icon: Mail, badge: "follow-ups" },
];

export interface TopNavProps {
  rightSlot?: ReactNode;
  maxWidth?: string;
}

export function TopNav({ rightSlot, maxWidth = "max-w-[1600px]" }: TopNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const data = usePeopleData();

  // Urgent "Chase now" count: Warming + pending
  const chaseNowCount = data.people.filter(
    (p) => p.aiSignal === "Warming" && (p.followUpStatus ?? "pending") === "pending",
  ).length;

  const isActive = (it: Item) => {
    if (pathname === it.to || pathname.startsWith(it.to + "/")) return true;
    return (it.match ?? []).some((m) => pathname === m || pathname.startsWith(m + "/"));
  };

  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");
  const helpActive = pathname === "/help" || pathname.startsWith("/help/");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className={cn("mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-3", maxWidth)}>
          <div className="flex items-center gap-6">
            <Link to="/" className="group flex items-center gap-2.5" aria-label="Grain Harvest — Home">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-accent text-brand-accent-foreground transition group-hover:opacity-90">
                <Sprout className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground">Grain Harvest</span>
            </Link>

            <nav className="flex flex-wrap items-center gap-1">
              {MODULES.map((it) => {
                const Icon = it.icon;
                const active = isActive(it);
                const showBadge = it.badge === "follow-ups" && chaseNowCount > 0;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={cn(
                      "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "bg-brand-base text-brand-base-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {it.label}
                    {showBadge && (
                      <span
                        className={cn(
                          "ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                          active
                            ? "bg-brand-base-foreground text-brand-base"
                            : "bg-temp-hot text-temp-hot-foreground",
                        )}
                        aria-label={`${chaseNowCount} urgent follow-ups`}
                      >
                        {chaseNowCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {rightSlot}
            <Link
              to="/help"
              aria-label="Help & docs"
              title="Help & docs"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md transition",
                helpActive
                  ? "bg-brand-base text-brand-base-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
            <Link
              to="/settings"
              aria-label="Settings"
              title="Settings"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md transition",
                settingsActive
                  ? "bg-brand-base text-brand-base-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>
      <ContextSubNav />
    </>
  );
}
