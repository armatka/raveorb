# Location and city search

## What it does for the user

Discovery is location-aware. The user picks a city from presets (Toronto, Montreal, Vancouver, New York, London, Berlin) or searches any city worldwide; events are then searched within a radius (10 / 25 / 50 / 100 km, default 50) of the saved coordinates. The city picker searches as the user types (300 ms debounce), distinguishes same-named cities by region and country (e.g. Ottawa, Ontario vs. Ottawa, Illinois), and shows a provider credit.

## Where it lives in the code

- Backend adapter: `backend/src/services/geocoding.ts` — Open-Meteo Geocoding API, provider-specific details are isolated in this one file.
- Backend route: `GET /api/locations/search?q=...` in `backend/src/app.ts` (400 for invalid input, 502 for provider failures).
- Frontend API client: `frontend/src/services/locationsApi.ts`.
- Frontend location model and presets: `frontend/src/lib/discoveryLocation.ts` — `DEFAULT_DISCOVERY_LOCATION` (Toronto), `PRESET_DISCOVERY_LOCATIONS`, `DISCOVERY_RADIUS_OPTIONS`, `discoveryEventsQuery()` (prefers `latlong` + radius when coordinates exist, else `city` + `countryCode`).
- Persistence: the selected location, saved locations, and radius are part of preferences (`frontend/src/lib/preferencesStorage.ts`); see [saved-preferences.md](./saved-preferences.md).

## How it works

- The trimmed query must be 2–80 characters; the backend returns up to eight `CitySearchResult` records (`id`, `label`, `city`, `countryCode`, `latitude`, `longitude`, optional `region`, `country`, `timezone`, `population`).
- Only the query text plus fixed count/language/format options is sent to Open-Meteo — never device coordinates or other user data. No API key is needed.
- Results are cached in backend memory for 24 hours (max 500 entries); requests time out after 8 seconds.
- Selecting a city saves coordinates and timezone so event discovery can use radius searches.

## Data / storage

- Backend: in-memory cache only; nothing persisted.
- Phone: the chosen location lives inside `raveorb.preferences.v2` (AsyncStorage).

## Limits and known gaps

- The free Open-Meteo API is for **non-commercial use**; commercial use needs their paid plan or another provider (see [decisions.md](../decisions.md)). Attribution is required: city search is provided by Open-Meteo.com with GeoNames data under CC BY 4.0, and the picker shows a linked credit.
- Without `EXPO_PUBLIC_API_BASE_URL` (sample-data mode) the picker falls back to presets and free-text city entry; in API mode, failures never fall back to free text.

## How to test

- Backend: `cd backend && npm test` — `tests/geocoding.test.ts`.
- Frontend: `node --test tests/locations-api.test.cjs tests/discovery-location.test.cjs` from `frontend/`.
- Manually: `curl 'http://localhost:3000/api/locations/search?q=Ottawa'`; in the app, type quickly to exercise the debounce, pick a city, relaunch, and confirm the saved location drives a radius search. Check empty, one-character, no-result, failure/retry, and credit-link states.
