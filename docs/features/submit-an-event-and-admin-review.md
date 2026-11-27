# Submit an event and admin review

## What it does for the user

Anyone can submit a community event (title, local date and time, timezone, venue/address/location, artists, style, description; optional ticket URL, price, currency, age restriction, and submitter email). Submissions start as **pending** and are invisible to other users until an administrator approves them; approved events become searchable community events in Discovery. Administrators review pending submissions (with possible-duplicate warnings against Ticketmaster), approve, reject with a reason, edit approved events (status, schedule, venue), or delete.

## Where it lives in the code

- Backend validation and rate limiting: `backend/src/services/submissions.ts` — `validateSubmissionInput`, `validateSubmissionChange`, `createSubmissionRateLimiter`, `requireAdmin` (Bearer `ADMIN_TOKEN`).
- Backend storage: `backend/src/db/submissions.ts` — SQLite via Node's built-in `node:sqlite` (`DatabaseSync`), WAL mode, schema version 2, default file `backend/data/raveorb.db` (override with `DATABASE_PATH`).
- Routes in `backend/src/app.ts`:
  - `POST /api/submissions` → `201` with `{ id, status: "pending" }`.
  - `GET /api/admin/submissions?status=pending|approved|rejected` (default pending; pending entries include `possibleDuplicates` scored by `isLikelySameEvent` against Ticketmaster events on the date ± 1 day).
  - `POST /api/admin/submissions/:id/approve`, `POST .../reject` (optional `{ reason }`, ≤ 500 chars), `PATCH .../event` (approved events only), `DELETE .../:id`.
- Serving approved events: `backend/src/providers/submitted/index.ts` (IDs are `submitted-<uuid>`).
- Frontend API client: `frontend/src/services/submissionsApi.ts`.
- Frontend screens: `frontend/src/screens/SubmitEventScreen.tsx` (`/submit-event`) and `frontend/src/screens/AdminReviewScreen.tsx` (`/admin-review`, where the admin pastes the token).

## Data / storage

- Backend SQLite table of submissions, including review metadata (`status`, `createdAt`, `reviewedAt`, `rejectReason`) and event-change fields (`eventStatus`, `lastChangedAt`, `changeNote`).
- Submitter email is stored but never returned by the public submission response or event listings.
- Nothing is stored on the phone; the admin token is entered per session, not persisted.

## Limits and known gaps

- Admin endpoints are unavailable unless `ADMIN_TOKEN` is configured on the backend.
- Rejected submissions remain in the admin list with their reason until deleted.
- Approved community events stay available by ID after cancellation, postponement, or their date passing, but only *upcoming* approved events appear in search (the provider reports itself unconfigured when none are upcoming).
- Community submissions are returned on provider page 0 only (see [event-providers-and-deduplication.md](./event-providers-and-deduplication.md)).
- `PATCH .../event`: date/time edits automatically mark the event `rescheduled` unless a status is supplied; a changed venue requires `address`, `city`, `latitude`, and `longitude`; `changeNote` is capped at 200 characters.

## How to test

- Backend: `cd backend && npm test` — `tests/submissions.test.ts` covers validation, the store, and admin flows.
- Manually: run the backend with `ADMIN_TOKEN` set, submit an event from `/submit-event` in the app, open `/admin-review`, verify duplicate warnings on pending items, approve it, then find it in Discovery (same city/country, page 0). Reject and delete paths return the submission to the expected state.
