# Follow artists and alerts

## What it does for the user

Users follow artists from an artist page or an event's lineup, manage follows and suggestions on the Following screen, and get in-app alerts when a followed artist has an upcoming event near their saved location. Discovery has a "Following" chip that shows only followed artists' events, and followed artists rank higher in Home recommendations. Suggestions come only from the user's own Nights: artists seen at two or more Nights, or at a Night rated 4★ or higher.

## Where it lives in the code

- Storage: `frontend/src/lib/followedArtistsStorage.ts` — follows plus alert state (last check, location key, rotation cursor, retry list, alert items), `ALERT_REFRESH_INTERVAL_MS` (6 h) and `ALERT_ARTISTS_PER_REFRESH` (10).
- Matching: `frontend/src/lib/artistMatching.ts` and `frontend/src/lib/artistResolver.ts` — name normalization (case/whitespace insensitive) and lineup splitting (`A b2b B`, `A, B` count for each artist; `&`/`and` are *not* split because they appear in act names).
- Alert service: `frontend/src/services/artistAlertsService.ts` — `refreshArtistAlerts` (runs when Home loads, at most once every six hours per saved location + radius), `searchArtistEvents` (keyword search per artist, saved location and radius, next 90 days, 50 results, lineup must contain the artist), `searchFollowedArtistEvents` (Discovery "Following" chip, session-cached), concurrency limit 3.
- UI: `frontend/src/screens/FollowingScreen.tsx` (`/following`), `frontend/src/screens/ArtistAlertsScreen.tsx` (`/artist-alerts`), `frontend/src/screens/ArtistDetailScreen.tsx` (`/artist/[id]`), `frontend/src/components/FollowButton.tsx`.

## Data / storage

- Everything is on the device under AsyncStorage key `raveorb.followed-artists.v1` (follows and alert state together). Opening the alert list marks events as seen so the same event is not announced again.

## Limits and known gaps

- No push notifications — alerts are in-app only.
- Each artist search reads only the first 50 results, so an artist with more upcoming events than that within the 90-day window may be missed.
- A full alert pass over N followed artists takes ⌈N / 10⌉ refresh windows (10 artists per 6-hour refresh, rotating).
- Artists listed only in an event title, not its lineup, are not matched; a keyword hit counts only if the normalized lineup contains the artist.
- An artist whose search fails is retried in the next window.

## How to test

- Frontend: `node --test tests/followed-artists.test.cjs tests/artist-resolver.test.cjs` from `frontend/`.
- Manually: follow an artist appearing in upcoming events near the saved location, reopen Home, and check the artist-alerts entry point; open the alert list and confirm re-opening does not re-announce the same events; use the Discovery "Following" chip and retry a failed artist.
