import { useSyncExternalStore } from "react";

const KEY = "grain-harvest.schedule.v1";

export type ScheduleKind = "booth" | "session" | "meeting";

export interface ScheduleItem {
  id: string;
  conferenceId: string;
  kind: ScheduleKind;
  /** ISO date (yyyy-mm-dd) */
  date: string;
  /** "HH:mm" 24h */
  startTime: string;
  /** "HH:mm" optional */
  endTime?: string;
  title: string;
  /** Rep name covering it */
  repId?: string;
  /** For meetings: linked person */
  personId?: string;
  personName?: string;
  location?: string;
}

function read(): ScheduleItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScheduleItem[]) : [];
  } catch {
    return [];
  }
}

let cache: ScheduleItem[] | null = null;
const listeners = new Set<() => void>();

function snap(): ScheduleItem[] {
  if (!cache) cache = read();
  return cache;
}

function commit(next: ScheduleItem[]) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

export function useSchedule(): ScheduleItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snap,
    () => [],
  );
}

export function addScheduleItem(item: ScheduleItem) {
  commit([...snap(), item]);
}

export function removeScheduleItem(id: string) {
  commit(snap().filter((x) => x.id !== id));
}

export function genScheduleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
