# RaveOrb

RaveOrb is an Expo app for discovering electronic music events and keeping a personal journal of nights, artists, venues, friends, photos, and memories. Home, Discovery, My Nights, Calendar, Venues, and Stats run on iOS, Android, and web; Venues opens from Home.

## Architecture

- Expo Router provides the frontend's tab and detail routes. Shared `Screen` and `ScreenHeader` components handle safe areas and headers.
- The frontend event repository uses bundled sample events only when `EXPO_PUBLIC_API_BASE_URL` is unset. When configured, Discovery reads Ticketmaster through the Express API; API errors are shown rather than silently falling back to samples.
- The Express API normalizes Ticketmaster Discovery API v2 responses and keeps `TICKETMASTER_API_KEY` on the server. Venue and stats endpoints continue to use local development data.
- Nights and personal event statuses are stored locally with AsyncStorage. On native devices, selected photos are copied to app-managed document storage. Old Nights without a currency are migrated to USD; unsupported or malformed stored records are not overwritten.
- Calendar groups saved Interested, Going, and Attended events and Nights by their local dates. It works from saved details offline, and links past Going events without a Night to the journal. Calendar backfills legacy missing snapshots or source IDs in batches of at most 50, three requests at a time; failed lookups retry on a later refresh.
- Stats are computed from local Nights and group spending by currency without conversion. Journal data is device-local and is not synced or backed up by the app.
- Orbit unlocks after three Nights in a year. Its style uses up to 50 linked event lookups, and weekends are grouped by Friday using the Night's date. Spending excludes zero values because an unfilled cost is stored as zero. The share image excludes photos, notes and moments; friends and spending are opt-in. Image sharing is available on supported iOS and Android devices, including Expo Go.
- In development builds, My RaveOrb can load eight sample 2026 Nights or remove Nights whose event name starts with `[Sample]`.
- Festival and four-artist event details offer a device-local planner. Reopen saved plans from My RaveOrb without a network connection. Add festival dates, stages and set times; times before 06:00 belong to the night after the selected festival day. Star sets to see clashes and free time, or view the stage grid. Beacon follows the starred plan until its sets are edited; the journal prefill uses starred artists. Development tools can load or remove a separate sample festival.

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

The event list returns normalized event records and pagination metadata in `X-Page`, `X-Total-Pages`, and `X-Total-Elements` response headers. `X-Total-Pages` is capped to Ticketmaster's accessible page range for the requested page size; `X-Total-Elements` remains the upstream total. Common failures: a backend `500` with “not configured” means the backend key is missing; a `401` or `403` means Ticketmaster rejected the credential; a `429` means the provider rate limit was reached; a connection error usually means the API base URL is wrong or the phone cannot reach the computer. Check backend logs for the sanitized failure category, verify the key in the backend environment without pasting it into logs or chat, and retry after correcting configuration or network access.

## Event providers

The backend's `src/providers/types.ts` defines the provider contract, `src/providers/registry.ts` registers adapters, and `src/services/events.ts` validates searches, deduplicates results, classifies events, and coordinates providers. Ticketmaster's adapter and mapping live in `src/providers/ticketmaster/`. A partial search failure is reported by provider ID in the `X-Provider-Errors` header. When only one provider contributes events, its result order is preserved; events from multiple providers are date-sorted. One successful provider retains its pagination; multiple successful pages use summed totals and the maximum page count. Cross-provider pagination is not implemented.

### Community submissions and moderation

`POST /api/submissions` accepts an event submission and returns its ID with `status: "pending"`. Submission fields include title, local date and time, timezone, venue/address/location, artists, style, and description; ticket URL, price, currency, age restriction, and submitter email are optional. Submissions are rate-limited and validated, and submitter email is not returned by the public submission response or event listing.

Admin requests use `Authorization: Bearer <ADMIN_TOKEN>`. The endpoints are:

- `GET /api/admin/submissions?status=pending|approved|rejected` (defaults to pending). Pending entries include `possibleDuplicates` when a likely Ticketmaster match is found.
- `POST /api/admin/submissions/:id/approve`
- `POST /api/admin/submissions/:id/reject` with an optional `{ "reason": "..." }` body
- `PATCH /api/admin/submissions/:id/event` for approved events: set `eventStatus` to `scheduled`, `cancelled`, `postponed`, or `rescheduled`, and/or update `date`, `startTime`, `endTime`, and venue fields with an optional `changeNote` (up to 200 characters). A changed venue requires `address`, `city`, `latitude`, and `longitude`. Date/time edits automatically mark the event rescheduled unless a status is supplied.
- `DELETE /api/admin/submissions/:id`

Configure a strong `ADMIN_TOKEN` on the backend. The submission database defaults to `backend/data/raveorb.db`; set `DATABASE_PATH` to use another database file. Pending submissions are private until an administrator approves them. Approved submissions become searchable community events; rejected submissions remain available in the admin list with their reason unless deleted.

Events from different providers are deduplicated within the returned provider pages. Two events are considered likely duplicates when their local dates match (or are one day apart with start times within four hours across midnight), the venue is within 300 metres or its normalized name matches closely in the same locality, and their normalized titles overlap by at least 0.6 or they share an artist. Normalization ignores generic words such as “presents,” “live,” “the,” and “tickets,” and removes each event's own city and region from its title and venue. The primary listing prefers an event with a ticket URL, then Ticketmaster, then the entry with more filled fields. It carries an `alsoListedOn` list, and missing description, artist, and image fields are filled from duplicates. `GET /api/events/:id` continues to resolve IDs for listings that were merged out of search results so saved Nights and statuses continue to work.

Known limitation: community submissions are only returned on provider page 0. A Ticketmaster duplicate on a later page will not be merged; the possible-duplicate warning in the pending admin list is the main safeguard.

Event detail lookups check the other provider for matches on the local date or adjacent dates and merge missing fields while retaining the requested listing's ID, status and schedule, including `alsoListedOn`. Ticketmaster duplicate searches use a 1 km radius when coordinates are available (otherwise city and country) and are cached for five minutes; local approved submissions are checked on each request so moderation changes are reflected immediately. If Ticketmaster is unconfigured or this optional duplicate search fails, community event details remain available without duplicate enrichment.

Discovery hides cancelled events by default; `GET /api/events?...&includeCancelled=true` includes them. Approved community events remain available by ID after cancellation, postponement, or their date passing. Ticketmaster `offsale` is not treated as sold out. Pagination totals remain provider totals and can include filtered events.

On-device statuses may include an acknowledged event snapshot. Home and Your events refresh up to 25 upcoming Going/Interested snapshots at most once per six hours, rotating through larger lists, and show dismissible in-app changes. Past events are not refreshed as changes. Calendar attempts to backfill missing snapshots and source IDs without changing an existing acknowledged snapshot; earlier changes cannot be reconstructed. There are no push notifications. Refresh failures are shown and retried on a later refresh.

To add a provider:
1. Implement `EventProvider`, mapping its results to `EventEntry` and reading credentials at request time.
2. Set `source` to the provider ID, `sourceEventId` to the raw ID, and `id` to `<providerId>-<sourceEventId>`. Ticketmaster alone retains raw, unprefixed IDs for existing Nights and event statuses.
3. Register the adapter in `src/providers/registry.ts`; declare and parse any provider-specific public query parameters in the adapter.
4. Add adapter and service tests for mapping, configuration, routing, and failures.

## Following artists

Follow artists from an artist page or the event detail lineup; manage follows and suggestions on the Following screen (from My RaveOrb or Preferences). Everything is stored on the device in `raveorb.followed-artists.v1`. Names are matched with the same normalization as artist pages (case and whitespace insensitive), and lineup entries such as `A b2b B` or `A, B` count for each artist; `&` and `and` are not split because they appear in act names. Suggestions come only from your Nights: artists seen at two or more Nights, or at a Night rated 4 or higher.

Artist alerts run when Home loads, at most once every six hours per saved location and radius. Each refresh searches the existing events API once per followed artist (`keyword=<artist>`, saved location and radius, next 90 days), for up to 10 artists, rotating through longer lists and running at most 3 requests at a time. A keyword hit only counts if the normalized lineup contains the artist, not the title alone. An artist whose search fails is retried in the next window. Opening the alert list marks its events as seen, so the same event is not announced again. Followed-artist events also rank higher in Home recommendations.

Home's Picked for you rail and Discovery's optional For you sort use Night ratings, followed artists and favourite styles. Linked-event categories use the Night's rating weight; Nights older than 12 months count half, and events this weekend receive a small boost. Linked events are looked up by ID, three at a time, and cached for the session. Discovery sorts only the events currently loaded. Not interested is stored on the device, excludes an event from Home picks and moves it to the end of the For you sort; it can be undone on an event card in Discovery or an artist page. Going events are excluded from Home picks.

The Discovery "Following" chip runs the same per-artist search for every followed artist (3 at a time), cached for the app session; failed artists can be retried. There are no push notifications.

Limitations: each artist search reads only the first 50 results, so an artist with more upcoming events than that within the window may be missed. A full alert pass over N followed artists takes ⌈N / 10⌉ refresh windows. Artists listed only in an event title, not its lineup, are not matched.

## City Search

`GET /api/locations/search?q=Ottawa` searches cities through the backend's Open-Meteo Geocoding adapter. The trimmed query must contain 2–80 characters. The endpoint returns up to eight records with `id`, `label`, `city`, `countryCode`, `latitude`, `longitude`, and optional `region`, `country`, `timezone`, and `population`. Invalid input returns `400`; provider failures return `502` with a retryable message.

The location picker searches after a 300 ms debounce, distinguishes cities by region and country, and saves coordinates and timezone so event discovery uses a 50 km radius. Empty searches show preset cities. Without `EXPO_PUBLIC_API_BASE_URL`, sample-data mode retains the preset and free-text location picker; API failures never fall back to free text.

Only the query text (plus fixed result-count, language, and format options) is sent to Open-Meteo, not device coordinates or other user data. Results are cached in backend memory for 24 hours, with at most 500 entries, and requests time out after eight seconds. No API key is needed for the public service.

City search is provided by [Open-Meteo.com](https://open-meteo.com), with geocoding data from [GeoNames](https://www.geonames.org/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The sheet includes a linked provider credit. The free Open-Meteo API is for **non-commercial use**; commercial use requires [their paid plan](https://open-meteo.com/en/pricing) or a different provider. Provider-specific details are isolated in `backend/src/services/geocoding.ts`.

## Environment Variables

- `EXPO_PUBLIC_API_BASE_URL`: frontend backend origin, with no `/api` suffix. Leave it unset for the clearly labeled development sample catalog. See Ticketmaster Discovery above for local and device examples. Expo public variables are embedded in the app and must not contain secrets.
- `PORT`: optional backend listening port, default `3000`. If changed, update the frontend API origin accordingly.
- `TICKETMASTER_API_KEY`: required backend-only Ticketmaster Discovery API credential. Configure in `backend/.env`; never expose it through the frontend.
- `ADMIN_TOKEN`: optional bearer token required by all `/api/admin` endpoints. Without it, admin review is unavailable.
- `DATABASE_PATH`: optional path to the SQLite submissions database. Defaults to `backend/data/raveorb.db`.

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

- [ ] Open Home, Events, Nights, Calendar, and Stats directly and via tabs; open Venues from Home. Switch tabs with filters set and confirm state remains intact; check for duplicate-route or console warnings.
- [ ] Check Calendar month navigation, device week start, filters, saved events and Nights, linked-Night deduplication, and offline behavior.
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