import { useMemo } from "react";
import { X } from "lucide-react";
import { usePeopleData } from "@/lib/people-store";
import { computeBadges, derivePerson } from "@/lib/matching";
import { closePersonDrawer, useSelectedPersonId } from "@/lib/person-drawer-store";
import { PersonDetail } from "./PersonDetail";

export function PersonDrawer() {
  const selectedId = useSelectedPersonId();
  const data = usePeopleData();

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const person = data.people.find((p) => p.id === selectedId);
    if (!person) return null;
    const derived = derivePerson(person, data.encounters);
    const badges = computeBadges(person, data.encounters);
    return { person, derived, badges };
  }, [selectedId, data]);

  if (!selected) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={closePersonDrawer}
        aria-hidden
      />
      <aside
        className="fixed right-6 top-6 z-50 w-[560px] max-w-[calc(100%-3rem)] max-h-[calc(100vh-3rem)] overflow-hidden rounded-lg border border-border bg-card shadow-xl flex flex-col"
        role="dialog"
        aria-label={`${selected.person.fullName} details`}
      >
        <div className="sticky top-0 z-10 flex justify-end border-b border-border bg-card/95 backdrop-blur px-3 py-2">
          <button
            type="button"
            onClick={closePersonDrawer}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-auto">
          <PersonDetail
            person={selected.person}
            encounters={selected.derived.encounters}
            badges={selected.badges}
          />
        </div>
      </aside>
    </>
  );
}
