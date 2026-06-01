## Goal

Turn the current passive table into an active decision-making workflow: the sales manager picks which conferences Grain attends, and a deterministic rules engine continuously validates coverage (vertical, geographic, owners, clustering) — no LLM needed for v1.

## Concept

Two new pieces, both deterministic and explainable:

1. **Insights Engine** — a pure function `evaluateInsights(conferences) → Insight[]` that runs your 7 rules over the current dataset.
2. **Decision Panel** — a right-hand sidebar that lives next to the table/map/timeline and is the single place to: pick conferences, see live insights, and act on them in one click.

The table stays as is for browsing; the decision happens in the sidebar.

## Rules engine (`src/lib/insights.ts`)

A typed insight model:

```ts
type Insight = {
  id: string;                 // stable, e.g. "no-owner:sibos"
  severity: "warn" | "info";  // ⚠️ vs 💡
  category: "coverage" | "concentration" | "trip" | "ownership";
  title: string;              // one-line headline
  detail: string;             // supporting sentence
  conferenceIds: string[];    // which rows it points to
  filterPreset?: Partial<Filters>; // click → apply this filter
};
```

Rules implemented (1:1 with your list):

| # | Rule | Severity |
|---|---|---|
| 1 | `icpScore ≥ 80` AND no assigned reps | warn |
| 2 | `icpScore ≥ 80` AND `status ≠ Going` | warn |
| 3 | Vertical with zero `Going` conferences (per `VERTICALS`) | warn |
| 4 | >70% of `Going` share one vertical | info |
| 5 | >80% of `Going` share one region | warn |
| 6 | Trip pair: same city, ≤14 days apart, both `Going` or `Considering` | info |
| 7 | Cluster: ≥3 conferences in same country within 30 days | info |

Thresholds live as named constants at the top of the file so they are easy to tweak.

Each insight carries a `filterPreset` so clicking it filters the table (rule 1 → status=Going + gapsOnly; rule 3 → that vertical; rule 6/7 → those specific IDs via a new `ids` filter).

## Decision Panel (`src/components/conference-radar/DecisionPanel.tsx`)

Collapsible right sidebar on the main page, three tabs:

- **Shortlist** — every conference grouped as `Going` / `Considering` / `Passed`, with one-click status toggle and rep assignment. Top of the list shows live coverage stats: # Going, total estimated audience reached, vertical mix bar, region mix bar.
- **Insights** — the rules engine output, grouped by severity. Each card has:
  - Headline + detail
  - "Show involved" → applies `filterPreset` to the table
  - For rule 1/2: inline "Mark Going" / "Assign rep" quick actions
- **AI suggestion** *(stub)* — a "Suggest a shortlist" button that runs a deterministic pick: top N by `icpScore` covering every vertical and ≥2 regions, capped by a budget slider (number of conferences). Output is a preview the manager accepts/edits. Labeled as "Rule-based recommendation" so it's honest — you can swap in real AI later without changing the UI.

Layout:

```text
┌─────────────── main ───────────────┬── DecisionPanel ──┐
│ FilterBar                          │ [Shortlist|Insights|AI] │
│ Gap banner                         │ coverage stats          │
│ ViewToggle  (Table/Map/Timeline)   │ ─────────────           │
│ Current view                       │ rule cards / list       │
└────────────────────────────────────┴─────────────────────────┘
```

Panel is toggleable (button in header: "Decisions") and remembers state in `localStorage` so it doesn't get in the way during demos.

## Wiring (`src/routes/index.tsx`)

- Compute `insights = useMemo(() => evaluateInsights(conferences), [conferences])`.
- Pass `conferences`, `insights`, `onSetStatus`, `onToggleRep`, `onApplyFilter` into `DecisionPanel`.
- The existing red Gap banner becomes one of many insights and is removed (or kept as a pinned shortcut to rule 1).

## What gets removed / simplified

- The Gap banner becomes a special-cased pinned insight inside the panel.
- The header stats stay but get a "Coverage health" mini-badge driven by the rules (green if 0 warns, amber if any warn).

## Out of scope for this iteration

- Real AI / LLM call. The "AI suggestion" tab is deterministic and clearly labeled. We can plug Lovable AI Gateway in a follow-up.
- Persistence to a DB. State stays in-memory like today.

## Files

- `src/lib/insights.ts` (new) — types + `evaluateInsights`
- `src/components/conference-radar/DecisionPanel.tsx` (new)
- `src/components/conference-radar/InsightCard.tsx` (new, small)
- `src/components/conference-radar/CoverageMeters.tsx` (new, small — vertical/region bars)
- `src/routes/index.tsx` — wire panel, remove standalone gap banner
- `src/components/conference-radar/FilterBar.tsx` — support an `ids` filter so insights can deep-link to specific rows

## Open questions

1. **Budget**: is there a target number of conferences per year (e.g. 8)? It would sharpen the AI/auto-pick logic.
2. **Per-rep capacity**: should rule 1 also flag reps that are over/under-assigned, or only conferences with no owner?
3. **Trip clustering (rules 6–7)**: include `Considering` events, or only `Going`?
