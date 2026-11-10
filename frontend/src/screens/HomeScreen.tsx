import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import Logo from "../components/Logo";
import MetricCard from "../components/MetricCard";
import RecommendationCard from "../components/RecommendationCard";
import { Screen } from "../components/Screen";
import { formatEventSchedule } from "../lib/eventFormatting";
import { eventStatusStorage, type EventStatus } from "../lib/eventStatusStorage";
import { getHomeRecommendations } from "../lib/homeRecommendations";
import { calculateNightStats } from "../lib/nightStats";
import { nightsStorage } from "../lib/nightsStorage";
import { eventsRepository } from "../services/eventsRepository";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Night } from "../types/Night";
import type { EventEntry } from "../types/event";

export default function HomeScreen() {
  const [nights, setNights] = useState<Night[]>([]);
  const [statuses, setStatuses] = useState<Record<string, EventStatus>>({});
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [eventLoadError, setEventLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [retryToken, setRetryToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      setLoading(true);
      setLoadError(false);
      setNow(new Date());
      Promise.allSettled([nightsStorage.list(), eventStatusStorage.list(), eventsRepository.listEvents()])
        .then(([nightResult, statusResult, eventResult]) => {
          if (!isCurrent) return;
          if (nightResult.status === "fulfilled") {
            setNights(nightResult.value);
            setLoadError(false);
          } else {
            setLoadError(true);
          }
          if (statusResult.status === "fulfilled") setStatuses(statusResult.value);
          if (eventResult.status === "fulfilled") {
            setEvents(eventResult.value);
            setEventLoadError(null);
          } else {
            setEventLoadError(eventResult.reason instanceof Error ? eventResult.reason.message : "Could not load events.");
          }
        })
        .finally(() => {
          if (isCurrent) setLoading(false);
        });
      return () => { isCurrent = false; };
    }, [retryToken]),
  );

  const currentYear = String(now.getFullYear());
  const allTimePulse = useMemo(() => calculateNightStats(nights, null, now), [nights, now]);
  const yearPulse = useMemo(() => calculateNightStats(nights, currentYear, now), [currentYear, nights, now]);
  const recommendations = useMemo(() => getHomeRecommendations(nights, events, statuses, now), [events, nights, now, statuses]);
  const hasJournalBasedRecommendations = recommendations.some((item) => item.reason !== "Upcoming event in Discovery");
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const nextEvent = useMemo(() => {
    const futureEvents = events
      .filter((event) => event.date >= todayKey)
      .sort((first, second) => first.date.localeCompare(second.date) || first.startTime.localeCompare(second.startTime));
    const goingEvent = futureEvents.find((event) => statuses[event.id] === "going");
    if (goingEvent) return { event: goingEvent, status: "going" as const };
    const interestedEvent = futureEvents.find((event) => statuses[event.id] === "interested");
    return interestedEvent ? { event: interestedEvent, status: "interested" as const } : null;
  }, [events, now, statuses, todayKey]);
  const recentNights = useMemo(
    () => [...nights].sort((first, second) => second.date.localeCompare(first.date)).slice(0, 3),
    [nights],
  );

  return (
    <Screen edges={["top", "left", "right"]} style={styles.safeArea}>
      <LinearGradient
        colors={[colors.background, colors.backgroundElevated, colors.background]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerWrap}>
            <Logo size={230} background="dark" style={styles.heroLogo} />
            <Text style={styles.brandTag}>Discover the scene. Capture the experience.</Text>
          </View>

          <View style={styles.welcomeCard}>
            <Text style={styles.kicker}>Your scene, your history</Text>
            <Text style={styles.headline}>Find the night. Keep the memory.</Text>
            <Text style={styles.supportingText}>
              Explore electronic music events, then build a personal timeline of the artists,
              venues, friends, and moments that made each night yours.
            </Text>
          </View>

          <View style={styles.quickActions}>
            <QuickAction icon="compass-outline" label="Discover events" onPress={() => router.push("/(tabs)/events")} />
            <QuickAction icon="add" label="Add a Night" onPress={() => router.push("/night/new")} />
            <QuickAction icon="book-outline" label="My Nights" onPress={() => router.push("/(tabs)/nights")} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your pulse</Text>
            <Text style={styles.sectionMeta}>{currentYear}</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />
          ) : loadError ? (
            <Text style={styles.inlineMessage}>Your journal stats are temporarily unavailable.</Text>
          ) : (
            <View style={styles.statsGrid}>
              <MetricCard title="Nights this year" value={String(yearPulse.totalNights)} caption={yearPulse.totalNights === 1 ? "experience logged" : "experiences logged"} />
              <MetricCard title="Average rating" value={allTimePulse.ratedNightCount ? `${allTimePulse.averageRating.toFixed(1)}/5` : "Not yet"} caption={allTimePulse.ratedNightCount ? `${allTimePulse.ratedNightCount} rated nights · all time` : "rate a night to begin"} />
              <MetricCard title="Cities explored" value={String(allTimePulse.uniqueCities)} caption="in your journal" />
              <MetricCard title="Top venue" value={allTimePulse.mostVisitedVenue?.label ?? "Not yet"} caption={allTimePulse.mostVisitedVenue ? `${allTimePulse.mostVisitedVenue.value} visits · all time` : "log a night to begin"} />
            </View>
          )}

          <View style={styles.discoveryCard}>
            <Text style={styles.discoveryTitle}>Next up</Text>
            {eventLoadError ? (
              <View style={styles.nextEvent}>
                <Text style={styles.discoveryCopy}>{eventLoadError}</Text>
                <Pressable onPress={() => setRetryToken((token) => token + 1)} style={styles.discoveryButton} accessibilityRole="button">
                  <Text style={styles.discoveryButtonText}>Retry</Text>
                  <Ionicons name="refresh" size={17} color={colors.background} />
                </Pressable>
              </View>
            ) : nextEvent ? (
              <Pressable onPress={() => router.push({ pathname: "/event/[id]", params: { id: nextEvent.event.id } })} style={({ pressed }) => [styles.nextEvent, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${nextEvent.event.title}, marked ${nextEvent.status}`}>
                <View style={styles.eventMetaRow}>
                  <Text style={styles.discoveryHeadline} numberOfLines={2}>{nextEvent.event.title}</Text>
                  <Text style={styles.eventVibe}>{nextEvent.status === "going" ? "GOING" : "INTERESTED"}</Text>
                </View>
                <Text style={styles.eventLocation}>{nextEvent.event.venueName} · {nextEvent.event.city}</Text>
                <Text style={styles.discoveryCopy}>{formatEventSchedule(nextEvent.event)}</Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.discoveryHeadline}>Your next night is out there</Text>
                <Text style={styles.discoveryCopy}>Mark an event Interested or Going to keep it close at hand.</Text>
                <Pressable onPress={() => router.push("/(tabs)/events")} style={({ pressed }) => [styles.discoveryButton, pressed && styles.pressed]} accessibilityRole="button">
                  <Text style={styles.discoveryButtonText}>Explore events</Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.background} />
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>For you</Text>
            <Text style={styles.sectionMeta}>{hasJournalBasedRecommendations ? "Journal-based" : "Discovery"}</Text>
          </View>
          <Text style={styles.sectionDescription}>
            {hasJournalBasedRecommendations
              ? "Selected from genres and places in your journal history."
              : "Upcoming events from Discovery. Log attended genres or highly rated places to shape future picks."}
          </Text>

          {eventLoadError ? (
            <Text style={styles.inlineMessage}>Recommendations are unavailable while Discovery cannot be reached.</Text>
          ) : recommendations.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendationRow}
              style={styles.recommendationScroll}
            >
            {recommendations.map(({ event, reason }) => (
              <RecommendationCard
                key={event.id}
                title={event.title}
                subtitle={reason}
                tag={event.genres.slice(0, 2).join(" · ") || event.type}
                onPress={() => router.push({ pathname: "/event/[id]", params: { id: event.id } })}
              />
            ))}
            </ScrollView>
          ) : (
            <Text style={styles.inlineMessage}>No upcoming events to recommend right now.</Text>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent nights</Text>
            <Pressable onPress={() => router.push("/(tabs)/nights")} accessibilityRole="button" accessibilityLabel="View all Nights">
              <Text style={styles.sectionMeta}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.listWrap}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />
            ) : recentNights.length > 0 ? recentNights.map((night) => (
              <Pressable key={night.id} onPress={() => router.push({ pathname: "/night/[id]", params: { id: night.id } })} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${night.eventName}`}>
                {night.photos[0] ? (
                  <Image source={{ uri: night.photos[0] }} contentFit="cover" style={styles.recentThumbnail} accessibilityLabel={`${night.eventName} photo`} />
                ) : null}
                <View style={styles.recentContent}>
                  <View style={styles.eventMetaRow}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{night.eventName}</Text>
                    {night.rating > 0 ? <Text style={styles.eventVibe}>★ {night.rating}/5</Text> : null}
                  </View>
                  <Text style={styles.eventTime}>{night.venueName} · {night.city}</Text>
                  <Text style={styles.eventTime}>{formatNightDate(night.date)}</Text>
                </View>
              </Pressable>
            )) : (
              <Text style={styles.inlineMessage}>Your Night timeline will appear here after you log an experience.</Text>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerWrap: {
    alignItems: "center",
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  heroLogo: {
    marginBottom: spacing.xs,
  },
  brandTag: {
    maxWidth: 320,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.secondary,
    fontWeight: "700",
    textAlign: "center",
  },
  welcomeCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kicker: {
    marginBottom: spacing.sm,
    color: colors.secondary,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  headline: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  supportingText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickAction: {
    flex: 1,
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickActionText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  discoveryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  discoveryTitle: {
    color: colors.secondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
    fontWeight: "700",
  },
  discoveryHeadline: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  discoveryCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  nextEvent: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  eventLocation: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  discoveryButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  discoveryButtonText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sectionDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  recommendationScroll: {
    marginBottom: spacing.lg,
  },
  recommendationRow: {
    paddingRight: spacing.md,
  },
  inlineLoader: {
    marginVertical: spacing.lg,
  },
  inlineMessage: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: spacing.md,
  },
  listWrap: {
    marginBottom: spacing.lg,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  recentThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 8,
    marginRight: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  recentContent: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.xs,
  },
  eventMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  eventVibe: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  eventTime: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.8,
  },
});

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={19} color={colors.secondary} />
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

function formatNightDate(date: string): string {
  const parsedDate = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsedDate);
}
