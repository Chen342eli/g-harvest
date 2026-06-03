import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Flame, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { findMatch } from "@/lib/matching";
import {
  usePeopleData,
  addPerson,
  addEncounter,
  updateEncounter,
  addNameVariation,
  updatePerson,
  generateId,
} from "@/lib/people-store";
import type { Encounter, EncounterVertical, Person, Temperature } from "@/lib/people-types";
import { ENCOUNTER_VERTICALS } from "@/lib/people-types";
import { useSettings } from "@/lib/settings-store";
import { useHotAccounts, isHotAccountCompany } from "@/lib/hot-accounts-store";
import { listConferences } from "@/lib/conferences.functions";
import { SALES_TEAM } from "@/lib/conferences";
import { cn } from "@/lib/utils";

type Step = "search" | "form";
type Mode = "existing" | "new";

interface Draft {
  mode: Mode;
  personId?: string;
  name: string;
  company: string;
  role: string;
  linkedInUrl: string;
  email: string;
}

const EMPTY_DRAFT: Draft = {
  mode: "new",
  name: "",
  company: "",
  role: "",
  linkedInUrl: "",
  email: "",
};

export interface AddTouchpointDialogProps {
  /** Controlled open state. When omitted, the dialog manages its own state and renders its default trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Skip the search step and go straight to editing for this person. */
  initialPersonId?: string;
  /** If provided, the form edits this existing encounter instead of creating a new one. */
  initialEncounterId?: string;
  /** Hide the built-in trigger (useful when controlled from outside). */
  hideTrigger?: boolean;
}

export function AddTouchpointDialog({
  open: controlledOpen,
  onOpenChange,
  initialPersonId,
  initialEncounterId,
  hideTrigger,
}: AddTouchpointDialogProps = {}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const settings = useSettings();
  const data = usePeopleData();
  const accounts = useHotAccounts();
  const fetchConfs = useServerFn(listConferences);
  const { data: conferences = [] } = useQuery({
    queryKey: ["conferences"],
    queryFn: () => fetchConfs(),
    enabled: open,
  });

  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [temperature, setTemperature] = useState<Temperature | null>(null);
  const [vertical, setVertical] = useState<EncounterVertical | "">("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [conferenceId, setConferenceId] = useState<string>("");
  const [repId, setRepId] = useState<string>("");
  const [encounterId, setEncounterId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const isEditing = !!encounterId;

  // Initialize on open
  useEffect(() => {
    if (!open) return;
    const initialPerson = initialPersonId
      ? data.people.find((p) => p.id === initialPersonId)
      : null;
    const initialEnc = initialEncounterId
      ? data.encounters.find((e) => e.id === initialEncounterId)
      : null;

    if (initialPerson) {
      setDraft({
        mode: "existing",
        personId: initialPerson.id,
        name: initialPerson.fullName,
        company: initialEnc?.companyAtTime ?? initialPerson.currentCompany ?? "",
        role: initialEnc?.roleAtTime ?? initialPerson.currentRole ?? "",
        linkedInUrl: initialPerson.linkedInUrl ?? "",
        email: initialPerson.email ?? "",
      });
      setVertical(
        (initialEnc?.vertical ?? initialPerson.currentVertical ?? "") as EncounterVertical | "",
      );
      setTemperature(initialEnc?.temperature ?? null);
      setTitle(initialEnc?.title ?? "");
      setNote(initialEnc?.note ?? "");
      setConferenceId(initialEnc?.conferenceId ?? settings.activeConferenceId ?? "");
      setRepId(initialEnc?.repId ?? settings.activeRepId ?? SALES_TEAM[0] ?? "");
      setEncounterId(initialEnc?.id ?? null);
      setStep("form");
    } else {
      setStep("search");
      setQuery("");
      setDraft(EMPTY_DRAFT);
      setTemperature(null);
      setVertical("");
      setTitle("");
      setNote("");
      setConferenceId(settings.activeConferenceId ?? "");
      setRepId(settings.activeRepId ?? SALES_TEAM[0] ?? "");
      setEncounterId(null);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPersonId, initialEncounterId]);

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
      linkedInUrl: p.linkedInUrl ?? "",
      email: p.email ?? "",
    });
    setVertical((p.currentVertical as EncounterVertical | undefined) ?? "");
    setStep("form");
  }

  function openNew() {
    setDraft({ ...EMPTY_DRAFT, mode: "new", name: query.trim() });
    setVertical("");
    setStep("form");
  }

  const conferenceName =
    conferences.find((c) => c.id === conferenceId)?.name ??
    settings.activeConferenceName ??
    "";

  const canSave =
    !!temperature &&
    !!conferenceId &&
    !!repId &&
    draft.name.trim().length > 0;

  function save() {
    if (!canSave || !temperature) return;
    const timestamp = new Date().toISOString();

    let personId: string;
    let person: Person | undefined;

    if (draft.mode === "existing" && draft.personId) {
      personId = draft.personId;
      const existing = data.people.find((p) => p.id === draft.personId);
      if (!existing) {
        toast.error("Person no longer exists");
        return;
      }
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
      if (draft.linkedInUrl && draft.linkedInUrl !== existing.linkedInUrl) patch.linkedInUrl = draft.linkedInUrl;
      if (draft.email && draft.email !== existing.email) patch.email = draft.email;
      if (Object.keys(patch).length) updatePerson(personId, patch);
    } else {
      personId = generateId();
      person = {
        id: personId,
        fullName: draft.name.trim(),
        nameVariations: [],
        currentCompany: draft.company || undefined,
        currentRole: draft.role || undefined,
        currentVertical: (vertical || undefined) as EncounterVertical | undefined,
        linkedInUrl: draft.linkedInUrl || undefined,
        email: draft.email || undefined,
        createdAt: timestamp,
        createdByRepId: repId,
        followUpStatus: "pending",
      };
      addPerson(person);
    }

    if (isEditing && encounterId) {
      const patch: Partial<Encounter> = {
        conferenceId,
        conferenceName: conferenceName || "Conference",
        repId,
        temperature,
        vertical: (vertical || undefined) as EncounterVertical | undefined,
        title: title || undefined,
        note: note || undefined,
        companyAtTime: draft.company || person?.currentCompany,
        roleAtTime: draft.role || person?.currentRole,
      };
      updateEncounter(encounterId, patch);
      toast.success(`Touchpoint updated: ${draft.name}`);
    } else {
      addEncounter({
        id: generateId(),
        personId,
        conferenceId,
        conferenceName: conferenceName || "Conference",
        repId,
        timestamp,
        temperature,
        vertical: (vertical || undefined) as EncounterVertical | undefined,
        title: title || undefined,
        note: note || undefined,
        companyAtTime: draft.company || person?.currentCompany,
        roleAtTime: draft.role || person?.currentRole,
        captureMethod: "manual",
      });
      const hot = isHotAccountCompany(draft.company || person?.currentCompany, accounts);
      toast.success(
        `${draft.mode === "existing" ? "Touchpoint added" : "Lead created"}: ${draft.name}${hot ? " 🔥" : ""}`,
      );
    }
    setOpen(false);
  }

  const dialogTitle = step === "search"
    ? "Add person or touchpoint"
    : isEditing
    ? "Edit touchpoint"
    : draft.mode === "existing"
    ? "New touchpoint"
    : "New lead + touchpoint";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-transparent bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90"
            title="Add a person or log a new touchpoint"
          >
            <Plus className="h-3.5 w-3.5" />
            Add person / touchpoint
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="text-sm font-semibold">{dialogTitle}</DialogTitle>
        </DialogHeader>

        {step === "search" ? (
          <div className="p-5 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim().length >= 2) {
                    e.preventDefault();
                    if (matchedPerson) openExisting(matchedPerson);
                    else openNew();
                  }
                }}
                placeholder="Type a name to search or create…"
                className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base"
                autoComplete="off"
              />
            </div>

            {query.trim().length >= 2 && (
              <div className="space-y-2">
                {matchedPerson && (
                  <button
                    type="button"
                    onClick={() => openExisting(matchedPerson)}
                    className="flex w-full items-start justify-between gap-3 rounded-md border border-border bg-card p-3 text-left transition hover:border-foreground/30 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="truncate">↩ {matchedPerson.fullName}</span>
                        {isHotAccountCompany(matchedPerson.currentCompany, accounts) && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-temp-hot/15 px-1.5 py-0.5 text-[10px] font-medium text-temp-hot">
                            <Flame className="h-2.5 w-2.5" /> Hot
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[matchedPerson.currentRole, matchedPerson.currentCompany].filter(Boolean).join(" @ ") || "—"}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Add touchpoint · match: {match!.confidence}
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={openNew}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-dashed border-border p-3 text-left transition hover:border-foreground/30 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <UserPlus className="h-3.5 w-3.5" />
                      Create new lead: <span className="font-semibold">"{query.trim()}"</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {matchedPerson ? "Not the same person? Create new." : "No match found."}
                    </div>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            )}

            {query.trim().length < 2 && (
              <p className="text-xs text-muted-foreground">
                Search existing people to log a new touchpoint, or create a new lead.
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
            {/* Identity */}
            <div className="space-y-2">
              <Field label="Full name *">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Job title / role">
                  <input
                    value={draft.role}
                    onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                    placeholder="e.g. Head of Treasury"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </Field>
                <Field label="Company">
                  <input
                    value={draft.company}
                    onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Email">
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </Field>
                <Field label="LinkedIn URL">
                  <input
                    value={draft.linkedInUrl}
                    onChange={(e) => setDraft({ ...draft, linkedInUrl: e.target.value })}
                    placeholder="linkedin.com/in/…"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </Field>
              </div>
              <Field label="Vertical">
                <div className="flex flex-wrap gap-1.5">
                  {ENCOUNTER_VERTICALS.map((v) => {
                    const on = vertical === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVertical(on ? "" : v)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                          on
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                        )}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <div className="h-px bg-border" />

            {/* Touchpoint */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Conference *">
                  <select
                    value={conferenceId}
                    onChange={(e) => setConferenceId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {conferences.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Rep *">
                  <select
                    value={repId}
                    onChange={(e) => setRepId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {SALES_TEAM.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Meeting title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='e.g. "Booth chat — cross-border payouts"'
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </Field>

              <Field label="Today's read *">
                <div className="grid grid-cols-3 gap-2">
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
                          "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition active:scale-[0.98]",
                          active ? tone : "border-border bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <span>{t === "hot" ? "🔥" : t === "warm" ? "☀️" : "❄️"}</span>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Note">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="What did they say? What's the hook?"
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>

              {isHotAccountCompany(draft.company, accounts) && (
                <div className="rounded-md border border-temp-hot/40 bg-temp-hot/10 px-3 py-2 text-xs font-medium text-foreground">
                  <Flame className="mr-1 inline h-3 w-3 text-temp-hot" />
                  Hot Account — auto-flagged
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {isEditing || initialPersonId ? (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep("search")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                disabled={!canSave}
                onClick={save}
                className={cn(
                  "rounded-md px-4 py-2 text-xs font-semibold transition",
                  canSave
                    ? "bg-foreground text-background hover:opacity-90"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {canSave ? (isEditing ? "Save changes" : "Save touchpoint") : "Fill required *"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
