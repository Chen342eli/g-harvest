import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { useSettings, updateSettings } from "@/lib/settings-store";
import { resetSeed } from "@/lib/people-store";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Conference Radar" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const s = useSettings();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">API keys are stored locally only (localStorage).</p>
          </div>
          <TopNav />
        </div>
      </header>

      <main className="mx-auto max-w-[680px] space-y-6 px-6 py-6">
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
