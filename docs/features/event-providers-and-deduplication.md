# Event providers and deduplication

## What it does for the user

RaveOrb can list events from more than one source without showing the same party twice. Today there are two providers: Ticketmaster and community submissions. When the same event appears in both, the listings are merged into one with an "also listed on" link, and missing details (description, artists, image) are filled in from the duplicate.

## Where it lives in the code

- Provider contract: `backend/src/providers/types.ts` — `EventProvider` (`search`, `getById`, `isConfigured`, optional `queryKeys`/`parseQuery`), `EventSearchQuery`, `ProviderPage`, `ProviderError`.
- Registry: `backend/src/providers/registry.ts` — registers `ticketmasterProvider` and `submittedProvider`.
- Ticketmaster adapter: `backend/src/providers/ticketmaster/` (`client.ts`, `mapping.ts`, `index.ts`) — normalizes Discovery API v2 responses; the API key is read at request time and never logged.
- Community adapter: `backend/src/providers/submitted/index.ts` — serves approved, upcoming submissions from the SQLite store; filters by keyword, date, city/country or Haversine radius.
- Orchestration: `backend/src/services/events.ts` — runs all configured providers in parallel, merges, classifies, filters, sorts, and reports partial failures by provider ID in the `X-Provider-Errors` header.
- Deduplication: `backend/src/services/deduplication.ts` — `isLikelySameEvent` and `deduplicateEvents`.

## How deduplication works

Two events from different providers are considered likely duplicates when all of these hold:

- local dates match, or are one day apart with start times within four hours across midnight;
- the venue is within 300 metres, or its normalized name matches closely in the same locality;
- normalized titles overlap by at least 0.6, or they share an artist. Normalization strips generic words ("presents", "live", "the", "tickets", …) and each event's own city/region.

The primary listing prefers an event with a ticket URL, then Ticketmaster, then the entry with more filled fields; it carries `alsoListedOn` and inherits missing description/artists/image from duplicates. `GET /api/events/:id` still resolves IDs that were merged out of search results, so saved Nights and statuses keep working. Event detail lookups also check the *other* provider for matches on the local date ± 1 day (Ticketmaster lookups use a 1 km radius when coordinates exist, cached for five minutes; local submissions are checked on every request).

## ID scheme

`source` is the provider ID and `id` is `<providerId>-<sourceEventId>` — except Ticketmaster, which keeps raw, unprefixed IDs so existing saved Nights and event statuses stay valid.

## Data / storage

- No dedup state is stored; merging happens per request. Community submissions live in SQLite (see [submit-an-event-and-admin-review.md](./submit-an-event-and-admin-review.md)).

## Limits and known gaps

- Deduplication happens within the returned provider pages only. Community submissions are returned on provider page 0 only, so a Ticketmaster duplicate on a later page will not be merged — the possible-duplicate warning in the pending admin list is the main safeguard.
- Cross-provider pagination is not implemented: one successful provider keeps its own pagination; multiple providers use summed totals and the maximum page count.
- When multiple providers contribute events, results are date-sorted; a single provider's order is preserved.

## How to test

- Backend: `cd backend && npm test` — `tests/deduplication.test.ts`, `tests/events-service.test.ts`, `tests/ticketmaster.test.ts`.
- Manually: approve a community submission that mirrors a real Ticketmaster event (same date/venue/title), then search that city and confirm a single merged listing with `alsoListedOn`; fetch each ID via `GET /api/events/:id` and confirm both resolve.

## Adding a provider

1. Implement `EventProvider`, mapping results to `EventEntry` and reading credentials at request time.
2. Set `source`, `sourceEventId`, and `id` per the ID scheme above.
3. Register the adapter in `backend/src/providers/registry.ts`; declare provider-specific query parameters in the adapter via `queryKeys`/`parseQuery`.
4. Add adapter and service tests for mapping, configuration, routing, and failures.
