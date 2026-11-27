# Orbit (year in review)

## What it does for the user

Orbit is RaveOrb's year-in-review. Once a user has logged at least three Nights in a calendar year, Orbit summarizes that year: total nights, distinct venues/cities/artists, top artists and venues, favourite style, busiest month, longest weekend streak, highest-rated night, favourite moment, top friends, and spending per currency. A shareable card can be generated; a Home spotlight invites the user to Orbit in December (current year) and January (previous year) until dismissed.

## Where it lives in the code

- Aggregation: `frontend/src/lib/orbit.ts` — `buildOrbit` (requires ≥ 3 Nights in the year), `getOrbitYears`, `buildShareCardData`, `homeOrbitYear` / `homeOrbitReady` (December/January window).
- Style lookup: `frontend/src/services/orbitEvents.ts` — resolves linked events for favourite-style counting.
- Dismissal: `frontend/src/lib/orbitDismissal.ts` — stores the dismissed year (key `raveorb.orbit.dismissed-year.v1`, migrating the legacy `raveorb.wrapped.dismissed-year.v1`).
- UI: `frontend/src/screens/OrbitScreen.tsx` (`/orbit`), Home spotlight in `frontend/src/screens/HomeScreen.tsx`.

## How the numbers are computed

- Weekends are grouped by Friday using the Night's date (Fri/Sat/Sun count toward the same weekend); the streak counts consecutive weekends.
- Favourite style uses up to 50 linked event lookups (`raveOrbCategory` of the Night's `sourceEventId`), ignoring "Other".
- Spending sums `cost` per currency (CAD/USD/EUR) without conversion and excludes zero values, because an unfilled cost is stored as zero.
- The share card always includes counts, top artists, and favourite style; friends and spending are **opt-in**, and photos, notes, and moments are never included.

## Data / storage

- Reads Nights from `raveorb.nights.v1`; stores only the dismissed year. No Orbit data leaves the device except the image the user explicitly shares.

## Limits and known gaps

- Locked until three Nights exist for the selected year.
- Image sharing is available on supported iOS and Android devices, including Expo Go; style data requires the linked events to resolve (offline or sample mode may miss styles).

## How to test

- Frontend: `node --test tests/orbit.test.cjs` from `frontend/`.
- Manually (dev builds): on My RaveOrb → Developer tools, **Load sample Nights** adds eight 2026 Nights, which unlocks Orbit for 2026; open `/orbit`, toggle friends/spending on the share card, and share. **Remove sample Nights** cleans up everything whose event name starts with `[Sample]`.
