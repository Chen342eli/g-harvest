import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, FileText, HelpCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
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
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">FAQ &amp; Docs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Answers to common questions and the technical reference for how Grain Harvest works.
          </p>
        </header>

        <div className="mb-6 flex justify-center">
          <div
            role="tablist"
            aria-label="Help sections"
            className="inline-flex rounded-md border border-border bg-card p-1"
          >
            <TabButton active={tab === "faq"} onClick={() => setTab("faq")} controls="panel-faq" id="tab-faq">
              <HelpCircle className="h-3.5 w-3.5" /> FAQ
            </TabButton>
            <TabButton active={tab === "docs"} onClick={() => setTab("docs")} controls="panel-docs" id="tab-docs">
              <FileText className="h-3.5 w-3.5" /> Technical docs
            </TabButton>
          </div>
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
      className="grid grid-cols-1 gap-4 items-start sm:grid-cols-2 lg:grid-cols-3"
    >
      {FAQ_GROUPS.map((group) => (
        <div
          key={group.title}
          className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
        >
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {group.title}
            </h2>
          </div>
          <ul className="divide-y divide-border">
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
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
      >
        <span className="text-sm font-medium leading-snug text-foreground">{q}</span>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
          {a}
        </div>
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

      <aside className="hidden md:block">
        <nav
          aria-label="Technical docs topics"
          className="sticky top-20 space-y-1 rounded-lg border border-border bg-card p-2"
        >
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

      <article className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{active.title}</h2>
        <DocMarkdown body={active.body} />
      </article>
    </section>
  );
}

function DocMarkdown({ body }: { body: string }) {
  return (
    <div className="text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h2 className="mt-6 mb-2 text-base font-semibold tracking-tight text-foreground">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-4 mb-1.5 text-sm font-semibold text-foreground">{children}</h4>
          ),
          p: ({ children }) => <p className="my-3 text-foreground/90">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-3 ml-5 list-disc space-y-1.5 marker:text-muted-foreground">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-5 list-decimal space-y-1.5 marker:text-muted-foreground">{children}</ol>
          ),
          li: ({ children }) => <li className="text-foreground/90">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-brand-accent underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-[12.5px] leading-relaxed text-foreground whitespace-pre">
              {children}
            </pre>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
