# Festival planner

## What it does for the user

Festival and four-or-more-artist event details offer a device-local planner. The user adds festival dates, stages, and set times; stars the sets they want to see; and gets clash detection, free-time gaps, and a stage-grid view. Saved plans reopen from My RaveOrb without a network connection. Beacon follows the starred plan until its sets are edited manually, and the journal prefill uses the starred artists.

## Where it lives in the code

- Plan model and logic: `frontend/src/lib/festivalPlanner.ts` — `FestivalPlan` (stages, days, `PlannedSet`s), `festivalDays`, `timedSet` (set times before 06:00 belong to the night *after* the selected festival day), `sortedSets`, `overlaps` / `clashesFor`, `keepSet` (unstar everything clashing with a kept set), `scheduleGaps`, `beaconSetsFromPlan`, `synchronizeBeaconSets`.
- Persistence: `frontend/src/lib/festivalPlannerStorage.ts` — validated plans under `raveorb.festival-plan.v1.<eventId>`, listed newest-first; `eventsRepository.getEvent` falls back to the plan's saved event copy when the API is unreachable, so plans open offline.
- UI: `frontend/src/screens/FestivalPlannerScreen.tsx` at `/planner/[id]`; the entry point is on `frontend/src/screens/EventDetailScreen.tsx`.
- Sample data: `frontend/src/lib/sampleFestival.ts` — a two-day fictional festival ("[Sample] Signal Fields", ID `raveorb-local-sample-festival`) with three stages, ten artists, prefilled set times, and two starred sets, marked Going.

## Data / storage

- One AsyncStorage record per planned event (`raveorb.festival-plan.v1.<eventId>`), containing a copy of the event's ID/title plus days, stages, and sets. Everything is device-local.

## Limits and known gaps

- Festival spans are capped at 366 days; day lists must be contiguous.
- A set needs a day, start, and end to be timed; a starred set additionally requires artist, stage, and valid, non-equal times.
- Clash detection and the grid operate on the local plan only — there is no official lineup import.
- Plans are keyed to the event ID; if an event is only reachable under a merged/duplicate ID, the plan does not follow it.

## How to test

- Frontend: `node --test tests/festival-planner.test.cjs` from `frontend/`.
- Manually (dev builds): My RaveOrb → Developer tools → **Load sample festival** creates the plan, stars two sets (one pair clashes), and marks the festival Going starting today. Open the planner from My RaveOrb or the event page: verify clash badges, the keep-set action unstars the clash, gaps between starred sets, the stage grid, and that Beacon shows the starred plan's set times. **Remove sample festival** cleans it all up.
