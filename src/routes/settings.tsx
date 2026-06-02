import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useSettings, updateSettings } from "@/lib/settings-store";
import { resetSeed } from "@/lib/people-store";
import { listConferences } from "@/lib/conferences.functions";
import { DEMO_STATES, loadDemoState, type DemoState } from "@/lib/demo-data";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Conference Radar" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const s = useSettings();
  const fetchConfs = useServerFn(listConferences);
  const { data: conferences = [] } = useQuery({
    queryKey: ["conferences"],
    queryFn: () => fetchConfs(),
  });
  const [busy, setBusy] = useState<DemoState | null>(null);
  const [done, setDone] = useState<DemoState | null>(null);

  const handleLoadDemo = async (state: DemoState) => {
    setBusy(state);
    try {
      await loadDemoState(state, conferences);
      setDone(state);
      toast.success(
        state === "A"
          ? "Demo A loaded — conferences cleared, reloading…"
          : `Demo ${state} loaded — reloading…`,
      );
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setBusy(null);
      toast.error(`Failed to load demo ${state}`);
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto max-w-[680px] space-y-6 px-6 py-6">
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Demo data</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Force-overwrites all local people, encounters, hot accounts, schedule and the active
              conference / rep with one of three coherent snapshots. Use this to reset the demo to a
              known state.
            </p>
          </div>
          <div className="grid gap-2">
            {DEMO_STATES.map((d) => {
              const isBusy = busy === d.id;
              const isDone = done === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => handleLoadDemo(d.id)}
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3 text-left transition hover:border-foreground/40 disabled:opacity-60"
                >
                  <div>
                    <div className="text-sm font-semibold text-foreground">{d.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{d.desc}</div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {isDone ? (
                      <Check className="h-4 w-4 text-green-600" aria-label="Loaded" />
                    ) : isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Email recap (Resend)</h2>
          <p className="text-xs text-muted-foreground">
            Used by the end-of-day recap email. Get an API key at resend.com.
          </p>
          <label className="block text-xs">
            <span className="font-medium">Resend API key</span>
            <input
              type="password"
              value={s.resendApiKey ?? ""}
              onChange={(e) => updateSettings({ resendApiKey: e.target.value })}
              placeholder="re_xxx"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="block text-xs">
            <span className="font-medium">From email (verified Resend sender)</span>
            <input
              type="email"
              value={s.resendFromEmail ?? ""}
              onChange={(e) => updateSettings({ resendFromEmail: e.target.value })}
              placeholder="recap@yourdomain.com"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="font-medium">Recap recipient email</span>
            <input
              type="email"
              value={s.recapToEmail ?? ""}
              onChange={(e) => updateSettings({ recapToEmail: e.target.value })}
              placeholder="you@grainfinance.com"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Demo data</h2>
          <p className="text-xs text-muted-foreground">
            Wipes local people + encounters and re-seeds with the demo cast (Sarah, Marcus, Dan, Lena).
          </p>
          <button
            type="button"
            onClick={() => {
              resetSeed();
              toast.success("Seed data reset");
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          >
            Reset to seed
          </button>
        </section>
      </main>
    </div>
  );
}
