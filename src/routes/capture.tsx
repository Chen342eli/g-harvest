import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { listConferences } from "@/lib/conferences.functions";
import { TopNav } from "@/components/TopNav";
import { SALES_TEAM } from "@/lib/conferences";
import { useSettings, updateSettings } from "@/lib/settings-store";
import {
  usePeopleData,
  addPerson,
  addEncounter,
  updatePerson,
  addNameVariation,
  generateId,
} from "@/lib/people-store";
import { findMatch, computeBadges, derivePerson } from "@/lib/matching";
import type { EncounterVertical, Person, Temperature } from "@/lib/people-types";
import { ENCOUNTER_VERTICALS } from "@/lib/people-types";
import { TempPickerButtons } from "@/components/people/TempControls";
import { BadgeList } from "@/components/people/Badges";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/capture")({
  head: () => ({ meta: [{ title: "Capture · Conference Radar" }] }),
  component: CapturePage,
});

function CapturePage() {
  const fetchConfs = useServerFn(listConferences);
  const { data: conferences = [] } = useQuery({ queryKey: ["conferences"], queryFn: () => fetchConfs() });
  const settings = useSettings();
  const data = usePeopleData();

  const [name, setName] = useState("");
  const [linkedIn, setLinkedIn] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [vertical, setVertical] = useState<EncounterVertical | "">("");
  const [temperature, setTemperature] = useState<Temperature | null>(null);
  const [note, setNote] = useState("");
  const [matchedId, setMatchedId] = useState<string | null>(null);
  const [matchDismissed, setMatchDismissed] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ name: string; badges: ReturnType<typeof computeBadges> } | null>(null);

  // Default rep & conference
  useEffect(() => {
    if (!settings.activeRepId && SALES_TEAM.length) {
      updateSettings({ activeRepId: SALES_TEAM[0] });
    }
  }, [settings.activeRepId]);

  useEffect(() => {
    if (!settings.activeConferenceId && conferences.length) {
      const c = conferences[0];
      updateSettings({ activeConferenceId: c.id, activeConferenceName: c.name });
    }
  }, [settings.activeConferenceId, conferences]);

  const match = useMemo(() => {
    if (name.trim().length < 2) return null;
    return findMatch({ fullName: name, linkedInUrl: linkedIn || undefined, company: company || undefined }, data.people);
  }, [name, linkedIn, company, data.people]);

  const matchedPerson = match?.person && !matchDismissed ? match.person : null;

  // Auto-prefill from confident match
  useEffect(() => {
    if (matchedPerson && matchedId !== matchedPerson.id && match?.confidence === "confident") {
      setMatchedId(matchedPerson.id);
      if (!company && matchedPerson.currentCompany) setCompany(matchedPerson.currentCompany);
      if (!role && matchedPerson.currentRole) setRole(matchedPerson.currentRole);
      if (!linkedIn && matchedPerson.linkedInUrl) setLinkedIn(matchedPerson.linkedInUrl);
      if (!vertical && matchedPerson.currentVertical) setVertical(matchedPerson.currentVertical);
    }
  }, [matchedPerson, match, matchedId, company, role, linkedIn, vertical]);

  const canSave = name.trim().length > 0 && !!settings.activeConferenceId && !!settings.activeRepId && temperature !== null;

  function reset() {
    setName("");
    setLinkedIn("");
    setCompany("");
    setRole("");
    setVertical("");
    setTemperature(null);
    setNote("");
    setMatchedId(null);
    setMatchDismissed(false);
  }

  function handleSave() {
    if (!canSave) return;
    const repId = settings.activeRepId!;
    const conferenceId = settings.activeConferenceId!;
    const conferenceName = settings.activeConferenceName ?? "Unknown";
    const timestamp = new Date().toISOString();

    let personId: string;
    let person: Person;
    if (matchedId) {
      personId = matchedId;
      const existing = data.people.find((p) => p.id === matchedId)!;
      // Add name variation if different
      if (existing.fullName.toLowerCase() !== name.trim().toLowerCase()) {
        addNameVariation(matchedId, name.trim());
      }
      const patch: Partial<Person> = {};
      if (company) patch.currentCompany = company;
      if (role) patch.currentRole = role;
      if (vertical) patch.currentVertical = vertical as EncounterVertical;
      if (linkedIn) patch.linkedInUrl = linkedIn;
      if (Object.keys(patch).length) updatePerson(matchedId, patch);
      person = { ...existing, ...patch };
    } else {
      personId = generateId();
      person = {
        id: personId,
        fullName: name.trim(),
        nameVariations: [],
        linkedInUrl: linkedIn || undefined,
        currentCompany: company || undefined,
        currentRole: role || undefined,
        currentVertical: (vertical || undefined) as EncounterVertical | undefined,
        createdAt: timestamp,
        createdByRepId: repId,
      };
      addPerson(person);
    }

    const encounter = {
      id: generateId(),
      personId,
      conferenceId,
      conferenceName,
      repId,
      timestamp,
      temperature: temperature!,
      vertical: (vertical || undefined) as EncounterVertical | undefined,
      note: note || undefined,
      companyAtTime: company || person.currentCompany,
      roleAtTime: role || person.currentRole,
      captureMethod: "manual" as const,
    };
    addEncounter(encounter);

    const allEncs = [...data.encounters, encounter];
    const badges = computeBadges(person, allEncs);
    setLastSaved({ name: person.fullName, badges });
    toast.success(`Saved ${person.fullName}`);
    reset();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">Capture lead</h1>
            {settings.activeConferenceName && (
              <p className="text-xs text-muted-foreground">{settings.activeConferenceName}</p>
            )}
          </div>
          <TopNav />
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-4 py-4 sm:py-6">
        {lastSaved && (
          <div className="mb-4 rounded-xl border border-signal-buying/40 bg-signal-buying/10 p-3 text-sm">
            <div className="font-medium">Saved {lastSaved.name}</div>
            {lastSaved.badges.length > 0 && (
              <div className="mt-2">
                <BadgeList badges={lastSaved.badges} />
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          {/* Temperature first */}
          <div>
            <div className="mb-2 text-xs font-medium text-foreground">Temperature *</div>
            <TempPickerButtons value={temperature} onChange={setTemperature} />
          </div>

          <label className="block">
            <span className="text-xs font-medium text-foreground">Name *</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setMatchDismissed(false);
                if (matchedId && e.target.value.trim() !== name.trim()) setMatchedId(null);
              }}
              placeholder="e.g. Daniel Cohen"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-3 text-base"
            />
          </label>

          {matchedPerson && (
            <RecognitionBanner
              person={matchedPerson}
              confidence={match!.confidence}
              encounters={data.encounters}
              onAccept={() => setMatchedId(matchedPerson.id)}
              onReject={() => {
                setMatchDismissed(true);
                setMatchedId(null);
              }}
              accepted={matchedId === matchedPerson.id}
            />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-foreground">Company</span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-foreground">Role / title</span>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-foreground">Vertical</div>
            <div className="flex flex-wrap gap-1.5">
              {ENCOUNTER_VERTICALS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVertical(vertical === v ? "" : v)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    vertical === v
                      ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-foreground">Note (the gold)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="One line — what mattered"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className={cn(
              "w-full rounded-xl py-4 text-base font-semibold transition",
              canSave
                ? "bg-brand-base text-brand-base-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            Save lead
          </button>
        </div>
      </main>
    </div>
  );
}

function RecognitionBanner({
  person,
  confidence,
  encounters,
  onAccept,
  onReject,
  accepted,
}: {
  person: Person;
  confidence: "confident" | "probable" | "possible" | "none";
  encounters: import("@/lib/people-types").Encounter[];
  onAccept: () => void;
  onReject: () => void;
  accepted: boolean;
}) {
  const derived = derivePerson(person, encounters);
  const last = derived.encounters[derived.encounters.length - 1];
  const summary = last
    ? `${last.conferenceName} · by ${last.repId} · ${last.temperature}`
    : `${derived.encounterCount} prior encounter${derived.encounterCount === 1 ? "" : "s"}`;
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        confidence === "confident"
          ? "border-signal-buying/50 bg-signal-buying/10"
          : confidence === "probable"
          ? "border-brand-accent/60 bg-brand-accent/10"
          : "border-amber-400/60 bg-amber-50",
      )}
    >
      <div className="font-medium">
        ↩ We've met them. <span className="font-semibold">{person.fullName}</span>
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {summary}
        {person.currentRole && person.currentCompany ? ` · ${person.currentRole} @ ${person.currentCompany}` : ""}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        Match: {confidence}
      </div>
      {!accepted ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
          >
            Yes, same
          </button>
          <button
            type="button"
            onClick={onReject}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
          >
            No, new person
          </button>
        </div>
      ) : (
        <div className="mt-2 text-xs text-signal-buying">✓ Linked — fields prefilled</div>
      )}
    </div>
  );
}
