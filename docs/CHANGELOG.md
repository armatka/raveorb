# Changelog

Newest first. One entry per merged feature, built from `git log --merges --oneline`. Two features landed as direct commits to the integration branch and are marked *(direct commit)*.

## 2026-11-26

- **Home icon consistency** (`fix/home-icon-consistency`) — Home top icons match the panels; Orbit shortcut added to the icon bar.
- **Calendar tab** (`feature/calendar-tab`) — Calendar replaces the Venues tab; month view of saved events and Nights; Venues opens from Home.
- **Status-bar safe area** (`fix/status-bar-safe-area`) — `Screen` owns the top safe-area inset; content no longer renders under the status bar.
- **Home redesign** (`feature/home-redesign`) — centered enlarged logo hero with reduce-motion support, reusable HomePanel with a responsive six-panel grid, icon bar with profile and alert links, shared home theme tokens.
- **Festival planner** *(direct commit)* — device-local planner with clash detection, stage grid, and Beacon integration; dev sample festival.
- **Night-of mode (Beacon)** (`feature/night-of-mode`) — set times, meeting spot, share-my-plan and "I'm home" check-in, dev test switches.

## 2026-11-25

- **Smart recommendations** (`feature/smart-recommendations`) — taste profile, explainable "Picked for you" rail, For-you sort, Not interested.
- **Orbit** (`feature/orbit`) — year-in-review with shareable card; dev sample Nights.
- **Add to calendar** (`feature/add-to-calendar`) — device-calendar integration (dev builds), ESLint setup and lint fixes.

## 2026-11-24

- **Follow artists** (`feature/follow-artists`) — follows with suggestions, nearby artist alerts, Discovery "Following" filter.
- **Event changes** (`feature/event-changes`) — cancellations, postponements, and material changes detected and surfaced in-app.
- **Deduplication** (`feature/deduplication`) — cross-provider event deduplication and duplicate warnings in admin review.

## 2026-11-13

- **Submit an event + admin review** *(direct commit)* — community submissions with SQLite storage and approve-first moderation.
- **Event source abstraction** (`feature/event-source-abstraction`) — provider contract and registry; Ticketmaster pagination-total fix.
- **Saved preferences** (`feature/saved-preferences`) — cities, favourite styles, radius, and default date range.

## 2026-11-12

- **Location-aware discovery** (`feature/location-aware-discovery`) — city search with country selection via Open-Meteo, presets, and radius search.
- **Electronic discovery** (`feature/electronic-discovery`) — electronic classification and relevance layer.
- **Ticketmaster discovery** (`feature/ticketmaster-discovery`) — Ticketmaster Discovery API integration behind the backend.
