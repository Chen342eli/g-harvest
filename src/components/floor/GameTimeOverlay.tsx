import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Flame, Search, Sparkles, X, Zap } from "lucide-react";
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
                  {draft.mode === "existing" ? "Person identified" : "New lead · name required"}
                </p>
                {draft.mode === "existing" && draft.personId ? (
                  <>
                    <PersonFullNameDisplay personId={draft.personId} />
                    {query.trim() && query.trim().toLowerCase() !== draft.name.toLowerCase() && (
                      <p className="text-[11px] text-brand-base-foreground/50">
                        You searched: <span className="font-mono">"{query.trim()}"</span>
                      </p>
                    )}
                    <PersonIdentitySub personId={draft.personId} />
                  </>
                ) : (
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Full name *"
                    className="w-full bg-transparent text-2xl font-extrabold tracking-tight text-brand-base-foreground placeholder:text-brand-base-foreground/30 focus:outline-none"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Close without saving"
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

// Identity sub-line under the person's name in the briefing header
function PersonIdentitySub({ personId }: { personId: string }) {
  const data = usePeopleData();
  const person = data.people.find((p) => p.id === personId);
  if (!person) return null;
  const sub = [person.currentRole, person.currentCompany ? `@ ${person.currentCompany}` : null]
    .filter(Boolean)
    .join(" ");
  if (!sub) return null;
  return <p className="text-sm font-medium text-brand-base-foreground/60">{sub}</p>;
}

// Full name display for identified person (uses canonical fullName, not search query)
function PersonFullNameDisplay({ personId }: { personId: string }) {
  const data = usePeopleData();
  const person = data.people.find((p) => p.id === personId);
  if (!person) return null;
  return (
    <h2 className="text-2xl font-extrabold tracking-tight text-brand-base-foreground">
      {person.fullName}
    </h2>
  );
}

// Maps raw AI signal -> action-oriented label + helper line a rep can act on instantly.
function signalAction(signal?: string): { label: string; helper: string } | null {
  switch (signal) {
    case "Warming":
      return { label: "Worth investing · move now", helper: "Active buying signal — push a concrete next step." };
    case "Steady":
      return { label: "Keep warm · light touch", helper: "Engaged but flat — nurture, don't pressure." };
    case "Tire-kicker":
      return { label: "Low priority · don't over-invest", helper: "Repeated low engagement. Stay polite, save energy." };
    case "Too early":
      return { label: "Too early · gather more", helper: "Not enough data yet. One more touchpoint to read direction." };
    default:
      return null;
  }
}

// Game Time briefing — AI signal only + relationship arc (notes).
// Auto-generates the AI read on open if not cached. Uses cached on later opens.
function PersonBriefing({ personId }: { personId: string }) {
  const data = usePeopleData();
  const person = data.people.find((p) => p.id === personId);
  const analyze = useServerFn(analyzeRelationship);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ranForRef = useRef<string | null>(null);

  const derived = useMemo(
    () => (person ? derivePerson(person, data.encounters) : null),
    [person, data.encounters],
  );
  const encounters = derived?.encounters ?? [];

  useEffect(() => {
    if (!person) return;
    if (person.aiSignal) return;
    if (encounters.length === 0) return; // nothing to analyze yet
    if (ranForRef.current === person.id) return;
    ranForRef.current = person.id;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = {
          person: {
            fullName: person.fullName,
            nameVariations: person.nameVariations,
            linkedInUrl: person.linkedInUrl ?? null,
            currentRole: person.currentRole ?? null,
            currentCompany: person.currentCompany ?? null,
            currentVertical: person.currentVertical ?? null,
          },
          encounters: encounters.map((e) => ({
            date: e.timestamp.slice(0, 10),
            conferenceName: e.conferenceName,
            repName: e.repId,
            temperature: e.temperature,
            roleAtTime: e.roleAtTime ?? null,
            companyAtTime: e.companyAtTime ?? null,
            note: e.note ?? null,
          })),
        };
        const out = await analyze({ data: payload });
        updatePerson(person.id, {
          aiSignal: out.signal,
          aiConfidence: out.confidence,
          aiReasoning: out.reasoning,
          aiNudge: out.nudge,
          aiArcSummary: out.arcSummary,
          aiGeneratedAt: new Date().toISOString(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to analyze");
      } finally {
        setLoading(false);
      }
    })();
  }, [person, encounters, analyze]);

  if (!person) return null;

  const tempColor = (t: Temperature) =>
    t === "hot" ? "bg-temp-hot shadow-[0_0_8px_var(--temp-hot)]"
      : t === "warm" ? "bg-temp-warm shadow-[0_0_8px_var(--temp-warm)]"
      : "bg-temp-cold";

  const signalTone =
    person.aiSignal === "Warming"
      ? "border-temp-hot/40 from-temp-hot/20 text-temp-hot"
      : person.aiSignal === "Steady"
      ? "border-temp-warm/40 from-temp-warm/20 text-temp-warm"
      : person.aiSignal === "Tire-kicker"
      ? "border-temp-cold/40 from-temp-cold/20 text-temp-cold"
      : "border-white/15 from-white/10 text-brand-base-foreground/70";

  const copyNudge = async () => {
    if (!person.aiNudge) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${person.aiNudge.subject}\n\n${person.aiNudge.body}`);
      toast.success("Nudge copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const action = signalAction(person.aiSignal);

  return (
    <div className="px-6 pb-4 pt-2 space-y-4">

      {/* AI Signal hero — action-oriented label, plain rationale */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent p-5",
        signalTone,
      )}>
        <div className="relative z-10">
          <div className="mb-2 flex items-center gap-2">
            <span className={cn(
              "h-2 w-2 rounded-full",
              person.aiSignal === "Warming" ? "bg-temp-hot animate-pulse" : "bg-current opacity-60",
            )} />
            <span className="text-[11px] font-black uppercase tracking-[0.15em]">
              {loading && !person.aiSignal
                ? "Analyzing relationship…"
                : action
                ? action.label
                : encounters.length === 0
                ? "First meeting · no signal yet"
                : "No signal yet"}
            </span>
          </div>
          {action && (
            <p className="mb-2 text-[11px] font-medium text-brand-base-foreground/60">
              {action.helper}
            </p>
          )}
          {person.aiReasoning ? (
            <p className="text-[15px] font-semibold leading-snug text-brand-base-foreground">
              {person.aiReasoning}
            </p>
          ) : loading ? (
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-white/10 animate-pulse" />
            </div>
          ) : error ? (
            <p className="text-xs text-temp-hot/80">{error}</p>
          ) : (
            <p className="text-xs text-brand-base-foreground/50">
              {encounters.length === 0
                ? "Log this encounter to start building context."
                : "Generating relationship read…"}
            </p>
          )}
          {person.aiConfidence && (
            <p className="mt-2 text-[10px] uppercase tracking-widest text-brand-base-foreground/40">
              AI confidence: {person.aiConfidence}
            </p>
          )}
        </div>
        <Zap className="pointer-events-none absolute -right-3 -bottom-3 h-24 w-24 opacity-10" />
      </div>


      {/* Relationship arc */}
      {encounters.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-base-foreground/40">
            Relationship arc
          </p>
          <div className="space-y-3">
            {encounters.slice(-3).reverse().map((e, idx, arr) => (
              <div key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className={cn("h-2.5 w-2.5 rounded-full", tempColor(e.temperature))} />
                  {idx < arr.length - 1 && <span className="my-1 w-px flex-1 bg-white/10" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-brand-base-foreground/90">
                      {e.conferenceName}
                    </span>
                    <span className="font-mono text-[10px] italic text-brand-base-foreground/40">
                      {new Date(e.timestamp).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                    </span>
                    <span className="text-[10px] text-brand-base-foreground/40">· {e.repId}</span>
                  </div>
                  {e.note && (
                    <p className="text-xs italic text-brand-base-foreground/50">"{e.note}"</p>
                  )}
                </div>
              </div>
            ))}
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
