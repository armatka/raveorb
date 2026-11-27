# Calendar tab

## What it does for the user

The Calendar tab shows a month view of everything the user has saved: Interested, Going, and Attended events plus journal Nights, grouped by their local dates. It respects the device's first day of the week, supports month navigation and status filters, works offline from saved snapshots, and — for past Going events without a Night — offers a one-tap "log this Night" into the journal.

## Where it lives in the code

- Calendar logic: `frontend/src/lib/raveCalendar.ts` — `calendarItems` (merges tracked events and Nights, deduplicates Nights linked to events, flags past Going events as `canLogNight`, surfaces timezone errors), `filterCalendarItems`, `weekStartsOn` (device/locale week start), `monthGrid`, `shiftMonth`.
- Date helpers: `frontend/src/lib/calendarDate.ts`.
- Backfill: `frontend/src/services/calendarBackfill.ts` — fills in legacy entries missing snapshots or source IDs in batches of at most 50, three requests at a time, without changing an existing acknowledged snapshot; failed lookups retry on a later refresh.
- UI: `frontend/src/screens/CalendarScreen.tsx` at `frontend/src/app/(tabs)/calendar.tsx`. The Calendar tab replaced the Venues tab (Venues now opens from Home — `frontend/src/app/venues.tsx`).

## Data / storage

- Reads tracked events from `raveorb.event-statuses.v1` (snapshots make it work offline) and Nights from `raveorb.nights.v1`. The backfill writes missing snapshot/source-ID data back into the status store.

## Limits and known gaps

- A Going item whose snapshot lacks a valid timezone or start time is flagged with a timezone error instead of being classified past/upcoming.
- Attended events already linked to a Night are hidden in favour of the Night entry.
- Earlier event changes cannot be reconstructed for backfilled entries (no acknowledged snapshot existed).

## How to test

- Frontend: `node --test tests/rave-calendar.test.cjs tests/calendar-date.test.cjs` from `frontend/`.
- Manually: save events with each status and add a Night linked to one of them; check month navigation, the device week start, filters, linked-Night deduplication, offline behaviour (stop the backend — snapshots still render), and the "log this Night" action on a past Going event. **Load sample Nights** (dev builds) provides instant journal content.
