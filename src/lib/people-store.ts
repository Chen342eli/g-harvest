import { useSyncExternalStore } from "react";
import type { Encounter, PeopleData, Person } from "./people-types";
import { SEED_PEOPLE_DATA } from "./seed-people";

const STORAGE_KEY = "grain-radar.people.v1";
const SEED_FLAG_KEY = "grain-radar.people.v1.seeded";

function readStorage(): PeopleData {
  if (typeof window === "undefined") return { people: [], encounters: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (!window.localStorage.getItem(SEED_FLAG_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PEOPLE_DATA));
        window.localStorage.setItem(SEED_FLAG_KEY, "1");
        return SEED_PEOPLE_DATA;
      }
      return { people: [], encounters: [] };
    }
    return JSON.parse(raw) as PeopleData;
  } catch {
    return { people: [], encounters: [] };
  }
}

let cache: PeopleData | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): PeopleData {
  if (!cache) cache = readStorage();
  return cache;
}

function getServerSnapshot(): PeopleData {
  return { people: [], encounters: [] };
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function commit(next: PeopleData) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

export function usePeopleData(): PeopleData {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function addPerson(p: Person) {
  const cur = getSnapshot();
  commit({ ...cur, people: [...cur.people, p] });
}

export function updatePerson(id: string, patch: Partial<Person>) {
  const cur = getSnapshot();
  commit({
    ...cur,
    people: cur.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

export function addEncounter(e: Encounter) {
  const cur = getSnapshot();
  commit({ ...cur, encounters: [...cur.encounters, e] });
}

export function addNameVariation(personId: string, variation: string) {
  const cur = getSnapshot();
  commit({
    ...cur,
    people: cur.people.map((p) => {
      if (p.id !== personId) return p;
      if (p.fullName === variation || p.nameVariations.includes(variation)) return p;
      return { ...p, nameVariations: [...p.nameVariations, variation] };
    }),
  });
}

export function resetSeed() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(SEED_FLAG_KEY);
  cache = null;
  listeners.forEach((l) => l());
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
