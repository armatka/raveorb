import { colors } from "../theme/colors";

export const homeContent = {
  hero: {
    headline: "Discover the scene. Live the night. Get home safe.",
    subhead: "RaveOrb finds the parties worth going to, keeps a record of every night, and lets the people who matter know you're good.",
    primaryCta: "Find events near me",
    secondaryCta: "Light your Beacon",
    profile: "My RaveOrb",
    artistAlerts: "Artist alerts",
    artistAlertsCount: (count: number) => `Artist alerts (${count})`,
    changes: (count: number) => count === 1 ? "1 of your events changed" : `${count} of your events changed`,
    updatesError: "Some event or artist updates could not be refreshed.",
    logoLabel: "RaveOrb",
  },
  beacon: {
    badge: "Beacon",
    title: "Light your Beacon before you go.",
    // TODO: Missed-check-in alerts are not implemented; do not promise automatic notifications.
    body: "Share your event, venue, address and expected home time with someone you trust. When you're back, tap \"I'm home\" to share a check-in. Nothing is sent automatically.",
    tagline: "Your night, your people, your peace of mind.",
    cta: "Light your Beacon",
    guidance: "Choose a Going event in Your events, or open one below when its Beacon window begins.",
    tonight: (title: string) => `Tonight: ${title}`,
    tonightAccessibility: (title: string) => `Open Beacon for ${title}`,
    loadError: "Some Going events could not be loaded.",
    retry: "Retry loading Going events",
  },
  panels: [
    { key: "discover", title: "Find Your Night", subtitle: "Every rave, warehouse party and festival near you, filtered to your sound.", route: "/(tabs)/events", icon: "compass-outline", accent: colors.secondary, testID: "home-panel-discover" },
    { key: "capture", title: "Capture the Moment", subtitle: "Log the sets, the tracks, the photos and how it felt before the memory fades.", route: "/(tabs)/nights", icon: "book-outline", accent: colors.accent, testID: "home-panel-capture" },
    // TODO: Add a crew destination when a social/people screen exists.
    { key: "connect", title: "Find Your Crew", subtitle: "Meet people who move to the same music and plan the next one together.", route: null, icon: "people-outline", accent: colors.platinum, testID: "home-panel-connect", comingSoon: true },
    { key: "orbit", title: "Your Orbit", subtitle: "Every night adds up to your story. Look back on your year in music and share it.", route: "/orbit", icon: "planet-outline", accent: colors.primary, testID: "home-panel-orbit" },
    { key: "profile", title: "My RaveOrb", subtitle: "Your nights, stats, and personal music story.", route: "/my-raveorb", icon: "person-circle-outline", accent: colors.secondary, testID: "home-panel-profile" },
    { key: "artist-alerts", title: "Artist Alert", subtitle: "See upcoming events from artists you follow.", route: "/artist-alerts", icon: "notifications-outline", accent: colors.accent, testID: "home-panel-artist-alerts" },
  ],
  comingSoon: "Coming soon",
  closing: "From first beat to safe home: RaveOrb.",
} as const;
