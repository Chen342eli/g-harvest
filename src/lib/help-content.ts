export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqGroup {
  heading: string;
  items: FaqItem[];
}

export interface DocSection {
  heading: string;
  body: string; // paragraph text
  bullets?: { label?: string; text: string }[];
  outro?: string;
}

export interface DocTopic {
  id: string;
  title: string;
  sections: DocSection[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    heading: "Scoring & tiers",
    items: [
      {
        q: "Can I edit a conference's score?",
        a: "No. Scoring is owned by Sales Ops and is read-only in the UI, so the methodology stays consistent across all 11 reps. Hover any score to see the full breakdown.",
      },
      {
        q: "Why these weights?",
        a: "ICP fit carries 40% because the question that matters most is whether an event reaches our buyer — fintech, payments, treasury. Everything else is secondary to that.",
      },
      {
        q: "What do Tier 1 / 2 / 3 mean?",
        a: "Tier 1 = score 70+ (green, go). Tier 2 = 40–69 (amber, consider). Tier 3 = under 40 (grey, likely pass).",
      },
      {
        q: "When is a coverage gap flagged?",
        a: "Only when a conference is marked Going and has no rep assigned. A conference you intentionally Passed is never flagged — that separates a real gap from a deliberate skip.",
      },
    ],
  },
  {
    heading: "Identity & data",
    items: [
      {
        q: "Why name + LinkedIn, and not email?",
        a: "Name and LinkedIn are stable identity anchors. Email breaks the moment someone changes companies — which is exactly the moment we care about most, since a move into an ICP company is a buying signal. So we never anchor identity on email.",
      },
      {
        q: "Does the AI capture leads or merge duplicates?",
        a: "No. Matching and dedup are deterministic lookups (name + LinkedIn, with fuzzy matching for name variants). The AI is reserved for interpretation and drafting, not identity resolution.",
      },
      {
        q: "Where does conference data come from?",
        a: "A manually verified seed set today (Money20/20, EuroFinance, Sibos confirmed; others are sample values). Long term, an AI discovery agent maintains the database.",
      },
    ],
  },
  {
    heading: "Scope & integrations",
    items: [
      {
        q: "Why not just use HubSpot?",
        a: "HubSpot is the system of record downstream. This tool is the conference-intelligence layer that feeds it clean, deduplicated, prioritized leads. We don't rebuild the CRM.",
      },
      {
        q: "Is my data saved?",
        a: "The MVP runs without a backend, so data lives in the session. Persistence (e.g., Supabase) is on the roadmap.",
      },
    ],
  },
];

export const DOC_TOPICS: DocTopic[] = [
  {
    id: "data-model",
    title: "1. Data model (the spine)",
    sections: [
      {
        heading: "Four core entities",
        body: "Conferences, People, Encounters, Reps.",
        bullets: [
          {
            label: "Conference",
            text: "name, start/end dates, city/country/region, vertical, estimated audience size, tags, source URL, ICP score + five sub-scores, tier, assigned reps, decision status (Considering / Going / Passed).",
          },
          {
            label: "Person",
            text: "identity anchored on name + LinkedIn; plus company, title, captured-at, source conference.",
          },
          {
            label: "Encounter",
            text: "one meeting of a Person at a Conference by a Rep — the unit that reconstructs a relationship arc across events.",
          },
          { label: "Rep", text: "one of 11, assignable to conferences." },
        ],
        outro:
          "The Encounter entity is what turns three separate meetings into one person's history — the basis for cross-conference (and cross-rep) interpretation.",
      },
    ],
  },
  {
    id: "scoring",
    title: "2. Scoring methodology & data provenance",
    sections: [
      {
        heading: "A weighted 0–100 sum",
        body: "Owned by Sales Ops, read-only in the UI:",
        bullets: [
          { label: "Vertical fit — 40%", text: "source: event theme. Public fact, reliable." },
          {
            label: "Decision-maker presence — 25%",
            text: "source: proxy (speakers / target audience). Estimate, lower confidence.",
          },
          {
            label: "Audience size & quality — 15%",
            text: "size is public; quality is derived from vertical fit.",
          },
          { label: "Accessibility — 10%", text: "from location / region. Fact." },
          {
            label: "Past performance — 10%",
            text: "internal (HubSpot); starts neutral (default 50).",
          },
        ],
        outro:
          "Each factor carries a provenance flag (fact vs. estimate), so it's transparent how much of a score rests on hard data versus inference. Tiers: 70+, 40–69, under 40.",
      },
    ],
  },
  {
    id: "identity",
    title: "3. Identity & matching engine",
    sections: [
      {
        heading: "Deterministic by design",
        body: "Identity anchors on name + LinkedIn (stable). Email is non-anchoring because it breaks on a job change — the exact event we want to catch. Matching is a deterministic lookup with fuzzy matching for name variants (Danny/Daniel) and typos; dedup collapses multiple encounters into one card with full history. This is lookup, not AI — kept deterministic so it stays auditable. Cross-conference is also cross-rep: with 11 reps, the same target is often met by different people, and the engine surfaces that.",
      },
    ],
  },
  {
    id: "ai-governance",
    title: "4. AI feature & data governance",
    sections: [
      {
        heading: "Judgment, not capture",
        body: "The AI is reserved for judgment, not capture or dedup. Two roles: (a) a conference-discovery agent that sources and maintains the database; (b) interpretation of a person's relationship arc plus nudge drafting (warming vs. tire-kicker).",
      },
      {
        heading: "Governance",
        body: "",
        bullets: [
          { label: "New conference", text: "the AI adds it automatically and alerts by email." },
          {
            label: "Existing conference",
            text: "the AI never overwrites; it only detects a change at the source and flags it for a human to decide.",
          },
          { text: "Human edits are protected." },
          {
            label: "Delete",
            text: "soft-delete plus a \"don't resurrect\" tombstone list (key: name + year), so a removed event doesn't reappear on the next scan.",
          },
          {
            text: "Every record carries a provenance flag (verified / ai_added) for display and triage.",
          },
        ],
      },
    ],
  },
  {
    id: "scope",
    title: "5. Scope decisions — built vs. deferred (and why)",
    sections: [
      {
        heading: "Built (MVP)",
        body: "Conference management (table / map / timeline views), ICP scoring + tiers + breakdown tooltip, rep assignment + coverage-gap flag, decision status, manual add / edit / delete.",
      },
      {
        heading: "Deferred, and why",
        body: "",
        bullets: [
          {
            label: "AI discovery agent + weekly email",
            text: "this is the AI feature and the real data source; built alongside the agent, not before it.",
          },
          {
            label: "Company enrichment (Clearbit / Apollo)",
            text: "pulls a verified vertical (and firmographics) per company, upgrading ICP fit from inferred to measured and raising the provenance of the dominant scoring factor from estimate to fact. Requires external API keys, cost, persistence, and an attendee list to enrich — so it sequences after discovery + lead capture.",
          },
          { text: "Past-performance backfill from HubSpot." },
          { text: "Persistence (Supabase)." },
        ],
        outro:
          "Principle: scope was a decision, not a limitation — every deferred item maps to a clear dependency or to \"no backend in the MVP.\"",
      },
    ],
  },
];
