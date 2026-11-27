# Beacon (night-of mode)

## What it does for the user

Beacon is RaveOrb's night-of safety and planning companion for a Going event. Inside the Beacon window (from 6 hours before the event's start until 12 hours after) the user can: keep set times for the night, record a meeting spot, share their plan (event, venue, address, expected home time, optionally current location) with someone they trust via the system share sheet, and tap "I'm home" after the event to share a check-in. Nothing is ever sent automatically. After the event, Beacon offers a Night journal prefill using the artists from the set list.

## Where it lives in the code

- Window and plan logic: `frontend/src/lib/beacon.ts` — `getBeaconStart` / `isBeaconWindow` (−6 h … +12 h), `isAfterEvent` (uses the end time, handling past-midnight ends; without an end time, 5 hours after start), `buildPlanMessage`, `nightPrefill`.
- Details storage: `frontend/src/lib/beaconStorage.ts` — set times, meeting spot, and a `setsEditedManually` flag, per event.
- Dev overrides: `frontend/src/lib/beaconDevOverrides.ts` — `forceWindow` and `forceAfterEvent` switches, active only in `__DEV__`.
- UI: `frontend/src/screens/BeaconScreen.tsx` at `/beacon/[id]`; `/night-of/[id]` redirects there for old links. Entry points: the Home hero/spotlight (`frontend/src/components/home/BeaconSpotlight.tsx`) and event details.
- Festival integration: when a starred festival plan exists, Beacon follows the plan's starred sets until the user edits sets manually (`synchronizeBeaconSets` in `frontend/src/lib/festivalPlanner.ts`).

## Data / storage

- AsyncStorage keys `raveorb.night-of.v1.<eventId>` (the legacy key prefix is kept so existing set times and meeting spots remain available). Event statuses supply the Going events that can light a Beacon.
- The share plan is composed as plain text and handed to the OS share sheet; RaveOrb has no messaging backend.

## Limits and known gaps

- No automatic or missed-check-in alerts — the user must tap "I'm home" (the Home copy states this explicitly).
- The window needs a valid date, time, and timezone; events with malformed schedules get no Beacon window.
- Current-location links in the plan require location permission at share time.

## How to test

- Frontend: `node --test tests/beacon.test.cjs tests/beacon-screen.test.cjs` from `frontend/`.
- Manually (dev builds), via My RaveOrb → Developer tools:
  - **Load sample Nights** also creates a fictional Going event ("[Sample] Tonight's Signal") starting about two hours from now, which is inside the Beacon window immediately.
  - The **Force Beacon window** switch makes any Going event's Beacon available regardless of time; **Force after event** unlocks the "I'm home" check-in and journal prefill.
  - The **sample festival** exercises Beacon's plan-following behaviour (see [festival-planner.md](./festival-planner.md)).
