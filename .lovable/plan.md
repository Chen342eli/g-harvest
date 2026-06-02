
## Timeline redesign — Gantt-style (Season Planner)

Current timeline is a 12-column "month buckets" grid — each conference is a chip stacked inside its start month. The reference image (Airtable Gantt) is fundamentally different: a continuous horizontal time axis, rows on the left, and bars positioned and sized by actual start/end dates.

I'll rebuild `TimelineView` to match that paradigm, keeping the same data + popover/tooltip behavior so nothing downstream changes.

### What the new view looks like

```text
                Jan      Feb      Mar      Apr      May      Jun  ...
─────────────┬────────────────────────────────────────────────────────
Aron Geneva  │   ▆▆▆ Money2026          ▆▆▆▆ FinovateEU
Lisana Lng   │           ▆▆▆▆▆ Payments Summit
Georgia Yuet │                    ▆▆▆▆ MoneyLIVE
Unassigned   │       ▆▆ Embedded Fin       ▆▆▆ Treasury Days
─────────────┴────────────────────────────────────────────────────────
                          ▲ today
```

- **Left gutter (sticky, ~180px):** one row per swimlane.
- **Right canvas:** continuous 12-month axis with month dividers + light week gridlines + a vertical "today" line.
- **Bars:** absolutely positioned (left = startDate offset, width = duration). Tier drives color (Tier 1 emerald, Tier 2 amber, Tier 3 slate), `Passed` is desaturated + strikethrough, `Going` gets a solid fill, `Considering` a soft fill, `Backlog` an outlined fill. Coverage-gap keeps the red "Gap" pill on the bar.
- **Cluster marker:** bars whose start dates are within 14 days of another get a small fuchsia notch on the left edge (replaces today's stripe), preserving the existing cluster signal.
- **Bar interaction:** unchanged — hover = Tooltip with name/dates/status, click = Popover with `ConferenceDetail` and decision controls.

### Swimlanes (rows)

Default grouping: **Assigned rep**. Each rep gets a lane; conferences with multiple reps appear in each of their lanes; conferences with none go into an "Unassigned" lane at the bottom.

Add a small toggle above the chart: **Group by → Rep / Vertical / Region / Tier / None (single lane)**. State lives locally in the component (no URL/store changes).

### Time axis

- Fixed to the same `YEAR = 2026` window the current view uses.
- Header: month labels across the top, with subtle vertical month dividers extending down through the lanes.
- Horizontal scroll on narrow viewports; min-width ~1100px so months stay readable. Sticky left gutter while scrolling horizontally.
- "Today" vertical line only drawn if today falls inside the year.

### Bar overlap within a lane

If two bars in the same lane overlap in time, stack them vertically inside that lane (lane auto-grows by row height × stack depth). Simple greedy packing — scan bars sorted by start, assign each to the lowest free sub-row.

### Legend + summary

Keep the existing legend (Tier 1/2/3 + cluster). Add a tiny "N conferences in {YEAR}" count and keep the "X outside YEAR hidden" note.

### Files

- **Rewrite** `src/components/conference-radar/TimelineView.tsx` — new Gantt layout, same props (`conferences`, `onSetStatus`), same Popover/Tooltip wiring, reuses `ConferenceDetail`, `isCoverageGap`, `TIER_CHIP` palette.
- No other files change. `planning.tsx` already renders `<TimelineView />` with the same props.

### Out of scope

- Drag-to-reschedule, resize handles, dependencies/arrows between bars (the reference shows none of these as required).
- Zoom levels (quarter/week/day) — the year view stays month-resolution for now; easy to add later if you want.
- Persisting the "Group by" choice.

Want me to proceed with this, or should rows default to Vertical/Region instead of Rep?
