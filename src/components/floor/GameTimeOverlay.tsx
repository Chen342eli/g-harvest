import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Flame, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { findMatch, derivePerson } from "@/lib/matching";
import {
  usePeopleData,
  addPerson,
  addEncounter,
  addNameVariation,
  updatePerson,
  generateId,
} from "@/lib/people-store";
import type { EncounterVertical, Person, Temperature } from "@/lib/people-types";
import { ENCOUNTER_VERTICALS } from "@/lib/people-types";
import { useSettings } from "@/lib/settings-store";
import { isHotAccountCompany, useHotAccounts } from "@/lib/hot-accounts-store";
import { cn } from "@/lib/utils";

interface Props {
  onExit: () => void;
}

interface DraftCapture {
  mode: "existing" | "new";
  personId?: string;
  name: string;
  company: string;
  role: string;
}

export function GameTimeOverlay({ onExit }: Props) {
  const settings = useSettings();
  const data = usePeopleData();
  const accounts = useHotAccounts();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<DraftCapture | null>(null);
  const [temperature, setTemperature] = useState<Temperature | null>(null);
  const [vertical, setVertical] = useState<EncounterVertical | "">("");
  const [note, setNote] = useState("");
  const [exitConfirm, setExitConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const match = useMemo(() => {
    if (query.trim().length < 2) return null;
    return findMatch({ fullName: query }, data.people);
  }, [query, data.people]);

  const matchedPerson = match?.person && match.confidence !== "none" ? match.person : null;

  function openExisting(p: Person) {
    setDraft({
      mode: "existing",
      personId: p.id,
      name: query.trim() || p.fullName,
      company: p.currentCompany ?? "",
      role: p.currentRole ?? "",
    });
    setTemperature(null);
    setVertical((p.currentVertical as EncounterVertical | undefined) ?? "");
    setNote("");
  }

  function openNew() {
    setDraft({ mode: "new", name: query.trim(), company: "", role: "" });
    setTemperature(null);
    setVertical("");
    setNote("");
  }

  function closeSheet() {
    setDraft(null);
    setQuery("");
    setTemperature(null);
    setVertical("");
    setNote("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function save() {
    if (!draft || !temperature || !settings.activeConferenceId || !settings.activeRepId) return;
    const conferenceId = settings.activeConferenceId;
    const conferenceName = settings.activeConferenceName ?? "Active conference";
    const repId = settings.activeRepId;
    const timestamp = new Date().toISOString();

    let personId: string;
    let person: Person | undefined;
    if (draft.mode === "existing" && draft.personId) {
      personId = draft.personId;
      const existing = data.people.find((p) => p.id === draft.personId)!;
      person = existing;
      if (
        draft.name &&
        existing.fullName.toLowerCase() !== draft.name.toLowerCase() &&
        !existing.nameVariations.includes(draft.name)
      ) {
        addNameVariation(personId, draft.name);
      }
      const patch: Partial<Person> = {};
      if (draft.company && draft.company !== existing.currentCompany) patch.currentCompany = draft.company;
      if (draft.role && draft.role !== existing.currentRole) patch.currentRole = draft.role;
      if (vertical && vertical !== existing.currentVertical) patch.currentVertical = vertical as EncounterVertical;
      if (Object.keys(patch).length) updatePerson(personId, patch);
    } else {
      personId = generateId();
      person = {
        id: personId,
        fullName: draft.name,
        nameVariations: [],
        currentCompany: draft.company || undefined,
        currentRole: draft.role || undefined,
        currentVertical: (vertical || undefined) as EncounterVertical | undefined,
        createdAt: timestamp,
        createdByRepId: repId,
      };
      addPerson(person);
    }

    addEncounter({
      id: generateId(),
      personId,
      conferenceId,
      conferenceName,
      repId,
      timestamp,
      temperature,
      vertical: (vertical || undefined) as EncounterVertical | undefined,
      note: note || undefined,
      companyAtTime: draft.company || person?.currentCompany,
      roleAtTime: draft.role || person?.currentRole,
      captureMethod: "manual",
    });

    const hotFlag = isHotAccountCompany(draft.company || person?.currentCompany, accounts);
    toast.success(`Saved ${draft.name}${hotFlag ? " 🔥" : ""}`);
    closeSheet();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim().length >= 2 && !draft) {
      e.preventDefault();
      if (matchedPerson) openExisting(matchedPerson);
      else openNew();
    }
  }

  const canSave =
    !!draft && !!temperature && !!settings.activeConferenceId && !!settings.activeRepId && draft.name.trim().length > 0;

  const matchHot = matchedPerson && isHotAccountCompany(matchedPerson.currentCompany, accounts);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-base text-brand-base-foreground">
      {/* Top bar — conference lock + tiny exit */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-temp-hot/90 text-temp-hot-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-brand-base-foreground/60">
              Game Time · locked on
            </div>
            <div className="truncate text-sm font-semibold">
              {settings.activeConferenceName ?? "No conference selected"}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-brand-base-foreground/60">
          {settings.activeRepId ? `You: ${settings.activeRepId}` : "Pick rep in Floor"}
        </div>
      </header>

      {/* Search/create field */}
      <div className="px-4 pt-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-base-foreground/60" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a name…"
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-5 pl-12 pr-4 text-xl font-medium text-brand-base-foreground placeholder:text-brand-base-foreground/40 focus:border-temp-hot focus:outline-none"
            autoComplete="off"
          />
        </div>

        {query.trim().length >= 2 && !draft && (
          <div className="mt-3 space-y-2">
            {matchedPerson ? (
              <button
                type="button"
                onClick={() => openExisting(matchedPerson)}
                className="w-full rounded-xl border border-white/20 bg-white/10 p-4 text-left transition hover:bg-white/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold">
                      ↩ {matchedPerson.fullName}
                      {matchHot && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-temp-hot px-2 py-0.5 text-[10px] font-medium text-temp-hot-foreground">
                          <Flame className="h-3 w-3" /> Hot account
                        </span>
                      )}
                    </div>
                    <RecognitionLine person={matchedPerson} />
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-brand-base-foreground/60" />
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-wide text-brand-base-foreground/50">
                  Match: {match!.confidence}
                </div>
              </button>
            ) : null}
            <button
              type="button"
              onClick={openNew}
              className="w-full rounded-xl border border-dashed border-white/25 bg-transparent p-4 text-left transition hover:bg-white/5"
            >
              <div className="text-sm font-medium">
                + Create new lead: <span className="font-semibold">"{query.trim()}"</span>
              </div>
              <div className="mt-0.5 text-[11px] text-brand-base-foreground/60">
                No match found. Press Enter to create.
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Exit (small, deliberate) */}
      <div className="flex items-center justify-center px-4 pb-6">
        {!exitConfirm ? (
          <button
            type="button"
            onClick={() => setExitConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] text-brand-base-foreground/50 hover:text-brand-base-foreground/80"
          >
            <X className="h-3 w-3" /> Exit Game Time
          </button>
        ) : (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-brand-base-foreground/70">Exit?</span>
            <button
              type="button"
              onClick={onExit}
              className="rounded-md bg-temp-hot px-2.5 py-1 font-medium text-temp-hot-foreground"
            >
              Yes, exit
            </button>
            <button
              type="button"
              onClick={() => setExitConfirm(false)}
              className="rounded-md border border-white/20 px-2.5 py-1 text-brand-base-foreground/70"
            >
              Stay
            </button>
          </div>
        )}
      </div>

      {/* Capture sheet */}
      {draft && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-card text-foreground shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {draft.mode === "existing" ? "Add encounter to" : "New lead"}
                </div>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full bg-transparent text-lg font-semibold focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Close"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              {/* Temperature - primary */}
              <div className="grid grid-cols-3 gap-2">
                {(["hot", "warm", "cold"] as Temperature[]).map((t) => {
                  const active = temperature === t;
                  const cls =
                    t === "hot"
                      ? active
                        ? "bg-temp-hot text-temp-hot-foreground"
                        : "border-temp-hot/40 text-foreground"
                      : t === "warm"
                      ? active
                        ? "bg-temp-warm text-temp-warm-foreground"
                        : "border-temp-warm/50 text-foreground"
                      : active
                      ? "bg-temp-cold text-temp-cold-foreground"
                      : "border-temp-cold/50 text-foreground";
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTemperature(t)}
                      className={cn(
                        "h-16 rounded-xl border-2 text-base font-semibold transition",
                        active ? "border-transparent" : "bg-background",
                        cls,
                      )}
                    >
                      {t === "hot" ? "🔥 Hot" : t === "warm" ? "🟡 Warm" : "⚪ Cold"}
                    </button>
                  );
                })}
              </div>

              {/* Company quick edit */}
              <input
                value={draft.company}
                onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                placeholder="Company (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />

              {/* Vertical chips - compact */}
              <div className="flex flex-wrap gap-1.5">
                {ENCOUNTER_VERTICALS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVertical(vertical === v ? "" : v)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      vertical === v
                        ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="One-line note (the gold)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />

              {isHotAccountCompany(draft.company, accounts) && (
                <div className="rounded-md border border-temp-hot/40 bg-temp-hot/10 px-3 py-2 text-xs font-medium text-foreground">
                  <Flame className="mr-1 inline h-3 w-3 text-temp-hot" />
                  Hot Account — auto-flagged
                </div>
              )}

              <button
                type="button"
                disabled={!canSave}
                onClick={save}
                className={cn(
                  "w-full rounded-xl py-4 text-base font-semibold transition",
                  canSave
                    ? "bg-temp-hot text-temp-hot-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground",
                )}
              >
                Save & next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecognitionLine({ person }: { person: Person }) {
  const data = usePeopleData();
  const d = derivePerson(person, data.encounters);
  const last = d.encounters[d.encounters.length - 1];
  const parts: string[] = [];
  if (last) parts.push(`met at ${last.conferenceName}`);
  if (last) parts.push(`by ${last.repId}`);
  if (last) parts.push(last.temperature);
  if (person.currentRole) parts.push(person.currentRole);
  if (person.currentCompany) parts.push(`@ ${person.currentCompany}`);
  return (
    <div className="mt-0.5 truncate text-xs text-brand-base-foreground/70">
      {parts.join(" · ")}
    </div>
  );
}
