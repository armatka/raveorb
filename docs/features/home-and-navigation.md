# Home screen and navigation

## What it does for the user

Home is the app's hub: a centered animated logo hero (with reduce-motion support), primary calls to action ("Find events near me", "Light your Beacon"), an icon bar (My RaveOrb, Venues, Artist alerts, Orbit shortcut), a Beacon spotlight for tonight's Going event, dismissible event-change and artist-alert notices, the "Picked for you" rail, an Orbit invitation in December/January, and a responsive six-panel grid linking to the main areas. Navigation is five tabs — Home, My Nights, Events, Calendar, Stats — plus stack routes for details.

## Where it lives in the code

- Root navigation: `frontend/src/app/_layout.tsx` (expo-router `Stack` inside `SafeAreaProvider`), tabs in `frontend/src/app/(tabs)/_layout.tsx`.
- Routes: files under `frontend/src/app/` — tabs (`index`, `nights`, `events`, `calendar`, `stats`) and stack routes (`event/[id]`, `night/new`, `night/[id]`, `night/[id]/edit`, `artist/[id]`, `beacon/[id]` with legacy redirect `night-of/[id]`, `planner/[id]`, `friend/[name]`, `orbit`, `venues`, `my-raveorb`, `preferences`, `following`, `artist-alerts`, `event-changes`, `submit-event`, `admin-review`). Route files only render screens from `frontend/src/screens/`.
- Home implementation: `frontend/src/screens/HomeScreen.tsx` with components in `frontend/src/components/home/` (`HomeHero`, `HomeIconBar`, `HomePanel`, `HomePanelGrid`, `BeaconSpotlight`, `HomeButton`) and copy in `frontend/src/constants/homeContent.ts`.
- Safe areas: `frontend/src/components/Screen.tsx` always owns the **top** safe-area inset (callers may add only non-top edges) and handles keyboard avoidance per platform; headers come from `frontend/src/components/ScreenHeader.tsx`.
- Navigation conventions: navigation hooks are imported from `expo-router` only — an ESLint `no-restricted-imports` rule blocks `@react-navigation/*` imports (see `frontend/eslint.config.js`); `frontend/src/lib/navigation.ts` provides `goBackOrReplace`. Reduce-motion lives in `frontend/src/lib/useReduceMotion.ts`.

## Data / storage

- Home stores nothing itself; it reads Nights, statuses, follows, preferences, and the Orbit dismissal from their own stores. Loading Home triggers the tracked-event refresh and artist-alert refresh (each at most once per six hours).

## Limits and known gaps

- Home refreshes up to 25 upcoming Going/Interested snapshots per window, rotating through larger lists; refresh errors are shown as a single dismissible notice.
- The Beacon spotlight only appears for Going events inside their Beacon window.

## How to test

- Frontend: `node --test tests/home.test.cjs tests/navigation-imports.test.cjs tests/screen-top-inset.test.cjs` from `frontend/`.
- Manually: open each tab directly and via the tab bar, open detail routes directly by URL, verify back navigation and missing-ID states, and check the status bar / notch / home indicator for overlap on iOS, Android, and web. With reduce motion enabled, the hero must not animate. The dev sample Nights + sample festival populate the rail, spotlight, and Orbit invitation.
