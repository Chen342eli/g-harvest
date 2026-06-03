// src/lib/help-content.ts
// Help & docs content for Grain Harvest.
// Edit this file directly to change the Help center — no AI build needed.
//
// Doc bodies are written in light Markdown (## subheads, "-" lists,
// 4-space-indented code blocks). They read fine as plain text too; if you
// want them rendered richly, render `body` through a Markdown component
// (see note from Claude).

type FaqItem = { q: string; a: string };
type FaqGroup = { title: string; items: FaqItem[] };
type DocTopic = { id: string; title: string; body: string };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "Scoring & tiers",
    items: [
      {
        q: "Can I edit a conference's score?",
        a: "No. Scoring is owned by Sales Ops and is read-only in the UI, so the methodology stays consistent across the whole team. Hover any score to see the full breakdown of how it was reached.",
      },
      {
        q: "Why these weights?",
        a: "Vertical fit carries 40% because the question that matters most is whether an event actually reaches our buyer — fintech, payments, treasury. Everything else is secondary to that: decision-maker presence 25%, audience quality 15%, accessibility 10%, past performance 10%.",
      },
      {
        q: "What do Tier 1 / 2 / 3 mean?",
        a: "Tier 1 = score 70+ (go). Tier 2 = 40–69 (consider). Tier 3 = under 40 (likely pass).",
      },
      {
        q: "When is a coverage gap flagged?",
        a: "Only when a conference is marked Going and has no rep assigned. A conference you intentionally Passed is never flagged — that separates a real gap from a deliberate skip.",
      },
    ],
  },
  {
    title: "Leads & identity",
    items: [
      {
        q: "Why name + LinkedIn, and not email?",
        a: "Name and LinkedIn are stable identity anchors. Email breaks the moment someone changes companies — which is exactly the moment we care about most, since a move into an ICP company is a buying signal. So identity is never anchored on email.",
      },
      {
        q: "Does the AI match or merge people?",
        a: "No. Matching and dedup are deterministic: LinkedIn URL is the strongest anchor, with fuzzy name matching (including a nickname dictionary) and a company-match boost. The AI is reserved for discovery, follow-up drafting, and relationship-arc interpretation — never identity resolution.",
      },
      {
        q: "What's the difference between a 'Warming' lead and a 'Tire-kicker'?",
        a: "Those are AI signals derived from a person's encounter history across conferences. Warming = repeated, deepening contact; Tire-kicker = recurring but low-intent; plus Steady and Too early. Each comes with a confidence level, not a hard label.",
      },
    ],
  },
  {
    title: "Data & integrations",
    items: [
      {
        q: "Where does conference data come from?",
        a: "A manually verified seed set (e.g. Money20/20, EuroFinance, Sibos), augmented by an AI discovery agent (Firecrawl scrape + Gemini extraction). The agent adds new conferences and flags source changes, but never overwrites human edits.",
      },
      {
        q: "Is my data saved?",
        a: "Conferences persist to the backend (Lovable Cloud / Supabase). People and encounters currently live in your browser (localStorage); moving them to server-side persistence is on the roadmap.",
      },
      {
        q: "How does HubSpot work today?",
        a: "Through CSV import/export in the People workspace. A live HubSpot API sync is planned but not yet built.",
      },
      {
        q: "Why not just use HubSpot?",
        a: "HubSpot is the downstream system of record. Grain Harvest is the conference-intelligence layer that feeds it clean, deduplicated, prioritized leads. We don't rebuild the CRM.",
      },
    ],
  },
];

export const DOC_TOPICS: DocTopic[] = [
  {
    id: "overview",
    title: "Overview & architecture",
    body: `Grain Harvest is a sales-ops web app for a fintech sales team: decide which industry conferences to attend, plan rep coverage, capture leads on the floor, and follow up afterwards. It centres on three views of the same conference dataset — Table, Map, and Timeline — plus a People/Lead workspace powered by an identity engine called Lead Intelligence.

## Stack
- Framework: React 19.2 on TanStack Start v1.167 (full-stack React with file-based routing and server functions). Server build target is Cloudflare Workers via nitro.
- Language / build: TypeScript 5.8 (strict), Vite 7.3.
- Routing: TanStack Router file-based routes in src/routes/. routeTree.gen.ts is auto-generated; src/router.tsx instantiates the router with a shared QueryClient; src/routes/__root.tsx is the root layout.

## State management
- Server / async state: @tanstack/react-query paired with TanStack Start createServerFn RPC (src/lib/*.functions.ts).
- Client state: lightweight stores backed by useSyncExternalStore + localStorage (people-store, schedule-store, settings-store, hot-accounts-store, person-drawer-store).
- Backend: Lovable Cloud (Supabase), with browser and admin clients plus auth middleware registered in src/start.ts.

A server-side discovery agent (Firecrawl + Gemini via the Lovable AI Gateway) lives in src/lib/agent.server.ts and is exposed through the public route src/routes/api/public/agent/run.ts.`,
  },
  {
    id: "stack",
    title: "Tech stack & third-party services",
    body: `Every dependency was chosen to keep the app deployable with no manual API keys where possible.

## Core framework
- react / react-dom 19.2 — app runtime (React 19 required for TanStack Start v1).
- @tanstack/react-router 1.168 — type-safe file-based routing.
- @tanstack/react-start 1.167 — SSR shell + createServerFn RPC + server route handlers.
- @tanstack/react-query 5.83 — async cache for server-function calls and loaders.
- vite 7.3 — build/dev; nitro for the Cloudflare-Worker server entry.

## Styling & UI
- tailwindcss 4.2 — utility CSS. Tailwind v4 uses native CSS @import/@theme in src/styles.css, so there is no tailwind.config.js.
- Radix UI primitives, wrapped by shadcn-style components in src/components/ui/.
- class-variance-authority / clsx / tailwind-merge — variant + class merging (cn in src/lib/utils.ts).
- lucide-react — icon set (tree-shakable, matches Tailwind sizing).
- sonner — toasts.

## Maps (no API key required)
- leaflet 1.9 — map renderer, chosen because OpenStreetMap raster tiles need no key or billing.
- leaflet.markercluster 1.5 — clustering for overlapping pins (loaded at runtime from unpkg).
- Tiles: public OSM tiles. Geocoding: Nominatim (OSM), cached in localStorage.

## Forms / validation / dates
- react-hook-form + @hookform/resolvers — the Add/Edit touchpoint dialog.
- zod — schema validation (server inputs + form resolvers).
- date-fns — date formatting/arithmetic (timeline + table).

## AI / data ingestion
- @mendable/firecrawl-js — server-side scrape/search to discover conferences (key injected as a server env var).
- ai + @ai-sdk/openai-compatible — calls the Lovable AI Gateway (Gemini) for conference extraction and Relationship-AI nudges, so no model API key is needed in code.
- @supabase/supabase-js — Lovable Cloud backend (auth, persistence).
- HubSpot — CSV import/export only today; a live API sync is planned.

Fonts are system UI only; custom Grain typography is planned.`,
  },
  {
    id: "structure",
    title: "File & folder structure",
    body: `Key source files and what they hold:

    src/
    ├── styles.css                  Tailwind v4 + Grain theme tokens (oklch)
    ├── router.tsx                  createRouter({ routeTree, QueryClient })
    ├── routeTree.gen.ts            AUTO — do not edit
    ├── start.ts                    registers Supabase auth middleware
    ├── server.ts                   SSR entry wrapper
    ├── routes/
    │   ├── __root.tsx              root layout (html shell, Outlet)
    │   ├── index.tsx               landing → Conference Radar
    │   ├── planning.tsx            Conference Radar (Table / Map / Timeline host)
    │   ├── planning_.build.tsx     plan-builder sub-route
    │   ├── people.tsx              People / Leads workspace + HubSpot import/export
    │   ├── floor.tsx               on-the-floor 3-phase view (Before/During/After)
    │   ├── capture.tsx             quick-capture form (Game Time)
    │   ├── today.tsx               today's schedule
    │   ├── follow-ups.tsx          post-conference follow-up list
    │   ├── recap.tsx               per-conference recap
    │   ├── agent.tsx               agent status / runs UI
    │   ├── settings.tsx            active conference / rep / preferences
    │   ├── help.tsx                Help & docs (FAQ + Tech docs)
    │   └── api/public/agent/run.ts public POST endpoint for agent runs
    ├── components/
    │   ├── TopNav.tsx, SubNav.tsx, ContextSubNav.tsx
    │   ├── conference-radar/       ConferenceTable, MapView, TimelineView, ScoreCell,
    │   │                           TierBadge, StatusChip, CoverageMeters, DecisionPanel,
    │   │                           EditConferenceDialog, FilterBar, RepAssigner, …
    │   ├── floor/                  BeforePhase, DuringPhase, AfterPhase, GameTimeOverlay, …
    │   ├── people/                 PersonDetail, PersonDrawer, AddTouchpointDialog, Badges, …
    │   └── ui/                     shadcn-style Radix wrappers
    ├── lib/
    │   ├── conferences.ts          Conference types + SEED_CONFERENCES + scoring constants
    │   ├── scoring.ts              computeScoring() for AI-added rows
    │   ├── conferences.functions.ts serverFn: list/upsert conferences
    │   ├── people-types.ts         Person, Encounter, vertical enums, helpers
    │   ├── people-store.ts         localStorage-backed people/encounters store
    │   ├── matching.ts             Lead Intelligence: normalize/fuzzy/findMatch/badges
    │   ├── settings-store.ts       activeConferenceId, activeRepId
    │   ├── hubspot-import.ts, hubspot-export.ts
    │   ├── cityCoords.ts           static city table + Nominatim fallback
    │   ├── agent.server.ts         Firecrawl + Gemini discovery agent
    │   ├── relationship-ai.functions.ts  Gemini-powered nudges
    │   ├── ai-gateway.server.ts    Lovable AI Gateway provider
    │   └── help-content.ts         FAQ_GROUPS + DOC_TOPICS (this file)
    └── integrations/supabase/      client, auth middleware, generated DB types (AUTO)`,
  },
  {
    id: "data-model",
    title: "Data model",
    body: `Four core entities. Reps are not a class — they are strings drawn from SALES_TEAM in src/lib/conferences.ts, referenced by name in Conference.assignedReps and by id in Encounter.repId / Person.createdByRepId. The active rep is selected in settings-store.

## Conference (src/lib/conferences.ts)
Key fields: id, name, startDate, endDate, city, country, region, vertical, estimatedAudienceSize, tags, sourceUrl (the page scraped — provenance), officialUrl, subScores, icpScore, tier, assignedReps, status (Considering / Going / Passed).
subScores = { verticalFit, decisionMakerPresence, audienceQuality, accessibility, pastPerformance }.

## Person (src/lib/people-types.ts)
Stable identity: fullName, nameVariations[], linkedInUrl, email. Current state: currentCompany, currentRole, currentVertical. Provenance: createdAt, createdByRepId. AI fields: aiSignal (Warming / Tire-kicker / Steady / Too early), aiConfidence, aiReasoning, aiNudge, aiArcSummary, aiGeneratedAt. Plus followUpStatus.

## Encounter (src/lib/people-types.ts)
One meeting of a Person at a Conference by a Rep — the unit that reconstructs a relationship arc across events.
Fields: id, personId, conferenceId, conferenceName (snapshot), repId, timestamp, temperature (hot/warm/cold), vertical, title, note, companyAtTime, roleAtTime, captureMethod (manual/import).

The same file also exports DECISION_MAKER_KEYWORDS, isDecisionMakerRole, isIcpVertical, and ICP_VERTICALS = ["Payments","Fintech","Treasury"].`,
  },
  {
    id: "scoring",
    title: "Scoring engine",
    body: `Defined in src/lib/conferences.ts.

## Weights
- verticalFit 0.40
- decisionMakerPresence 0.25
- audienceQuality 0.15
- accessibility 0.10
- pastPerformance 0.10

computeScore(subScores) sums the weighted sub-scores to a rounded integer. tierFromScore(score): 70+ = Tier 1, 40+ = Tier 2, otherwise Tier 3. Both helpers are re-exported from src/lib/scoring.ts.

## Deriving sub-scores for AI-discovered conferences
src/lib/scoring.ts computeScoring() derives each sub-score deterministically from the extracted fields:
- verticalFit — per-vertical lookup (Cross-Border Payments 95; Payments / Treasury 90; …).
- audienceQuality — bucketed by size (10k+ → 85, … under 500 → 45).
- accessibility — Europe 85, NA 80, ME 72, APAC 58, LATAM 55.
- decisionMakerPresence — keyword heuristic on tags (CFO / treasurer / VP push it up).
- pastPerformance — currently fixed at 50 (HubSpot backfill is planned).

## Tooltip
src/components/conference-radar/ScoreCell.tsx renders the breakdown with a Radix Tooltip: one row per sub-score showing weight (%), a progress bar, and the value, behind a button showing the rounded total.`,
  },
  {
    id: "lead-intelligence",
    title: "Lead Intelligence",
    body: `All identity, dedup, and fuzzy logic lives in src/lib/matching.ts. It is deterministic by design — auditable, not a black box.

## Match strategy (findMatch)
1. LinkedIn URL is the strongest anchor. If both sides have a normalized linkedInUrl that matches, the result is "confident" and short-circuits.
2. Otherwise compute a fuzzy name similarity against fullName and every entry in nameVariations, keeping the best score.
3. Skip candidates scoring under 0.75. Add a +0.20 boost when normalized companies match.
4. Tiers: score 0.95+ with company match → "probable" (Name + company match); 0.85+ → "probable" (Strong name match); otherwise "possible"; no candidate → "none".

## Normalization
- Name: lowercase, strip non-letters, then map through a nickname dictionary (dan/danny → daniel, mike → michael, bob/rob → robert, …).
- Company: lowercase + strip non-alphanumerics.
- Token similarity: 1 − (Levenshtein / max length), averaged across best per-token matches.

## Name variants
When a matched person is seen under a new spelling, AddTouchpointDialog calls addNameVariation(personId, variant) so future searches recognise it.

## Badges (computeBadges)
returning (2+ encounters), cross-rep (2+ distinct reps), decision-maker (role matches keywords), icp-vertical (vertical in ICP set), moved-to-icp (latest encounter vertical is ICP and prior wasn't — a buying signal).

## Built vs planned
Built: normalization + nickname map, LinkedIn anchor, fuzzy name + company boost, name variations, badges, confidence tiers, dialog-driven match flow.
Planned: Clearbit/Apollo enrichment (measure ICP fit instead of inferring it), live HubSpot sync for cross-system identity, server-side persistence of the matching index (currently localStorage).`,
  },
  {
    id: "views",
    title: "The three conference views",
    body: `All three are hosted under src/routes/planning.tsx and read the same conference list (SEED_CONFERENCES, augmented by agent results). Filter/sort state and the selected detail row are owned by the route, so switching views preserves the user's query.

## Table (ConferenceTable.tsx)
shadcn Table primitive. Columns: name, tier, score (ScoreCell), dates, location, vertical, audience, assigned reps (RepAssigner), status (StatusChip). Row click opens ConferenceDetail.

## Map (MapView.tsx)
Leaflet inside a ClientOnly wrapper (SSR-safe). Leaflet + markercluster CSS/JS are injected at runtime from unpkg (no bundled import). Renders an OSM tile layer and a markerClusterGroup (maxClusterRadius 40). Pin colour comes from Tier; popups include an "Open in table" button; coverage gaps get a visual flag.

## Timeline (TimelineView.tsx)
Chronological list grouped by month with date-fns, reusing ScoreCell and TierBadge so the visual language stays consistent across views.`,
  },
  {
    id: "ai",
    title: "AI: discovery agent & Relationship-AI",
    body: `The AI is used for judgment and content, never for identity matching (that is deterministic — see Lead Intelligence).

## Discovery agent (src/lib/agent.server.ts)
Firecrawl scrapes/searches for conferences, then Gemini (via the Lovable AI Gateway) extracts structured fields. Each run does per-run dedup, resolves sourceUrl/officialUrl, rejects aggregator domains, and sets a needs_url_review flag where the source is uncertain. Crucially, in-run dedup only — existing rows in the database are never overwritten, so human edits are protected. Exposed at the public route /api/public/agent/run.

## Relationship-AI (src/lib/relationship-ai.functions.ts)
Gemini drafts a follow-up nudge, an arc summary, and a signal (Warming / Tire-kicker / Steady / Too early) with a confidence level — all derived from a person's encounter history.

## Governance
AI adds, never overwrites. Provenance is tracked via sourceUrl. Keys (Firecrawl, AI Gateway) are injected server-side and never exposed to client code.`,
  },
  {
    id: "design",
    title: "Design system",
    body: `Tailwind v4 with no tailwind.config.js — all tokens are CSS variables in src/styles.css, registered to utilities via an @theme inline block (so bg-brand-base, text-temp-hot, etc. work).

## Brand tokens (oklch)
- --brand-base: deep ink-navy, approx #15233B.
- --brand-accent: emerald-teal, approx #16B8A6.

## Traffic-light tokens (kept deliberately distinct from the teal accent, so urgency never collides with brand chrome)
- --temp-hot: red-orange, approx #E5503B.
- --temp-warm: amber, approx #E5A53C.
- --temp-cold: cool slate, approx #98A1B2.
- --signal-buying: ICP-green (moved-to-ICP).

These compile to classes (bg-brand-base, bg-temp-hot, text-temp-warm-foreground, bg-signal-buying) used by TierBadge, TempControls, StatusChip, and Badges. Leaflet popups use literal hex mirroring the same palette, because popups render outside the Tailwind class tree.

## Responsive
Mobile-first breakpoints (md:, lg:). Containers use max-w-[1200px] + px-6. The docs panel switches sidebar to a dropdown at the md breakpoint.`,
  },
  {
    id: "roadmap",
    title: "Build stages & roadmap",
    body: `Built in this order: (1) conference seed + scoring; (2) the three views sharing FilterBar state; (3) planning / coverage; (4) People + Lead Intelligence; (5) Floor mode (Before/During/After, Game Time capture, Hot Leads); (6) discovery agent (Firecrawl + Gemini), with in-run dedup and protected human edits; (7) HubSpot CSV import/export; (8) Add-touchpoint dialog; (9) Help & docs page.

## Planned — not yet built
- Enrichment (Clearbit / Apollo) — returns a verified vertical (and firmographics) per company, upgrading ICP fit from inferred to measured and raising the provenance of the dominant scoring factor from estimate to fact. Deferred because it needs external API keys, cost, persistence, and a real attendee list — so it sequences after discovery and lead capture stabilise.
- Past-performance backfill from HubSpot — pastPerformance is fixed at 50 until a live HubSpot API auth exists.
- Server-side persistence for People/Encounters — currently localStorage-only.
- Custom Grain typography — system UI fonts in use today.
- Per-user authentication & multi-tenant separation — present in template middleware, not yet exposed in the UI.

Principle: each deferred item maps to a clear dependency, or to the "no backend for People in the MVP" decision. Scope was a decision, not a limitation.`,
  },
  {
    id: "hosting",
    title: "Hosting & editing",
    body: `## Hosting
Published through Lovable to a stable URL (https://g-harvest.lovable.app). Clicking Publish redeploys the built TanStack Start app to the Cloudflare-Worker edge — nothing else is required.

## Backend
Lovable Cloud (Supabase) is provisioned and wired automatically; a non-developer never touches Supabase directly. Database changes go through Lovable's "View Backend" panel.

## Editing content (no developer needed)
- FAQ & technical docs: src/lib/help-content.ts (FAQ_GROUPS, DOC_TOPICS).
- Seed conferences & sales team: src/lib/conferences.ts (SEED_CONFERENCES, SALES_TEAM).
- Scoring weights / tier thresholds: SCORE_WEIGHTS and tierFromScore in src/lib/conferences.ts (mirrored in scoring.ts).
- Theme colours: src/styles.css (Grain tokens block).
- Nickname dictionary: NICKNAMES in src/lib/matching.ts.

## API keys (never committed)
Firecrawl and the AI Gateway keys are injected server-side via Lovable's Connectors / Cloud. Any future secret goes through Lovable settings → Secrets and is read via process.env inside a .server.ts file — never in client modules.`,
  },
];
