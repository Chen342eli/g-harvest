import { useSyncExternalStore } from "react";

let selectedId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openPersonDrawer(id: string) {
  selectedId = id;
  emit();
}

export function closePersonDrawer() {
  selectedId = null;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return selectedId;
}

function getServerSnapshot() {
  return null;
}

export function useSelectedPersonId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
