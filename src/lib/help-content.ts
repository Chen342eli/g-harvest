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
    title: "Lead Intelligence",
    items: [
      {
        q: `How does the relationship AI actually work? What does it see?`,
        a: `A server-side function sends the model the person's current role and company plus the full encounter history in chronological order — for each meeting: date, conference, rep, the temperature the rep logged, and their role-and-company at that time. That chronology is the whole point: it lets the model read direction of travel, not a snapshot. It returns a Signal, a confidence level, a one-to-two-sentence reason citing the specific evidence, a calibrated follow-up email, and a short cross-conference arc summary — as strict JSON we validate before trusting it.`,
      },
      {
        q: `Why is the Signal an AI feature and not just a rule?`,
        a: `You could write a rule for "three cold meetings = tire-kicker," but not one for trajectory. "Is this relationship warming or stalling?" is a read across role change, company fit, temperature trend, and cadence at once — and the meaning of any one of them depends on the others. A promotion into our ICP means something different on a rising temperature than on a flat one. Synthesizing that into a verdict plus a reason a human can read is exactly what a language model is good at and a rules engine is bad at. That is why AI is reserved for this one job.`,
      },
      {
        q: `How do you stop it from being confidently wrong?`,
        a: `Three guardrails. First, the structural facts it reasons over — returning count, cross-rep, moved-to-ICP — are computed deterministically in code, so the model interprets real facts, it does not invent them. Second, it must cite the specific evidence in its reasoning, so a wrong verdict is visible and a rep can override it. Third, and most important: it is a suggestion, not an action. A wrong "Warming" costs one friendly email; a wrong "Tire-kicker" just deprioritizes someone we can recover. The human stays in the loop by design — which is also why it never auto-sends.`,
      },
      {
        q: `How do you handle the same person met by two reps, name variations, and job changes?`,
        a: `Identity is handled by Lead Intelligence — a lookup, not a judgment, so it is deterministic code, not AI. The anchor is the LinkedIn URL, because names and especially emails change exactly when it matters most — on a job move. Same LinkedIn collapses "Dan" and "Daniel" into one record; a promotion between events updates that same record instead of creating a duplicate; and when two reps capture the same person, we flag it cross-rep — surfacing that nobody on the team knew they were both working the same contact.`,
      },
      {
        q: `Why LinkedIn and not email as the identity anchor?`,
        a: `Email is the least stable identifier for a B2B contact — it breaks the moment someone changes jobs, which is the single most important event we are trying to detect. LinkedIn URLs are stable across job changes, which is exactly when we most need to keep the thread connected.`,
      },
      {
        q: `What about people with no LinkedIn?`,
        a: `No LinkedIn falls back to fuzzy name matching — normalized names, a nickname table, a similarity score, with a company match as a tiebreaker — and crucially it returns a graded confidence ("probable," "possible"), not a silent merge. High thresholds plus the company signal keep false merges rare, and because matches are graded rather than forced, an uncertain one can be reviewed rather than auto-merged. Lead Intelligence is tuned to under-merge rather than over-merge — a missed link is recoverable, a wrong merge corrupts two records.`,
      },
    ],
  },
  {
    title: "The discovery agent",
    items: [
      {
        q: `How does the discovery agent work?`,
        a: `It is a real server-side agent that runs in stages. Firecrawl runs a set of search queries across our verticals — payments, treasury, embedded finance, neobank, cross-border — and across regions, for this year and next, and scrapes the result pages; its key is supplied through Lovable's Connectors, never in client code. Gemini then does structured extraction into a strict schema: name, dates, city, country, region, vertical, audience size, tags. A relevance gate asks the model whether the audience actually includes CFOs, heads of payments, treasury, or product at PSPs, neobanks, marketplaces and the like — which filters out blog posts, listicles, and past editions. What survives is scored by the same weighting formula and tier thresholds as the seed conferences, deduped by normalized URL, and written with a provenance flag.`,
      },
      {
        q: `Does it run once, or continuously?`,
        a: `On first use it does the heavy initial load, populating the radar with everything relevant. After that it is scheduled to run weekly, adding newly-announced events and updating details on existing ones, and you can see every run in its history log: added, flagged, skipped. The natural next step is a weekly digest email — "here are three new events worth your attention."`,
      },
      {
        q: `Scraping is messy — how do you handle bad or hallucinated data?`,
        a: `Two defenses. If a field is not certain from the page, the model is allowed to return null and we keep the conference anyway, flagged for human review rather than dropped or guessed. And every AI-found entry carries an ai_added provenance flag, so it is visibly distinct from verified data and a human edit is never silently overwritten. The agent's job is to surface candidates fast; the human confirms. We would rather flag a maybe than miss a real event or invent a fake one.`,
      },
      {
        q: `Two AI features — isn't that scope creep?`,
        a: `They answer two different jobs the brief named: one finds conferences we do not know about, the other reads relationships. Both pass the same test — is AI doing work a human would otherwise do by hand and that code cannot do well? Manually trawling the web for fintech events, and manually reading a contact's arc across a year of meetings, are exactly those jobs. Everything between them — scoring, matching — is deliberately not AI.`,
      },
    ],
  },
  {
    title: "Scoring & prioritization",
    items: [
      {
        q: `Why is scoring deterministic and not AI?`,
        a: `Because "rank these conferences by fit" is a transparent, repeatable judgment that Sales Ops needs to own and explain — not a black box. A weighted formula can be defended in a budget meeting; "the AI said so" cannot. It is also not editable by reps, so the ranking cannot be gamed to justify a trip someone already wants to take.`,
      },
      {
        q: `How did you choose the weights — 40/25/15/10/10?`,
        a: `The thesis is depth of fit over breadth of crowd, because Grain's ICP is narrow. So vertical fit is the biggest lever at 40% — a cross-border-payments event simply matters more than a generic fintech one. Decision-maker presence at 25%, because a room full of analysts is not pipeline. Audience quality 15%, accessibility — basically travel cost — 10%, and past performance 10%. There is no single right answer here; this is mine, and it is transparent enough to argue with and tune.`,
      },
      {
        q: `You called decision-maker presence a "low-confidence proxy" — isn't it risky to give a weak signal 25%?`,
        a: `Yes, and I flagged it honestly rather than pretending it is precise. It is inferred from the event's tags — "CFO," "treasurer," "head of" — which is a real signal but not a guarantee. I would rather weight the right thing imperfectly than the wrong thing precisely. The fix is on the roadmap: once we have HubSpot history, past performance — which conferences actually produced pipeline — should grow and partly replace the proxy.`,
      },
      {
        q: `Past performance starts at a neutral 50 — doesn't that distort new conferences?`,
        a: `It is deliberately neutral so a brand-new event is not punished for having no history — it competes on the other four factors until we learn. As we accumulate real outcomes, that 10% becomes evidence-based and the ranking gets sharper. It is an honest "we don't know yet" rather than a fake zero or a fake high.`,
      },
    ],
  },
  {
    title: "HubSpot & integrations",
    items: [
      {
        q: `Why CSV and not a live API push?`,
        a: `Honest scoping call. A live push is not demonstrable without a connected HubSpot portal, and I would rather ship something that works end-to-end today than half-build an integration I cannot show. The CSV is import-ready and carries the full enrichment — Signal, reasoning, conferences met, reps met, the suggested follow-up — with proper escaping and a UTF-8 BOM so it imports cleanly.`,
      },
      {
        q: `How would the live push work, and won't it create duplicates in HubSpot?`,
        a: `Live push is a HubSpot Private-App token plus a server function — HubSpot retired API keys in 2022, so it is token-based now. Dedup happens on the LinkedIn URL on import, the same anchor we use internally, so a contact who already exists gets updated rather than duplicated.`,
      },
      {
        q: `Why exclude tire-kickers from the export?`,
        a: `Because the export is a prioritized queue, not a contact dump. The whole value of the tool is telling a rep where not to spend time; pushing tire-kickers into the CRM would re-clutter the exact thing we are trying to clean up. Only non-tire-kicker, still-pending people make the cut.`,
      },
    ],
  },
  {
    title: "Architecture & team-readiness",
    items: [
      {
        q: `Why is the plan on a server (Supabase) but People in localStorage?`,
        a: `The annual plan is genuinely shared state that the whole team approves and reads, so it belongs server-side. People and encounters are in localStorage for the MVP because it let me ship the intelligence layer fast and demo it without auth plumbing. I am clear-eyed that this is a demo limitation, not a final architecture.`,
      },
      {
        q: `localStorage means data is per-device and not shared — how is this a team tool?`,
        a: `It is not yet, and I would not claim otherwise — for the MVP it is a single-rep view with seeded team data. The first thing I would build with more time is moving People and encounters to the same backend as the plan, with auth, so it is genuinely multi-rep. The cross-rep detection and shared hot-accounts are already designed for that world; the storage just needs to catch up.`,
      },
      {
        q: `How does this scale to a real team?`,
        a: `The data model already supports it — one Person, many Encounters, anchored on LinkedIn, with cross-rep as a first-class signal. What is missing is the backend and a permissions model: reps should see the team's full intelligence but only act on their own contacts. That is "shared intelligence, scoped action," and it is top of the roadmap.`,
      },
    ],
  },
  {
    title: "Build process & tooling",
    items: [
      {
        q: `Why Lovable specifically, and not Cursor, v0, or raw code?`,
        a: `Because the brief's constraint was explicit: deployable without a build pipeline, hostable and updatable by a non-developer. Lovable hosts it, lets a non-technical person change it by prompting, publishes in one click, and syncs to GitHub so the code stays portable. Its built-in AI gateway also let me run Gemini without putting a key in the codebase. For this specific job — a tool a salesperson owns — that fit better than a raw-code setup.`,
      },
      {
        q: `What's the downside of Lovable? Vendor lock-in?`,
        a: `There is lock-in, and less low-level control than hand-written code — that is the trade. I accepted it because for an MVP owned by a non-developer it is the right one, and the GitHub sync means the code is not trapped: it can be lifted out and run elsewhere if it ever needs to graduate to a full engineering setup.`,
      },
      {
        q: `How did you use AI to build this — where did it help, where did it get in the way?`,
        a: `Claude for the strategy, the data model, and engineering the system prompt behind the Signal logic; Lovable for the build; Gemini for the two in-product AI features. It helped most with speed and with getting the prompt to weight structural signals correctly. Where it got in the way: it sometimes invented its own placeholder data, or over-built features I had not asked for, and I had to actively rein it in. The judgment about what to keep, cut, and where AI does not belong stayed mine.`,
      },
      {
        q: `How much of this did you write vs. the AI?`,
        a: `The AI wrote most of the code; I owned every decision — the architecture, the scoring weights, the deterministic-vs-AI line, the system prompt, and what to cut. The interesting work in a role like this is not typing code, it is directing the tools and knowing when they are wrong.`,
      },
    ],
  },
  {
    title: "Product & sales empathy",
    items: [
      {
        q: `Will a rep on a busy floor actually use this, or just collect badges and forget?`,
        a: `That is the real adoption risk, and it is why the During capture is built around speed, not completeness — name plus a temperature read, on a phone, in seconds. The honest answer is that the "conference close" protocol is the safety net: it assumes the rep will not capture everything in the moment, so it prompts them to add what they remember within the week, before it is gone.`,
      },
      {
        q: `How is this different from just using HubSpot mobile?`,
        a: `HubSpot is a system of record — it stores what you tell it. It will not tell you that the person you are about to greet is the analyst who got promoted into Head of Treasury, or that you have now met them three times and nothing is moving. The intelligence layer — recognition across conferences and the trajectory read — is the part HubSpot does not do, and we feed it the clean result.`,
      },
      {
        q: `What's the single most important feature?`,
        a: `The recognition-and-trajectory read at the moment of contact — knowing this is the same person you have met before, and whether the relationship is warming or stalling. Everything else is plumbing that makes that moment possible: capturing fast enough that the data exists, matching well enough that it is one person, and interpreting well enough that "three meetings" and "two meetings" rank the right way round.`,
      },
      {
        q: `How would you measure whether this tool is working?`,
        a: `Pipeline attribution: of the contacts the tool ranked "Warming," how many converted to meetings and then deals, versus the ones a rep would have chased on gut. And on the planning side, ROI per conference once cost and outcome data are in — which is exactly why past-performance is built into the score and cost is on the roadmap.`,
      },
    ],
  },
  {
    title: "Scope, limits & roadmap",
    items: [
      {
        q: `What did you deliberately cut, and why?`,
        a: `Live HubSpot push (not demonstrable without a portal), conference cost/ROI (no reliable data and out of MVP time), and a real multi-user backend for People. I cut breadth to protect depth — a working end-to-end flow beats half of everything.`,
      },
      {
        q: `What's the weakest part of what you built?`,
        a: `The localStorage People layer — it is the right demo shortcut but the wrong production answer, and it is the first thing I would replace. Second is the decision-maker-presence proxy in scoring, which is honest but imprecise until real outcome data sharpens it.`,
      },
      {
        q: `What would you build next, with another week?`,
        a: `Move People to a real backend with auth and a permissions model — shared intelligence, scoped action; the live HubSpot push; auto-sent follow-ups instead of copy-paste; cost and ROI in the planner so conference selection is profit-driven; and the weekly discovery digest email.`,
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
