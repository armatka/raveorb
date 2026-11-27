# RaveOrb documentation

Project documentation for RaveOrb — an Expo app for discovering electronic music events and keeping a personal journal of nights, backed by a small Express API.

## Core docs

- [architecture.md](./architecture.md) — how the app is built: frontend structure, backend structure, provider-to-app data flow, phone vs. backend storage, and environment variable names.
- [development.md](./development.md) — running the backend and app, tests/lint/typecheck, the Git branch workflow, Expo Go cache resets, and in-app dev tools.
- [decisions.md](./decisions.md) — the decision log: what was chosen (or rejected) and why.
- [CHANGELOG.md](./CHANGELOG.md) — one entry per merged feature, newest first.
- [roadmap.md](./roadmap.md) — next steps (Supabase, accounts and backup, community stats) and later ideas.

## Feature docs (`features/`)

Each covers: what it does for the user, where it lives in the code, data/storage, limits and known gaps, and how to test it.

- [discovery-and-electronic-classification.md](./features/discovery-and-electronic-classification.md) — the Events tab and the rule-based electronic scoring/style categories.
- [location-and-city-search.md](./features/location-and-city-search.md) — preset cities, worldwide city search via Open-Meteo, radius searches.
- [saved-preferences.md](./features/saved-preferences.md) — persisted discovery location(s), favourite styles, radius, and default date range.
- [event-providers-and-deduplication.md](./features/event-providers-and-deduplication.md) — the provider abstraction and cross-provider duplicate merging.
- [submit-an-event-and-admin-review.md](./features/submit-an-event-and-admin-review.md) — community submissions, SQLite storage, and approve-first moderation.
- [event-changes-and-cancellations.md](./features/event-changes-and-cancellations.md) — snapshot-based change detection for saved events.
- [follow-artists-and-alerts.md](./features/follow-artists-and-alerts.md) — follows, suggestions, in-app nearby-artist alerts, the Following filter.
- [add-to-calendar.md](./features/add-to-calendar.md) — device-calendar entries that track reschedules and cancellations (dev builds).
- [orbit.md](./features/orbit.md) — the year-in-review with a shareable, privacy-conscious card.
- [recommendations.md](./features/recommendations.md) — the taste profile behind "Picked for you" and the For-you sort, plus Not interested.
- [beacon.md](./features/beacon.md) — night-of mode: set times, meeting spot, share-my-plan, "I'm home" check-in.
- [festival-planner.md](./features/festival-planner.md) — offline festival plans with clash detection and a stage grid.
- [calendar-tab.md](./features/calendar-tab.md) — the month view of saved events and journal Nights.
- [home-and-navigation.md](./features/home-and-navigation.md) — the Home hub, tab/stack routes, and safe-area conventions.
