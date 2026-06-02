import { useSyncExternalStore } from "react";

const KEY = "grain-harvest.hot-accounts.v1";
const SEED_FLAG = "grain-harvest.hot-accounts.v1.seeded";

const SEED: string[] = ["Stripe", "Adyen", "Airwallex", "Payoneer", "Booking.com", "Shopify"];

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      if (!window.localStorage.getItem(SEED_FLAG)) {
        window.localStorage.setItem(KEY, JSON.stringify(SEED));
        window.localStorage.setItem(SEED_FLAG, "1");
        return SEED;
      }
      return [];
    }
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function snap(): string[] {
  if (!cache) cache = read();
  return cache;
}

function commit(next: string[]) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

export function useHotAccounts(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snap,
    () => [],
  );
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function addHotAccount(company: string) {
  const c = company.trim();
  if (!c) return;
  const cur = snap();
  if (cur.some((x) => norm(x) === norm(c))) return;
  commit([...cur, c]);
}

export function removeHotAccount(company: string) {
  commit(snap().filter((x) => x !== company));
}

export function isHotAccountCompany(company: string | undefined | null, list?: string[]): boolean {
  if (!company) return false;
  const target = norm(company);
  if (!target) return false;
  const src = list ?? snap();
  return src.some((x) => norm(x) === target);
}
