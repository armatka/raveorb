# Discovery and electronic classification

## What it does for the user

The Events tab (Discovery) finds electronic music events near the user: raves, club nights, concerts, and festivals. Every event coming through the backend is scored for how "electronic" it is and labelled with a RaveOrb style category (House, Tech House, Deep House, Minimal / Deep Tech, Techno, Hard Techno, Melodic House & Techno, Trance, Progressive, Drum & Bass, Dubstep / Bass, Garage, EDM, Electronic, Festival, Other). Discovery can filter to electronic-only events, group results into Tonight / Weekend / Next 7 days / Upcoming sections, and filter by style chips (including "Festivals", "Favourites", "Following", and "Bass").

## Where it lives in the code

- Backend classification: `backend/src/services/electronicClassification.ts` — rule-based scoring with `ELECTRONIC_DISCOVERY_THRESHOLD = 60`.
- Backend search orchestration: `backend/src/services/events.ts` — validates query parameters, runs providers, deduplicates, classifies, and filters (`electronicOnly`, `includeCancelled`).
- API routes: `backend/src/app.ts` — `GET /api/events` and `GET /api/events/:id`, with pagination exposed in `X-Page`, `X-Total-Pages`, `X-Total-Elements` headers and partial failures in `X-Provider-Errors`.
- Frontend repository: `frontend/src/services/eventsRepository.ts` (API vs. bundled mock catalog), `frontend/src/services/eventsApi.ts` (base URL, request handling).
- Frontend filtering/grouping: `frontend/src/lib/eventDiscovery.ts` (date ranges, sections, category chips, the same threshold of 60).
- UI: `frontend/src/app/(tabs)/events.tsx` and `frontend/src/screens/EventDetailScreen.tsx`; shared types in `frontend/src/types/event.ts` (kept in sync with `backend/src/types/index.ts`).

## How classification works

Evidence is gathered from Ticketmaster subgenre/genre/segment/type/subtype, the event title, artist names, description, and venue name, each with its own score (e.g. Ticketmaster subgenre 96, title 82, description 46, venue 24). The most specific matching category rule wins; corroboration across independent fields adds up to +8; a festival signal adds +3 and sets `isFestival`. Non-electronic classifications ("rock", "pop", "comedy", …) subtract 55 unless there is strong specific electronic evidence. An event is electronic when the final score ≥ 60. The result is attached to each `EventEntry` as `raveOrbCategory`, `raveOrbSubgenre`, `electronicScore`, `isElectronic`, `isFestival`, `matchedTerms`, and `classificationReasons`.

## Data / storage

- Nothing is stored for classification; it is computed on each backend response.
- Without `EXPO_PUBLIC_API_BASE_URL`, the frontend uses the bundled development catalog in `frontend/src/data/mockData.ts` (mode is decided once in `eventsRepository.eventsDataMode`). When the API is configured, failures show an error and retry — the app never silently falls back to samples.

## Limits and known gaps

- Classification is heuristic; events with vague titles and no Ticketmaster genre data can be mislabelled or miss the electronic threshold.
- Discovery sorts only the events currently loaded (one provider page at a time).
- `X-Total-Pages` is capped to Ticketmaster's accessible page range; `X-Total-Elements` remains the upstream total, so totals can include events that are later filtered out.
- Ticketmaster `offsale` is not treated as sold out.

## How to test

- Backend: `cd backend && npm test` — includes `tests/electronic-classification.test.ts` and `tests/events-service.test.ts`.
- Frontend: `node --test tests/*.test.cjs` from `frontend/` — `discovery-location.test.cjs`, `events-api.test.cjs` cover discovery behaviour.
- Manually: leave `EXPO_PUBLIC_API_BASE_URL` unset to browse the clearly labelled sample catalog, or set it and run the backend with a Ticketmaster key, then search, e.g. `curl 'http://localhost:3000/api/events?keyword=house&city=Toronto&countryCode=CA&page=0&size=20'` and check `electronicScore` / `raveOrbCategory` on the results.
