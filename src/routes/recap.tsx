import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { ActiveConferenceBar } from "@/components/conference-mode/ActiveConferenceBar";
import { useSettings, updateSettings } from "@/lib/settings-store";
import { usePeopleData } from "@/lib/people-store";
import { computeBadges } from "@/lib/matching";
import { TempDot } from "@/components/people/TempControls";
import { BadgeList } from "@/components/people/Badges";
import { SALES_TEAM } from "@/lib/conferences";
import { toast } from "sonner";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/recap")({
  head: () => ({ meta: [{ title: "End-of-day Recap · Conference Radar" }] }),
  component: RecapPage,
});

const TEMP_RANK = { hot: 0, warm: 1, cold: 2 } as const;

function RecapPage() {
  const settings = useSettings();
  const data = usePeopleData();
  const [sending, setSending] = useState(false);

  const rep = settings.activeRepId ?? SALES_TEAM[0] ?? "";
  const confId = settings.activeConferenceId;

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const items = useMemo(() => {
    const list = data.encounters
      .filter((e) => e.repId === rep && (!confId || e.conferenceId === confId))
      .filter((e) => e.timestamp.slice(0, 10) === selectedDate)
      .map((e) => {
        const person = data.people.find((p) => p.id === e.personId);
        if (!person) return null;
        const badges = computeBadges(person, data.encounters);
        const missing: string[] = [];
        if (!person.linkedInUrl) missing.push("LinkedIn");
        if (!e.note) missing.push("note");
        const buying = badges.some((b) => b.emphasis);
        return { encounter: e, person, badges, missing, buying };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    list.sort((a, b) => {
      const t = TEMP_RANK[a.encounter.temperature] - TEMP_RANK[b.encounter.temperature];
      if (t !== 0) return t;
      return Number(b.buying) - Number(a.buying);
    });
    return list;
  }, [data, rep, confId, selectedDate]);

  async function emailRecap() {
    if (!settings.resendApiKey || !settings.recapToEmail || !settings.resendFromEmail) {
      toast.error("Set Resend API key + emails in Settings first");
      return;
    }
    setSending(true);
    try {
      const html = renderHtml(rep, selectedDate, items);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.resendApiKey}`,
        },
        body: JSON.stringify({
          from: settings.resendFromEmail,
          to: [settings.recapToEmail],
          subject: `Conference Radar recap — ${rep} — ${selectedDate}`,
          html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Resend HTTP ${res.status}`);
      }
      toast.success("Recap emailed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <ActiveConferenceBar />



      <main className="mx-auto max-w-[900px] space-y-4 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Rep</span>
              <select value={rep} onChange={(e) => updateSettings({ activeRepId: e.target.value })} className="rounded-md border border-input bg-background px-2 py-1">
                {[...SALES_TEAM, "Yossi", "Dana", "Avi"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Date</span>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1" />
            </label>
          </div>
          <button
            type="button"
            onClick={emailRecap}
            disabled={sending || !items.length}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-base px-3 py-1.5 text-xs font-medium text-brand-base-foreground disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Email me this summary"}
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {items.length} encounter{items.length === 1 ? "" : "s"} on {selectedDate}
          {settings.activeConferenceName ? ` at ${settings.activeConferenceName}` : ""}.
        </p>

        <ul className="space-y-2">
          {items.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing captured for this rep + date.
            </li>
          )}
          {items.map(({ encounter, person, badges, missing, buying }) => (
            <li key={encounter.id} className={`rounded-lg border bg-card p-3 ${buying ? "border-signal-buying/50" : "border-border"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{person.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {person.currentRole ?? "—"}{person.currentCompany ? ` @ ${person.currentCompany}` : ""}
                  </div>
                </div>
                <TempDot t={encounter.temperature} size="md" />
              </div>
              <div className="mt-2"><BadgeList badges={badges} /></div>
              {encounter.note && <div className="mt-2 text-xs italic text-muted-foreground">"{encounter.note}"</div>}
              {missing.length > 0 && (
                <div className="mt-2 text-[11px] text-amber-700">⚠ Missing: {missing.join(", ")}</div>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function renderHtml(rep: string, date: string, items: Array<{
  encounter: import("@/lib/people-types").Encounter;
  person: import("@/lib/people-types").Person;
  badges: ReturnType<typeof computeBadges>;
}>) {
  const rows = items.map(({ encounter, person, badges }) => `
    <tr>
      <td><b>${person.fullName}</b><br/><span style="color:#666">${person.currentRole ?? ""} ${person.currentCompany ? "@ " + person.currentCompany : ""}</span></td>
      <td>${encounter.temperature.toUpperCase()}</td>
      <td>${badges.map((b) => `${b.icon} ${b.label}`).join(" · ")}</td>
      <td>${encounter.note ?? ""}</td>
    </tr>
  `).join("");
  return `
    <h2>Recap — ${rep} — ${date}</h2>
    <table cellpadding="8" style="border-collapse:collapse;width:100%;font-family:system-ui">
      <thead><tr style="background:#f5f5f5"><th align="left">Person</th><th>Temp</th><th align="left">Signals</th><th align="left">Note</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
