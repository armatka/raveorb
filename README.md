# RaveOrb

RaveOrb is an Expo app for discovering electronic music events and keeping a personal journal of nights, artists, venues, friends, photos, and memories. The Home, Discovery, My Nights, Venues, and Stats views run on iOS, Android, and web.

## Architecture

- Expo Router provides the frontend's tab and detail routes. Shared `Screen` and `ScreenHeader` components handle safe areas and headers.
- The frontend event repository uses bundled sample events only when `EXPO_PUBLIC_API_BASE_URL` is unset. When configured, Discovery reads Ticketmaster through the Express API; API errors are shown rather than silently falling back to samples.
- The Express API normalizes Ticketmaster Discovery API v2 responses and keeps `TICKETMASTER_API_KEY` on the server. Venue and stats endpoints continue to use local development data.
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

The API listens on port 3000 by default. `npm run build` compiles the server, `npm test` runs isolated adapter tests, and `npm start` runs the compiled output. The health endpoint is `GET /api/health`; event and venue endpoints are under `/api/events` and `/api/venues`.

## Ticketmaster Discovery

Copy `backend/.env.example` to `backend/.env` and set `TICKETMASTER_API_KEY` to a Ticketmaster Discovery API key. Keep this value in the backend environment only. Never put it in frontend source, `frontend/.env`, or an `EXPO_PUBLIC_*` variable; Expo embeds public variables in the client app. The backend reads the key at request time and does not include it in error messages or logs.

Set `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env` to the backend origin, without an `/api` suffix. Examples:

- iOS Simulator or Android emulator (when supported by the emulator): `http://localhost:3000`
- Physical phone: `http://<computer-LAN-address>:3000`, with both devices on the same network
- Deployed backend: its HTTPS origin

Restart Expo after changing frontend environment variables. If the variable is unset, Discovery shows a clearly labeled development sample catalog. If it is set but the backend or Ticketmaster request fails, the app shows an error and retry action; it does not switch to sample data.

Example requests to the backend:

```sh
curl 'http://localhost:3000/api/events?city=Toronto&countryCode=CA&classificationName=Music&page=0&size=20&sort=date%2Casc'
curl 'http://localhost:3000/api/events?keyword=house&city=Toronto&countryCode=CA&page=0&size=20'
curl 'http://localhost:3000/api/events/<ticketmaster-event-id>'
```

The event list returns normalized event records and pagination metadata in `X-Page`, `X-Total-Pages`, and `X-Total-Elements` response headers. Common failures: a backend `500` with “not configured” means the backend key is missing; a `401` or `403` means Ticketmaster rejected the credential; a `429` means the provider rate limit was reached; a connection error usually means the API base URL is wrong or the phone cannot reach the computer. Check backend logs for the sanitized failure category, verify the key in the backend environment without pasting it into logs or chat, and retry after correcting configuration or network access.

## City Search

`GET /api/locations/search?q=Ottawa` searches cities through the backend's Open-Meteo Geocoding adapter. The trimmed query must contain 2–80 characters. The endpoint returns up to eight records with `id`, `label`, `city`, `countryCode`, `latitude`, `longitude`, and optional `region`, `country`, `timezone`, and `population`. Invalid input returns `400`; provider failures return `502` with a retryable message.

The location picker searches after a 300 ms debounce, distinguishes cities by region and country, and saves coordinates and timezone so event discovery uses a 50 km radius. Empty searches show preset cities. Without `EXPO_PUBLIC_API_BASE_URL`, sample-data mode retains the preset and free-text location picker; API failures never fall back to free text.

Only the query text (plus fixed result-count, language, and format options) is sent to Open-Meteo, not device coordinates or other user data. Results are cached in backend memory for 24 hours, with at most 500 entries, and requests time out after eight seconds. No API key is needed for the public service.

City search is provided by [Open-Meteo.com](https://open-meteo.com), with geocoding data from [GeoNames](https://www.geonames.org/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The sheet includes a linked provider credit. The free Open-Meteo API is for **non-commercial use**; commercial use requires [their paid plan](https://open-meteo.com/en/pricing) or a different provider. Provider-specific details are isolated in `backend/src/services/geocoding.ts`.

## Environment Variables

- `EXPO_PUBLIC_API_BASE_URL`: frontend backend origin, with no `/api` suffix. Leave it unset for the clearly labeled development sample catalog. See Ticketmaster Discovery above for local and device examples. Expo public variables are embedded in the app and must not contain secrets.
- `PORT`: optional backend listening port, default `3000`. If changed, update the frontend API origin accordingly.
- `TICKETMASTER_API_KEY`: required backend-only Ticketmaster Discovery API credential. Configure in `backend/.env`; never expose it through the frontend.

## Checks

```sh
cd frontend
npm run typecheck
node --test tests/journal-regression.test.cjs
npm run doctor
npm audit

cd ../backend
npm run build
npm test
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
- [ ] Search cities in API mode: type quickly, distinguish Ottawa in Ontario from Ottawa in Illinois, select a city, reopen/relaunch, and confirm the saved location uses radius searches. Check empty, one-character, no-result, failed lookup/retry, and provider-credit-link states. Confirm sample-data mode still allows free-text cities.

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