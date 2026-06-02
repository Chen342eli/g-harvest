import { useSyncExternalStore } from "react";

const KEY = "grain-radar.settings.v1";

export interface Settings {
  activeConferenceId?: string;
  activeConferenceName?: string;
  activeRepId?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  recapToEmail?: string;
}

const DEFAULT: Settings = {};

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Settings) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let cache: Settings | null = null;
const listeners = new Set<() => void>();

function snap() {
  if (!cache) cache = read();
  return cache;
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snap,
    () => DEFAULT,
  );
}

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...snap(), ...patch };
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}
