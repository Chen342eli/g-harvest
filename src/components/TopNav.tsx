import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarRange,
  Home,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: LucideIcon; exact?: boolean; match?: string[] };

const ITEMS: Item[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/planning", label: "Planning", icon: CalendarRange, match: ["/catalog", "/agent"] },
  { to: "/today", label: "Conference", icon: CalendarCheck, match: ["/capture", "/import", "/recap"] },
  { to: "/people", label: "Leads", icon: Users, match: ["/follow-ups"] },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (it: Item) => {
    if (it.exact) return pathname === it.to;
    if (pathname === it.to || pathname.startsWith(it.to + "/")) return true;
    return (it.match ?? []).some((m) => pathname === m || pathname.startsWith(m + "/"));
  };

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {ITEMS.map((it) => {
        const Icon = it.icon;
        const active = isActive(it);
        return (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
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
  );
}
