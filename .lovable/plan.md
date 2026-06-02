## Floor polish — Part 2

Two small logic tweaks in the Floor views. No new components, no styling changes beyond the new toggle.

### 1. `src/components/floor/DuringPhase.tsx` — broaden + filter "Leads at this event"

- Rename section header from **"My leads at this event"** to **"Leads at this event"**.
- Change `myLeads` memo:
  - Filter encounters by `conferenceId` only (drop `e.repId === repId`).
  - Keep dedupe-by-person + hot/temperature sorting as today.
  - Each row continues to show person, company/role, note, time, and hot/temp badge.
  - Add a small muted tag on each row: `entered by {encounter.repId}` (plain text, matches existing `text-[10px] text-muted-foreground` style next to the timestamp).
- Add a **"Mine only"** toggle in the section header (right side, next to the "{n} captured" counter):
  - Local `useState<boolean>(false)` named `mineOnly`.
  - Small button styled like the existing chips (e.g. `text-[10px] uppercase tracking-wide` with a border, toggling `bg-muted`/active state).
  - When `mineOnly && repId` → also filter encounters by `e.repId === repId` before dedupe.
  - Counter reflects the filtered count.
- Empty-state copy unchanged ("Nothing captured yet…").

### 2. `src/components/floor/AfterPhase.tsx` — scope "Needs cleanup" to current rep

- Read `activeRepId` from `useSettings()` (import already pattern used elsewhere in floor components).
- In the `eventLeads` memo, build `personIds` from encounters filtered by **both** `e.conferenceId === conferenceId` **and** `e.repId === activeRepId`.
  - If `activeRepId` is unset, fall back to current behavior (all reps) to avoid an empty screen.
- Downstream `needsInfo` / `ready` derivations are unchanged — they just operate on the now-scoped list.
- "Follow-up suggestions" section continues to use the same `eventLeads`, so it is also rep-scoped (matches intent: each rep wraps up their own leads).

### Out of scope

- No DB / server changes.
- No changes to encounter shape; `repId` is already on `Encounter`.
- No restyle of rows beyond adding the `entered by …` tag and the toggle button.
