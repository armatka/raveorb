# Saved preferences

## What it does for the user

The Preferences screen stores the user's defaults for Discovery: the current discovery location, up to five saved locations, favourite styles (RaveOrb categories), the search radius, and the default date range (tonight / weekend / next 7 days / next 30 days / all upcoming). Favourite styles also power the "Favourites" chip in Discovery and feed the taste profile used by recommendations.

## Where it lives in the code

- Storage: `frontend/src/lib/preferencesStorage.ts` — a validated, write-queued AsyncStorage wrapper exposing `get`, `setDiscoveryLocation`, `setSavedLocations`, `setFavouriteCategories`, `setRadiusKm`, `setDefaultDateRange`.
- UI: `frontend/src/screens/PreferencesScreen.tsx`, routed at `frontend/src/app/preferences.tsx`.
- Consumers: `frontend/src/lib/discoveryLocation.ts` (`loadDiscoveryLocation`, `loadDiscoverySettings`), Discovery (`frontend/src/app/(tabs)/events.tsx`), recommendations (`frontend/src/lib/tasteProfile.ts`), artist alerts (`frontend/src/services/artistAlertsService.ts`).

## Data / storage

- AsyncStorage key `raveorb.preferences.v2`; a legacy `raveorb.preferences.v1` record (which stored `discoveryCity` as a string) is migrated on first read.
- Every field is validated on read; unknown or malformed values fall back to defaults (radius 50 km, date range `all-upcoming`) instead of overwriting the stored record.
- Saved locations are capped at five and deduplicated by city + region + country.

## Limits and known gaps

- Preferences are device-local; there is no sync or backup (planned for the Supabase move — see [roadmap.md](../roadmap.md)).
- `discoveryLocationConfigured` distinguishes "never set" (Toronto default applies) from "explicitly cleared" (`null`, meaning all of Canada).

## How to test

- Frontend: `node --test tests/*.test.cjs` from `frontend/` — preferences behaviour is covered through `discovery-location.test.cjs` and `taste-profile.test.cjs`.
- Typecheck: `cd frontend && npm run typecheck`.
- Manually: set favourite styles, radius, and a default date range; kill and relaunch the app and confirm Discovery opens with those defaults; clear the location and confirm "All of Canada" searches.
