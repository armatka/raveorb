# RaveOrb

RaveOrb is an Expo app for discovering electronic music events and keeping a personal journal of nights — artists, venues, friends, photos, and memories — with a small Express API behind it. Home, My Nights, Events, Calendar, and Stats run on iOS, Android, and web; Venues opens from Home.

- Discovery finds nearby raves, club nights, and festivals (Ticketmaster + community submissions), classified by electronic style.
- The journal, saved events, preferences, follows, plans, and Beacon data all live on the device; nothing is synced or uploaded.
- Beacon is the night-of companion: set times, meeting spot, share your plan, and an "I'm home" check-in.

## Documentation

Full documentation lives in [docs/](docs/README.md):

- [Architecture](docs/architecture.md) — frontend, backend, data flow, phone vs. backend storage, environment variable names.
- [Development](docs/development.md) — running everything, tests/lint/typecheck, Git workflow, Expo Go cache resets, dev tools.
- [Feature docs](docs/README.md#feature-docs-features) — one doc per feature, including how to test it.
- [Decisions](docs/decisions.md) · [Changelog](docs/CHANGELOG.md) · [Roadmap](docs/roadmap.md)

## Quick start

Prerequisites: Node.js 22.13+, npm, and Expo Go (or a development build / simulator / browser).

```sh
cd frontend && npm install
cd ../backend && npm install
```

Backend (port 3000 by default; health check at `GET /api/health`):

```sh
cd backend
npm run dev
```

Frontend:

```sh
cd frontend
npm start        # or npm run ios / android / web
```

## Configuration

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`, then fill in values locally. Variable names and purposes are documented in [docs/architecture.md](docs/architecture.md#environment-variables-names-only--values-live-in-env-files-never-in-docs-or-source). Key points:

- `TICKETMASTER_API_KEY` is backend-only; never put it in frontend source or any `EXPO_PUBLIC_*` variable (Expo embeds those in the app).
- `EXPO_PUBLIC_API_BASE_URL` points the app at the backend origin (no `/api` suffix); leave it unset for the clearly labelled development sample catalog. Restart Expo after changing it.
- Never commit `.env` files, device data, or secrets.

## Checks

```sh
cd backend && npm run build && npm test
cd frontend && npm run typecheck && node --test tests/*.test.cjs && npm run lint
```

See [docs/development.md](docs/development.md) for the full workflow, and update the relevant docs in [docs/](docs/README.md) with every change.

## Attribution

City search is provided by [Open-Meteo.com](https://open-meteo.com) (non-commercial free tier), with geocoding data from [GeoNames](https://www.geonames.org/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
