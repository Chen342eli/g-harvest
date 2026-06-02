import { Link, useRouterState } from "@tanstack/react-router";
import { Radar, Calendar, ListTree, UserPlus, Users, Upload, Sun, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Catalog", icon: ListTree, exact: true },
  { to: "/planning", label: "Planning", icon: Calendar, exact: false },
  { to: "/agent", label: "Agent Runs", icon: Radar, exact: false },
  { to: "/capture", label: "Capture", icon: UserPlus, exact: false },
  { to: "/people", label: "People", icon: Users, exact: false },
  { to: "/import", label: "Import", icon: Upload, exact: false },
  { to: "/recap", label: "Recap", icon: Sun, exact: false },
  { to: "/settings", label: "Settings", icon: Settings, exact: false },
] as const;

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {ITEMS.map(({ to, label, icon: Icon, exact }) => {
        const active = exact ? pathname === to : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
