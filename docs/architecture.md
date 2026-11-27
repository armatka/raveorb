# Architecture

RaveOrb is an Expo (React Native) app with a small Express API. The phone owns all personal data; the backend's job is to talk to event providers, normalize and classify their data, and store community event submissions.

```text
┌────────────────────────────── Phone ──────────────────────────────┐
│ Expo Router app (frontend/src)                                    │
│  screens ── lib (logic + AsyncStorage stores) ── services (API)   │
└───────────────────────────────┬───────────────────────────────────┘
                                │ HTTP (EXPO_PUBLIC_API_BASE_URL)
┌───────────────────────────────▼───────────────────────────────────┐
│ Express API (backend/src)                                         │
│  routes (app.ts) ── services (events, geocoding, submissions)     │
│  providers: ticketmaster ─► Ticketmaster Discovery API v2         │
│             submitted    ─► SQLite (backend/data/raveorb.db)      │
│  city search ─► Open-Meteo Geocoding API                          │
└───────────────────────────────────────────────────────────────────┘
```

## Frontend (Expo Router app, `frontend/src`)

- **`app/`** — routes only. Expo Router maps every file to a screen; `_layout.tsx` is a `Stack` inside `SafeAreaProvider`, `(tabs)/_layout.tsx` defines the five tabs (Home, My Nights, Events, Calendar, Stats). Route files render screens; no logic lives here. Navigation hooks are imported from `expo-router` only (lint-enforced).
- **`screens/`** — screen implementations (`HomeScreen`, `CalendarScreen`, `BeaconScreen`, `FestivalPlannerScreen`, `AdminReviewScreen`, …).
- **`components/`** — shared UI. `Screen` owns the top safe-area inset and keyboard avoidance; `ScreenHeader` renders in-content headers; `components/home/` holds the Home hero/panels.
- **`lib/`** — device-local logic and storage: validated AsyncStorage wrappers (`nightsStorage`, `preferencesStorage`, `eventStatusStorage`, `followedArtistsStorage`, `beaconStorage`, `festivalPlannerStorage`, `calendarLinkStorage`, `notInterestedStorage`, `orbitDismissal`), pure logic (`eventDiscovery`, `raveCalendar`, `tasteProfile`, `homeRecommendations`, `orbit`, `beacon`, `festivalPlanner`, `eventChanges`, `artistMatching`), and dev sample data (`sampleNights`, `sampleEvent`, `sampleFestival`).
- **`services/`** — backend access and device integrations: `eventsApi` (base URL + requests), `eventsRepository` (API vs. bundled mock catalog, response validation), `locationsApi`, `submissionsApi`, `artistAlertsService`, `eventChangesService`, `calendarService` (expo-calendar), `calendarBackfill`, `linkedEvents`, `orbitEvents`.
- **`data/`** — bundled development event catalog (used only when the API URL is unset); **`theme/`** — colors, spacing, tokens; **`types/`** — frontend models (`types/event.ts` is kept in sync with `backend/src/types/index.ts`).

## Backend (Express, `backend/src`)

- **`app.ts`** — all routes: `GET /api/health`, `GET /api/locations/search`, `GET /api/events` (+ `/:id`), `POST /api/submissions`, the `ADMIN_TOKEN`-protected `/api/admin/submissions` review endpoints, and development `/api/venues` + `/api/stats` served from the bundled catalog. `index.ts` boots dotenv and listens on `PORT` (default 3000).
- **`providers/`** — the event-source abstraction. `types.ts` defines `EventProvider`; `registry.ts` registers the Ticketmaster adapter (`providers/ticketmaster/`) and the community-submissions adapter (`providers/submitted/`). New sources plug in here (see [features/event-providers-and-deduplication.md](./features/event-providers-and-deduplication.md)).
- **`services/`** — `events.ts` (query validation, provider fan-out, dedup, classification, cancelled-event filtering, detail-time duplicate enrichment), `deduplication.ts`, `electronicClassification.ts`, `geocoding.ts` (Open-Meteo adapter with in-memory cache), `submissions.ts` (validation, rate limiting, admin auth), `stats.ts` (development data).
- **`db/submissions.ts`** — SQLite via Node's built-in `node:sqlite` (`DatabaseSync`, WAL mode, schema version 2). Default file `backend/data/raveorb.db`, overridable with `DATABASE_PATH`.
- **`types/index.ts`** — shared models (`EventEntry`, `EventSubmission`, `CitySearchResult`, …), mirrored by `frontend/src/types/event.ts`.

## How data flows from providers to the app

1. The app builds a search from the user's saved location/radius/date range and calls `GET /api/events` through `eventsRepository` → `eventsApi`.
2. `parseEventSearchQuery` validates every parameter; `searchEvents` fans out to all **configured** providers in parallel (`Promise.allSettled`).
3. Ticketmaster responses are normalized to `EventEntry` in `providers/ticketmaster/mapping.ts`; approved community submissions are converted in `providers/submitted/index.ts`.
4. Results are cross-provider deduplicated, run through electronic classification, filtered (`electronicOnly`, cancelled events hidden unless `includeCancelled=true`), and date-sorted when more than one provider contributed.
5. The response carries pagination in `X-Page` / `X-Total-Pages` / `X-Total-Elements` and partial provider failures in `X-Provider-Errors`.
6. The app validates every event record (`eventsRepository.isEventEntry`) before it reaches the UI. When the user saves a status, a snapshot of the event is kept on the phone so Calendar and change detection work offline.
7. Event details (`GET /api/events/:id`) route to the owning provider by ID prefix (Ticketmaster keeps raw IDs) and are enriched with duplicates from the other provider.

Without `EXPO_PUBLIC_API_BASE_URL`, the app runs in **mock mode** on the bundled sample catalog; when the URL is set, API errors are surfaced with a retry — never a silent fallback.

## What is stored on the phone vs. the backend

**Phone (AsyncStorage + app document storage) — all personal data, not synced or backed up:**

| Store | Key(s) | Contents |
| --- | --- | --- |
| Nights journal | `raveorb.nights.v1` + `night-photos/` dir | Nights (event, venue, artists, friends, rating, cost+currency, notes, moment); photos copied into app-managed document storage on native |
| Event statuses | `raveorb.event-statuses.v1` | Interested/Going/Attended per event, acknowledged + latest snapshots, refresh cursor |
| Preferences | `raveorb.preferences.v2` | Discovery location, saved locations (≤ 5), favourite styles, radius, default date range |
| Followed artists | `raveorb.followed-artists.v1` | Follows + artist-alert state and seen markers |
| Beacon details | `raveorb.night-of.v1.<eventId>` | Set times, meeting spot, manual-edit flag |
| Festival plans | `raveorb.festival-plan.v1.<eventId>` | Days, stages, sets, starred flags |
| Calendar links | `raveorb.calendar-links.v1` | RaveOrb event ID → device calendar event ID |
| Not interested | `raveorb.not-interested.v1` | Excluded event IDs |
| Orbit dismissal | `raveorb.orbit.dismissed-year.v1` | Dismissed year (legacy `raveorb.wrapped.dismissed-year.v1` migrated) |
| Dev samples | `raveorb.sample-event.v1`, `raveorb.sample-festival.v1` | Fictional dev-only event/festival |

**Backend:**

- SQLite submissions database (`backend/data/raveorb.db`): community event submissions with review state. Submitter email is stored but never exposed publicly.
- In-memory only: 24-hour city-search cache, 5-minute Ticketmaster duplicate-lookup cache, submission rate-limiter state.
- The backend stores **no** user accounts, journals, or statuses.

## Environment variables (names only — values live in `.env` files, never in docs or source)

Documented in `backend/.env.example` and `frontend/.env.example`:

| Variable | Side | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | frontend | Backend origin without `/api`. Unset → mock mode. Expo embeds `EXPO_PUBLIC_*` values in the app, so it must never contain secrets. |
| `PORT` | backend | Listening port (default 3000). |
| `TICKETMASTER_API_KEY` | backend | Ticketmaster Discovery API credential. Server-side only; read at request time; never logged or sent to the client. |
| `ADMIN_TOKEN` | backend | Bearer token required by all `/api/admin` endpoints; admin review is unavailable without it. |
| `DATABASE_PATH` | backend | Optional SQLite path override (default `backend/data/raveorb.db`). |
