import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeScore,
  tierFromScore,
  DECISION_STATUSES,
  REGIONS,
  VERTICALS,
  SALES_TEAM,
  WEIGHT_LABELS,
  type Conference,
  type DecisionStatus,
  type Region,
  type Vertical,
  type SubScores,
} from "@/lib/conferences";
import { TierBadge } from "./TierBadge";
import { cn } from "@/lib/utils";

interface Props {
  conference: Conference | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: Conference) => void;
}

type FormState = {
  name: string;
  startDate: string;
  endDate: string;
  city: string;
  country: string;
  region: Region;
  vertical: Vertical;
  estimatedAudienceSize: string;
  tagsCsv: string;
  sourceUrl: string;
  status: DecisionStatus;
  subScores: SubScores;
  assignedReps: string[];
};

function toForm(c: Conference): FormState {
  return {
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    city: c.city,
    country: c.country,
    region: c.region,
    vertical: c.vertical,
    estimatedAudienceSize: String(c.estimatedAudienceSize),
    tagsCsv: c.tags.join(", "),
    sourceUrl: c.sourceUrl,
    status: c.status,
    subScores: { ...c.subScores },
    assignedReps: [...c.assignedReps],
  };
}

const SUB_KEYS: (keyof SubScores)[] = [
  "verticalFit",
  "decisionMakerPresence",
  "audienceQuality",
  "accessibility",
  "pastPerformance",
];

export function EditConferenceDialog({ conference, open, onOpenChange, onSave }: Props) {
  const [form, setForm] = useState<FormState | null>(conference ? toForm(conference) : null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && conference) {
      setForm(toForm(conference));
      setErrors({});
    }
  }, [open, conference]);

  const liveScore = useMemo(() => (form ? computeScore(form.subScores) : 0), [form]);
  const liveTier = useMemo(() => tierFromScore(liveScore), [liveScore]);

  if (!form || !conference) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const updateSub = (k: keyof SubScores, v: number) =>
    setForm((f) => (f ? { ...f, subScores: { ...f.subScores, [k]: v } } : f));

  const toggleRep = (rep: string) =>
    setForm((f) =>
      f
        ? {
            ...f,
            assignedReps: f.assignedReps.includes(rep)
              ? f.assignedReps.filter((r) => r !== rep)
              : [...f.assignedReps, rep],
          }
        : f,
    );

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Required";
    else if (form.name.length > 200) e.name = "Too long";
    if (!form.startDate) e.startDate = "Required";
    if (!form.endDate) e.endDate = "Required";
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = "End must be after start";
    if (!form.city.trim()) e.city = "Required";
    if (!form.country.trim()) e.country = "Required";
    const aud = Number(form.estimatedAudienceSize);
    if (!Number.isFinite(aud) || aud < 0) e.estimatedAudienceSize = "Must be ≥ 0";
    if (form.sourceUrl) {
      try {
        new URL(form.sourceUrl);
      } catch {
        e.sourceUrl = "Invalid URL";
      }
    }
    for (const k of SUB_KEYS) {
      const v = form.subScores[k];
      if (!Number.isFinite(v) || v < 0 || v > 100) e[`sub_${k}`] = "0–100";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const icpScore = computeScore(form.subScores);
    const tier = tierFromScore(icpScore);
    const updated: Conference = {
      ...conference,
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      city: form.city.trim(),
      country: form.country.trim(),
      region: form.region,
      vertical: form.vertical,
      estimatedAudienceSize: Math.round(Number(form.estimatedAudienceSize)),
      tags: form.tagsCsv
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sourceUrl: form.sourceUrl.trim(),
      status: form.status,
      subScores: { ...form.subScores },
      assignedReps: [...form.assignedReps],
      icpScore,
      tier,
    };
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit conference</DialogTitle>
          <DialogDescription>
            Update any field. ICP score &amp; tier recompute from the sub-scores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field label="Name" error={errors.name}>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={200} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" error={errors.startDate}>
              <Input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            </Field>
            <Field label="End date" error={errors.endDate}>
              <Input type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="City" error={errors.city}>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} maxLength={100} />
            </Field>
            <Field label="Country" error={errors.country}>
              <Input value={form.country} onChange={(e) => update("country", e.target.value)} maxLength={100} />
            </Field>
            <Field label="Region">
              <Select value={form.region} onValueChange={(v) => update("region", v as Region)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vertical">
              <Select value={form.vertical} onValueChange={(v) => update("vertical", v as Vertical)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VERTICALS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Audience size" error={errors.estimatedAudienceSize}>
              <Input
                type="number"
                min={0}
                value={form.estimatedAudienceSize}
                onChange={(e) => update("estimatedAudienceSize", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Tags (comma-separated)">
            <Input value={form.tagsCsv} onChange={(e) => update("tagsCsv", e.target.value)} />
          </Field>

          <Field label="Source URL" error={errors.sourceUrl}>
            <Input
              type="url"
              value={form.sourceUrl}
              onChange={(e) => update("sourceUrl", e.target.value)}
              maxLength={500}
            />
          </Field>

          <Field label="Decision status">
            <Select value={form.status} onValueChange={(v) => update("status", v as DecisionStatus)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DECISION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sub-scores (0–100)
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Live:</span>
                <span className="rounded-md bg-secondary px-2 py-0.5 font-semibold tabular-nums text-secondary-foreground">
                  {liveScore}
                </span>
                <TierBadge tier={liveTier} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {SUB_KEYS.map((k) => (
                <Field key={k} label={WEIGHT_LABELS[k]} error={errors[`sub_${k}`]}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.subScores[k]}
                    onChange={(e) => updateSub(k, Number(e.target.value))}
                  />
                </Field>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assigned reps
            </Label>
            <div className="mt-2 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border bg-card p-2">
              {SALES_TEAM.map((rep) => {
                const checked = form.assignedReps.includes(rep);
                return (
                  <label
                    key={rep}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted",
                      checked && "bg-muted",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRep(rep)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-foreground">{rep}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error && <div className="text-[11px] text-red-600">{error}</div>}
    </div>
  );
}
