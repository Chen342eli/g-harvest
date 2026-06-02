import { Link, useRouterState } from "@tanstack/react-router";
import {
  Calendar,
  Home,
  ListTree,
  Radar,
  Settings,
  Sun,
  Upload,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: LucideIcon; exact?: boolean };

const HOME: Item = { to: "/", label: "Home", icon: Home, exact: true };

const CONFERENCES: Item[] = [
  { to: "/catalog", label: "Catalog", icon: ListTree },
  { to: "/planning", label: "Planning", icon: Calendar },
  { to: "/agent", label: "Agent", icon: Radar },
];

const PEOPLE: Item[] = [
  { to: "/capture", label: "Capture", icon: UserPlus },
  { to: "/people", label: "People", icon: Users },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/recap", label: "Recap", icon: Sun },
];

const META: Item[] = [{ to: "/settings", label: "Settings", icon: Settings }];

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (it: Item) =>
    it.exact ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/");

  return (
    <nav className="flex flex-wrap items-center gap-1">
      <NavItem item={HOME} active={isActive(HOME)} />
      <Sep label="Conferences" />
      {CONFERENCES.map((it) => (
        <NavItem key={it.to} item={it} active={isActive(it)} />
      ))}
      <Sep label="People" />
      {PEOPLE.map((it) => (
        <NavItem key={it.to} item={it} active={isActive(it)} />
      ))}
      <Sep />
      {META.map((it) => (
        <NavItem key={it.to} item={it} active={isActive(it)} />
      ))}
    </nav>
  );
}

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {item.label}
    </Link>
  );
}

function Sep({ label }: { label?: string }) {
  return (
    <span className="mx-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
      <span className="h-3 w-px bg-border" />
      {label && <span className="hidden lg:inline">{label}</span>}
    </span>
  );
}
