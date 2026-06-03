import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, FileText, HelpCircle } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { cn } from "@/lib/utils";
import { DOC_TOPICS, FAQ_GROUPS } from "@/lib/help-content";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & docs · Grain Harvest" },
      { name: "description", content: "FAQ and technical documentation for the Grain Harvest Conference Radar." },
    ],
  }),
  component: HelpPage,
});

type Tab = "faq" | "docs";

function HelpPage() {
  const [tab, setTab] = useState<Tab>("faq");

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Help &amp; docs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Answers to common questions and the technical reference for how Grain Harvest works.
          </p>
        </header>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Help sections"
          className="mb-6 inline-flex rounded-md border border-border bg-card p-1"
        >
          <TabButton active={tab === "faq"} onClick={() => setTab("faq")} controls="panel-faq" id="tab-faq">
            <HelpCircle className="h-3.5 w-3.5" /> FAQ
          </TabButton>
          <TabButton active={tab === "docs"} onClick={() => setTab("docs")} controls="panel-docs" id="tab-docs">
            <FileText className="h-3.5 w-3.5" /> Technical docs
          </TabButton>
        </div>

        {tab === "faq" ? <FaqPanel /> : <DocsPanel />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  controls,
  id,
  children,
}: {
  active: boolean;
  onClick: () => void;
  controls: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-brand-base text-brand-base-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ---------- FAQ ----------

function FaqPanel() {
  return (
    <section
      role="tabpanel"
      id="panel-faq"
      aria-labelledby="tab-faq"
      className="space-y-8"
    >
      {FAQ_GROUPS.map((group) => (
        <div key={group.heading} className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {group.heading}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {group.items.map((item, idx) => (
              <FaqRow key={idx} q={item.q} a={item.a} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-muted/40"
      >
        <span className="text-sm font-medium text-foreground">{q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground">{a}</div>
      )}
    </li>
  );
}

// ---------- Technical docs ----------

function DocsPanel() {
  const [activeId, setActiveId] = useState<string>(DOC_TOPICS[0].id);
  const active = DOC_TOPICS.find((t) => t.id === activeId) ?? DOC_TOPICS[0];

  return (
    <section
      role="tabpanel"
      id="panel-docs"
      aria-labelledby="tab-docs"
      className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]"
    >
      {/* Mobile dropdown */}
      <div className="md:hidden">
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Topic
        </label>
        <select
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {DOC_TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:block">
        <nav aria-label="Technical docs topics" className="sticky top-20 space-y-1 rounded-lg border border-border bg-card p-2">
          {DOC_TOPICS.map((t) => {
            const on = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "block w-full rounded-md px-3 py-2 text-left text-xs font-medium transition",
                  on
                    ? "bg-brand-base text-brand-base-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t.title}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <article className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          {active.title}
        </h2>
        <div className="space-y-6">
          {active.sections.map((s, i) => (
            <div key={i} className="space-y-2">
              {s.heading && (
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {s.heading}
                </h3>
              )}
              {s.body && (
                <p className="text-sm leading-relaxed text-foreground">{s.body}</p>
              )}
              {s.bullets && s.bullets.length > 0 && (
                <ul className="ml-4 list-disc space-y-1.5 text-sm leading-relaxed text-foreground marker:text-muted-foreground">
                  {s.bullets.map((b, bi) => (
                    <li key={bi}>
                      {b.label && <span className="font-semibold">{b.label}:</span>}{" "}
                      <span className="text-muted-foreground">{b.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.outro && (
                <p className="text-sm leading-relaxed text-muted-foreground">{s.outro}</p>
              )}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
