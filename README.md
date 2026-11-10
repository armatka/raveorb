# RaveOrb

RaveOrb is an Expo app for discovering electronic music events and keeping a personal journal of nights, artists, venues, friends, photos, and memories. The Home, Discovery, My Nights, Venues, and Stats views run on iOS, Android, and web.

## Architecture

- Expo Router provides the frontend's tab and detail routes. Shared `Screen` and `ScreenHeader` components handle safe areas and headers.
- The frontend event repository uses bundled mock events when `EXPO_PUBLIC_API_URL` is unset, or the Express API when it is set. API errors are shown rather than silently falling back to mocks.
- The Express API serves development mock events and venues with list, detail, and event filter endpoints. There is no real event provider or durable backend event database yet.
- Nights and personal event statuses are stored locally with AsyncStorage. On native devices, selected photos are copied to app-managed document storage. Old Nights without a currency are migrated to USD; unsupported or malformed stored records are not overwritten.
- Stats are computed from local Nights and group spending by currency without conversion. Journal data is device-local and is not synced or backed up by the app.

## Prerequisites

- Node.js 22.13 or newer and npm.
- Expo Go or a compatible development build on a device, an iOS Simulator on macOS, an Android emulator, or a supported browser.
- The phone and development machine should be on the same network when testing the local API from a physical device.

Install dependencies separately:

```sh
cd frontend && npm install
cd ../backend && npm install
```

## Frontend Startup

```sh
cd frontend
npm start
```

Choose iOS, Android, or web from Expo's terminal interface, or run `npm run ios`, `npm run android`, or `npm run web` from `frontend`. Start with `npx expo start -c` to clear Metro's cache if needed.

## Backend Startup

```sh
cd backend
npm run dev
```

The API listens on port 3000 by default. `npm run build` compiles the server, and `npm start` runs the compiled output. The health endpoint is `GET /api/health`; event and venue endpoints are under `/api/events` and `/api/venues`.

## Environment Variables

- `EXPO_PUBLIC_API_URL`: frontend API origin, with no `/api` suffix. Leave it unset for bundled mocks. To use the backend, copy `frontend/.env.example` to `frontend/.env` and set an origin such as `http://localhost:3000`. For a physical phone, use the computer's LAN address instead of `localhost`. Restart Expo after changing it. Expo public variables are embedded in the app and must not contain secrets.
- `PORT`: optional backend listening port, default `3000`. If changed, update the frontend API origin accordingly.

## Checks

```sh
cd frontend
npm run typecheck
node --test tests/journal-regression.test.cjs
npm run doctor
npm audit

cd ../backend
npm run build
npm audit
```

The regression tests mock native storage and file APIs; they do not replace testing on devices. Expo lint is not configured in this project. Review dependency advisories before changing versions; do not apply forced audit fixes without assessing Expo SDK compatibility.

## Manual Regression Checklist

Run on iOS and Android, including a notched or Dynamic Island device, and on web:

- [ ] Open `/`, `/events`, `/nights`, `/venues`, and `/stats` directly and via tabs. Switch tabs with filters set and confirm state remains intact; check for duplicate-route or console warnings.
- [ ] Open `/event/[id]`, `/night/new`, `/night/[id]`, and `/night/[id]/edit` from the app and directly. Verify back navigation and missing-ID states.
- [ ] Check status bar, cutouts, tab bar, and home indicator in portrait and supported display sizes. Confirm there is no overlap or doubled safe-area spacing.
- [ ] Use VoiceOver or TalkBack and keyboard navigation: identify controls, announce selected filters and ratings, reach edit and delete separately, and check 44-point targets and contrast.
- [ ] Load older Nights, including records without `sourceEventId` or currency. Create and edit CAD, USD, and EUR Nights with artists, friends, notes, ratings, and photos; reopen and verify every field.
- [ ] Remove a photo and delete a Night on a native device; confirm managed copies are removed and unrelated photos are untouched. Cancel a deletion and confirm the Night remains.
- [ ] Set, change, clear, and reload Interested, Going, and Attended statuses. Verify an attended event links to its Night and cannot accidentally create a duplicate.
- [ ] Verify Stats and Home reflect journal changes, year filters, empty data, and separate totals for mixed currencies.
- [ ] Check empty journal, empty search, no matching filters, invalid event and Night IDs, storage failure, and photo picker denial/failure. Verify available retry actions.
- [ ] Test mock mode and API mode; stop the API to check the unavailable and retry states, then restart it and retry.

## Project Structure

```text
frontend/
	src/app/          Expo Router tabs and detail routes
	src/components/   Shared UI, journal forms, and cards
	src/screens/      Screen implementations
	src/lib/          Local storage, filtering, formatting, and statistics
	src/services/     Event and venue repository
	src/data/         Bundled development event catalog
	src/theme/        Shared colors, spacing, and controls
	src/types/        Frontend data models
	tests/            Focused journal regression tests
backend/
	src/              Express API, development catalog, and models
docs/               Additional project notes
```

## Git Workflow

Create a focused branch from the current integration branch, inspect `git status` before editing, and keep unrelated work intact. Run the checks and relevant manual cases above, review `git diff --check` and the diff, then commit and open a pull request for review. Do not commit local `.env` files, device data, or secrets.