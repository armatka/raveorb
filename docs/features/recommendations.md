# Recommendations (taste profile)

## What it does for the user

Home shows a "Picked for you" rail and Discovery offers an optional "For you" sort. Both are driven by a taste profile built from the user's own data: Night ratings, followed artists, and favourite styles. Every pick carries an explanation ("Because you rated a Night with X at Y 5★", "An artist you follow: …", "One of your favourite styles: …"). Users can mark an event "Not interested", which removes it from Home picks and moves it to the end of the For-you sort; this can be undone from an event card in Discovery or an artist page.

## Where it lives in the code

- Taste profile: `frontend/src/lib/tasteProfile.ts` — `buildTasteProfile` scores artists, venues, and categories from Nights (rating weights: 5★ → +5, 4★ → +3, 3★ → +1, 1–2★ → −2; Nights older than 12 months count half), followed artists (+6 each), and favourite styles (+4 each). `coldStart` is true when there are no Nights, follows, or favourite styles.
- Scoring and sorting: `frontend/src/lib/homeRecommendations.ts` — `scoreRecommendation` (artist + venue + category scores, +1 for events this weekend, picks the best reason), `getHomeRecommendations` (excludes attended, Going, and Not-interested events; optional city filter; limit 10), `sortEventsForYou` (Discovery sort; cold start falls back to date then electronic score).
- Linked events: `frontend/src/services/linkedEvents.ts` — Night-linked events are looked up by ID, three at a time, and cached for the session (categories use the Night's rating weight).
- Not interested: `frontend/src/lib/notInterestedStorage.ts` (AsyncStorage key `raveorb.not-interested.v1`).
- UI: `frontend/src/components/RecommendationCard.tsx`, the rail on `frontend/src/screens/HomeScreen.tsx`, the For-you sort in `frontend/src/app/(tabs)/events.tsx`.

## Data / storage

- All inputs are device-local: Nights (`raveorb.nights.v1`), follows (`raveorb.followed-artists.v1`), preferences (`raveorb.preferences.v2`), event statuses (`raveorb.event-statuses.v1`), and the Not-interested list. Nothing is uploaded; the profile is rebuilt on demand.

## Limits and known gaps

- Discovery's For-you sort only reorders the events currently loaded, not the full upstream catalog.
- Category evidence depends on resolving the Night's linked event (`sourceEventId`); Nights without a link contribute artists and venues only.
- Cold start uses genre overlap with attended events, or simple date ordering, with generic reasons.

## How to test

- Frontend: `node --test tests/taste-profile.test.cjs tests/home.test.cjs` from `frontend/`.
- Manually (dev builds): **Load sample Nights** on My RaveOrb, then open Home — the rail should show explained picks favouring sample artists (Nova Echo, Glass Current, …); mark one "Not interested" and confirm it disappears from Home and sinks in the For-you sort; undo it from Discovery.
