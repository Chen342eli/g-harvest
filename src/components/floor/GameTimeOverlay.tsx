import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Copy, Flame, Mail, Search, Sparkles, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { findMatch, derivePerson, computeBadges } from "@/lib/matching";
import { BadgeList } from "@/components/people/Badges";
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
import { analyzeRelationship } from "@/lib/relationship-ai.functions";

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

      {/* Exit (single tap) */}
      <div className="flex items-center justify-center px-4 pb-6">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] text-brand-base-foreground/50 hover:text-brand-base-foreground/80"
        >
          <X className="h-3 w-3" /> Exit Game Time
        </button>
      </div>

      {/* Capture sheet — full-screen Game Time tactical display */}
      {draft && (
        <div className="fixed inset-0 z-10 flex flex-col bg-brand-base text-brand-base-foreground overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl flex flex-1 flex-col">

            {/* Identity strip */}
            <div className="flex items-start justify-between gap-3 px-6 pt-6">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[10px] font-bold tracking-[0.2em] text-brand-base-foreground/40 uppercase">
                  {draft.mode === "existing" ? "Person identified" : "New lead"}
                </p>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full bg-transparent text-2xl font-extrabold tracking-tight text-brand-base-foreground focus:outline-none"
                />
                {draft.mode === "existing" && draft.personId && (
                  <PersonIdentitySub personId={draft.personId} />
                )}
              </div>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Close"
                className="rounded-full bg-white/5 p-2 text-brand-base-foreground/60 hover:bg-white/10 hover:text-brand-base-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Briefing — only for existing persons */}
            {draft.mode === "existing" && draft.personId && (
              <PersonBriefing personId={draft.personId} />
            )}

            {/* Capture controls */}
            <div className="mt-auto border-t border-white/10 bg-white/[0.02] p-6 space-y-5">

              {/* Temperature */}
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-[0.2em] text-brand-base-foreground/40 uppercase">
                  Today's read
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {(["hot", "warm", "cold"] as Temperature[]).map((t) => {
                    const active = temperature === t;
                    const tone =
                      t === "hot"
                        ? "border-temp-hot bg-temp-hot/15 text-temp-hot"
                        : t === "warm"
                        ? "border-temp-warm bg-temp-warm/15 text-temp-warm"
                        : "border-temp-cold bg-temp-cold/15 text-temp-cold";
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTemperature(t)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 rounded-xl border p-4 transition active:scale-95",
                          active
                            ? tone
                            : "border-white/10 bg-white/5 text-brand-base-foreground/50 hover:bg-white/10",
                        )}
                      >
                        <span className="text-xl">
                          {t === "hot" ? "🔥" : t === "warm" ? "☀️" : "❄️"}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {t}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Company */}
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-brand-base px-1 text-[9px] font-black uppercase tracking-widest text-brand-base-foreground/40">
                  Company
                </label>
                <input
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                  placeholder="—"
                  className="w-full rounded-lg border border-white/10 bg-transparent p-3 text-sm font-medium text-brand-base-foreground outline-none focus:border-brand-accent/60"
                />
              </div>

              {/* Vertical chips */}
              <div className="flex flex-wrap gap-2">
                {ENCOUNTER_VERTICALS.map((v) => {
                  const on = vertical === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVertical(on ? "" : v)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                        on
                          ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
                          : "border-white/10 bg-white/5 text-brand-base-foreground/60 hover:bg-white/10",
                      )}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>

              {/* Note */}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tap to add note (the gold)…"
                rows={2}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-brand-base-foreground outline-none focus:border-brand-accent/60"
              />

              {isHotAccountCompany(draft.company, accounts) && (
                <div className="rounded-md border border-temp-hot/40 bg-temp-hot/10 px-3 py-2 text-xs font-medium text-brand-base-foreground">
                  <Flame className="mr-1 inline h-3 w-3 text-temp-hot" />
                  Hot Account — auto-flagged
                </div>
              )}

              {/* CTA */}
              <button
                type="button"
                disabled={!canSave}
                onClick={save}
                className={cn(
                  "w-full rounded-xl py-4 text-sm font-extrabold uppercase tracking-[0.2em] transition active:scale-[0.98]",
                  canSave
                    ? "bg-brand-base-foreground text-brand-base shadow-xl shadow-black/40 hover:opacity-90"
                    : "bg-white/10 text-brand-base-foreground/40",
                )}
              >
                Save & Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExistingPersonSummary({ personId }: { personId: string }) {
  const data = usePeopleData();
  const person = data.people.find((p) => p.id === personId);
  if (!person) return null;
  const derived = derivePerson(person, data.encounters);
  const badges = computeBadges(person, data.encounters);
  const encounters = derived.encounters;
  const last = encounters[encounters.length - 1];

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="rounded-lg border border-dashed border-brand-accent/40 bg-brand-accent/5 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent">
          <Sparkles className="h-3 w-3" /> AI relationship read
        </div>
        <p className="text-xs leading-relaxed text-foreground">
          {encounters.length === 0
            ? "First time meeting — no prior context yet."
            : `${encounters.length} prior encounter${encounters.length > 1 ? "s" : ""}${
                last ? `. Last seen at ${last.conferenceName} (${last.temperature}) by ${last.repId}` : ""
              }. ${person.currentRole ?? ""}${person.currentCompany ? ` @ ${person.currentCompany}` : ""}.`}
        </p>
      </div>

      {badges.length > 0 && <BadgeList badges={badges} />}

      {encounters.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Arc
          </div>
          <ol className="space-y-1.5">
            {encounters.slice(-3).reverse().map((e) => (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <TempDot t={e.temperature} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">
                    <span className="font-medium">{e.conferenceName}</span>
                    <span className="text-muted-foreground"> · {new Date(e.timestamp).toLocaleDateString()}</span>
                  </div>
                  {e.note && <div className="truncate italic text-muted-foreground">"{e.note}"</div>}
                </div>
              </li>
            ))}
          </ol>
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
