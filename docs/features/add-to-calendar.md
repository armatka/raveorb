# Add to calendar

## What it does for the user

From an event's detail page, the user can add it to their device calendar with a reminder. RaveOrb remembers which calendar entry belongs to which event so it can update the entry when the event is rescheduled or mark it cancelled, and it re-offers "Add to calendar" if the user deleted the entry themselves.

## Where it lives in the code

- Service: `frontend/src/services/calendarService.ts` — wraps `expo-calendar`: availability check, permissions, `addEvent`, `eventExists`, `rescheduleEvent`, `markCancelled`, `resolveLinkedEvent`. On iOS it uses the default calendar; on Android, the primary writable calendar (or the first writable one).
- Event → calendar mapping: `frontend/src/lib/calendarEventDetails.ts` — builds title, location, notes, timezone-correct start/end instants (`zonedDateTimeToUtc`), and the alarm offset.
- Link storage: `frontend/src/lib/calendarLinkStorage.ts` — maps RaveOrb event ID → device calendar event ID.
- Change integration: `frontend/src/services/eventChangesService.ts` (`updateCalendarForChange`) applies reschedules and cancellations to the linked entry.
- UI: the calendar button on `frontend/src/screens/EventDetailScreen.tsx`.

## Data / storage

- AsyncStorage key `raveorb.calendar-links.v1` (event ID → calendar event ID). The actual calendar entry lives in the device calendar, owned by the OS.
- Stale links are cleaned up: if the user deleted the calendar entry, `resolveLinkedEvent` removes the link so the event can be re-added.

## Limits and known gaps

- The native calendar module is unavailable on web and **in Expo Go** — this feature needs a development build (`calendarService.isAvailable()`).
- Cancellation marks the calendar entry's title as cancelled rather than deleting it.
- If calendar permission is denied and cannot be asked again, the user is pointed to device Settings.

## How to test

- Frontend: `node --test tests/calendar-button.test.cjs tests/calendar-service.test.cjs tests/calendar-link-storage.test.cjs tests/calendar-event-details.test.cjs` from `frontend/`.
- Manually (development build only): add a Going event to the calendar, verify the entry and reminder; delete the entry in the calendar app and confirm RaveOrb offers to add it again; trigger a reschedule/cancellation (admin edit of a community event) and apply the calendar update from the change notice.
