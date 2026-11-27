# Event changes and cancellations

## What it does for the user

When a saved (Interested/Going) event is cancelled, postponed, rescheduled, moves venue, sells out, or has tickets become available again, the app shows a dismissible in-app change notice on Home and in "Your events", and offers to update the user's device calendar entry for reschedules and cancellations. Discovery hides cancelled events by default (`includeCancelled=true` shows them).

## Where it lives in the code

- Change detection: `frontend/src/lib/eventChanges.ts` — compares an acknowledged `EventSnapshot` with the latest snapshot and emits `EventChange` records (`cancelled`, `postponed`, `rescheduled`, `venue`, `sold-out`, `tickets-available`).
- Snapshot storage: `frontend/src/lib/eventStatusStorage.ts` — each tracked event keeps `status`, an acknowledged `snapshot`, and the `latest` fetched snapshot (versioned record, migrates v1 data).
- Refresh service: `frontend/src/services/eventChangesService.ts` — `refreshTrackedEvents` (refreshes up to 25 upcoming Going/Interested snapshots at most once per six hours, rotating through larger lists via a cursor), `listTrackedEventChanges`, `updateCalendarForChange`.
- Backend side: admin edits to approved community events (`PATCH /api/admin/submissions/:id/event`) set `eventStatus`, `lastChangedAt`, and `changeNote`; Ticketmaster status is mapped in `backend/src/providers/ticketmaster/mapping.ts`.
- UI: `frontend/src/screens/EventChangesScreen.tsx` (`/event-changes`), change banners on `frontend/src/screens/HomeScreen.tsx`.

## Data / storage

- AsyncStorage key `raveorb.event-statuses.v1` (version 2 record): per-event `status` (`interested` / `going` / `attended`), acknowledged `snapshot`, `latest` snapshot, plus `lastRefresh` and a rotation `cursor`.
- Calendar links used by "update my calendar" live in `raveorb.calendar-links.v1` (see [add-to-calendar.md](./add-to-calendar.md)).

## Limits and known gaps

- There are no push notifications; changes are only discovered when the app refreshes (at most once per six hours).
- Past events are not refreshed as changes; earlier changes cannot be reconstructed when a snapshot was missing (Calendar backfills missing snapshots without overwriting acknowledged ones).
- Refresh failures are shown and retried on a later refresh.

## How to test

- Frontend: `node --test tests/event-changes.test.cjs` from `frontend/` (plus `calendar-link-storage.test.cjs` for calendar updates).
- Manually (community event): mark a submitted event as Going in the app, then as admin `PATCH /api/admin/submissions/:id/event` with a new date or `"eventStatus": "cancelled"`; relaunch or wait for the refresh window and confirm the change notice, the acknowledgement flow, and the calendar update offer.
