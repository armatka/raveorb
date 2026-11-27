# Development

## Prerequisites

- Node.js 22.13 or newer and npm.
- Expo Go or a development build on a device, an iOS Simulator, an Android emulator, or a browser.
- Phone and dev machine on the same network when testing the local API from a physical device.

```sh
cd frontend && npm install
cd ../backend && npm install
```

## Running the backend

```sh
cd backend
npm run dev        # tsx watch, port 3000 by default (PORT to change)
npm run build      # compile
npm start          # run compiled output
```

Copy `backend/.env.example` to `backend/.env` and fill in the values (see the variable table in [architecture.md](./architecture.md)). Never commit `.env` files and never read or paste their values anywhere. Health check: `GET /api/health`.

## Running the app

```sh
cd frontend
npm start          # or npm run ios / android / web
```

Set `EXPO_PUBLIC_API_BASE_URL` in `frontend/.env` to the backend origin (no `/api` suffix): `http://localhost:3000` for simulators/emulators, `http://<computer-LAN-address>:3000` for a physical phone. Leave it unset for the clearly labelled sample catalog. **Restart Expo after changing frontend environment variables.**

## Tests, lint, and typecheck

```sh
# Backend
cd backend
npm test                      # tsx --test tests/*.test.ts
npm run build                 # also serves as the backend typecheck

# Frontend
cd frontend
npm run typecheck             # tsc --noEmit
node --test tests/*.test.cjs  # all frontend tests (or pass a single file)
npm run lint                  # expo lint (ESLint flat config)
npm run doctor                # npx expo-doctor
```

Add or update tests for every behaviour change. The frontend tests mock native storage and file APIs; they do not replace testing on devices (see the manual regression checklist ideas in the feature docs).

## Git branch workflow

1. Create a focused feature branch from the integration branch: `git checkout -b feature/<name>`.
2. Inspect `git status` before editing; keep unrelated work intact.
3. Commit on the branch; run the relevant checks and review `git diff --check` plus the diff first.
4. Merge back with an explicit merge commit: `git checkout main && git merge --no-ff feature/<name>`.
5. Delete the branch: `git branch -d feature/<name>`.

Do not commit local `.env` files, device data (`backend/data/*.db*`), or secrets.

## Expo Go cache reset ("Cannot find native module" errors)

When Expo Go or Metro serves stale bundles — typically surfacing as `Cannot find native module '...'` — clear the Metro cache:

```sh
cd frontend
npx expo start -c
```

Then force-quit and reopen Expo Go on the device. If the error persists for a module that genuinely ships native code (e.g. `expo-calendar`), it is not a cache issue: Expo Go only bundles its built-in native modules, so the feature needs a development build (`npx expo run:ios|android` or `eas build --profile development`).

## Dev tools inside the app (development builds, `__DEV__` only)

On **My RaveOrb → Developer tools**:

- **Load / remove sample Nights** — eight fictional 2026 Nights plus a fictional Going event starting ~2 hours from now (unlocks Orbit, recommendations, and Beacon testing). Removal deletes everything whose event name starts with `[Sample]`.
- **Load / remove sample festival** — a two-day fictional festival with a prefilled, partially starred plan (planner + Beacon integration testing).
- **Night-of switches** — *Force Beacon window* and *Force after event* override Beacon's time window for testing.

See [frontend/AGENTS.md](../frontend/AGENTS.md) for Expo-specific agent/development conventions.
