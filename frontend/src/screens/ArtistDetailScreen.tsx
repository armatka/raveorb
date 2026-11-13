import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../components/EmptyState";
import { EventListItem } from "../components/EventListItem";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { getArtistHistory, getArtistUpcomingEvents, resolveArtist } from "../lib/artistResolver";
import { localDateKey } from "../lib/eventDiscovery";
import { DEFAULT_DISCOVERY_LOCATION, discoveryEventsQuery, loadDiscoveryLocation } from "../lib/discoveryLocation";
import { formatEventDate } from "../lib/eventFormatting";
import { goBackOrReplace } from "../lib/navigation";
import { nightsStorage } from "../lib/nightsStorage";
import { eventsRepository } from "../services/eventsRepository";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Night } from "../types/Night";
import type { EventEntry } from "../types/event";

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [nights, setNights] = useState<Night[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventError, setEventError] = useState(false);
  const [nightError, setNightError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [imageError, setImageError] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([loadDiscoveryLocation(), nightsStorage.list()]).then(async ([locationResult, nightResult]) => {
      if (!active) return;
      setNights(nightResult.status === "fulfilled" ? nightResult.value : []);
      setNightError(nightResult.status === "rejected");
      const location = locationResult.status === "fulfilled" ? locationResult.value : DEFAULT_DISCOVERY_LOCATION;
      try {
        const result = await eventsRepository.listEvents(discoveryEventsQuery(location));
        if (!active) return;
        setEvents(result);
        setEventError(false);
      } catch {
        if (!active) return;
        setEvents([]);
        setEventError(true);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [id, retryToken]));

  const artist = resolveArtist(id ?? "", events, nights);
  const history = getArtistHistory(id ?? "", nights);
  const upcoming = getArtistUpcomingEvents(id ?? "", events, localDateKey(new Date()));
  const retry = () => setRetryToken((token) => token + 1);

  return (
    <Screen edges={["left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader onBack={() => goBackOrReplace("/(tabs)/events")} />
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : !artist ? (
        <EmptyState title={eventError || nightError ? "Artist unavailable" : "Artist not found"} message={eventError || nightError ? "The artist could not be resolved from all sources." : "This artist is not in your events or journal."} icon="musical-notes-outline" action={eventError || nightError ? <RetryButton onPress={retry} /> : undefined} />
      ) : (
        <>
          <View style={styles.hero}>
            {artist.imageUrl && !imageError ? <Image source={{ uri: artist.imageUrl }} style={styles.portrait} contentFit="cover" accessibilityLabel={`${artist.name} portrait`} onError={() => setImageError(true)} /> : <View style={styles.fallback}><Ionicons name="musical-notes-outline" size={32} color={colors.secondary} /></View>}
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>ARTIST</Text>
              <Text style={styles.name}>{artist.name}</Text>
              {artist.genres.length ? <Text style={styles.genres}>Event genres: {artist.genres.join(" · ")}</Text> : null}
            </View>
          </View>

          <Text style={styles.sectionTitle}>YOUR HISTORY</Text>
          {nightError ? (
            <View style={styles.messageBlock}><Text style={styles.message}>Your journal history could not be loaded.</Text><RetryButton onPress={retry} /></View>
          ) : (
            <>
              <View style={styles.summary}>
                <View style={styles.metric}><Text style={styles.metricValue}>{history.nights.length}</Text><Text style={styles.metricLabel}>{history.nights.length === 1 ? "NIGHT" : "NIGHTS"}</Text></View>
                <View style={styles.metric}><Text style={styles.metricValue}>{history.averageRating === null ? "—" : `${history.averageRating.toFixed(1)} / 5`}</Text><Text style={styles.metricLabel}>AVG RATING</Text></View>
              </View>
              {history.nights.length ? (
                <>
                  <Text style={styles.seen}>Seen {history.nights.length} {history.nights.length === 1 ? "time" : "times"}</Text>
                  {history.cities.length ? <Text style={styles.meta}>{history.cities.join(" · ")}</Text> : null}
                  {history.venues.length ? <Text style={styles.meta}>Venues: {history.venues.join(" · ")}</Text> : null}
                  <Text style={styles.subheading}>MOST RECENT</Text>
                  <Text style={styles.meta}>{formatEventDate(history.nights[0].date)} · {history.nights[0].eventName}</Text>
                  <View style={styles.historyList}>
                    {history.nights.map((night) => (
                      <Pressable key={night.id} onPress={() => router.push({ pathname: "/night/[id]", params: { id: night.id } })} style={styles.historyRow} accessibilityRole="button" accessibilityLabel={`Open ${night.eventName}`}>
                        <View style={styles.historyText}><Text style={styles.historyDate}>{formatEventDate(night.date)}</Text><Text style={styles.historyName}>{night.eventName}</Text><Text style={styles.meta}>{night.venueName} · {night.city}</Text></View>
                        <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : <Text style={styles.message}>No Nights with this artist yet.</Text>}
            </>
          )}

          <Text style={styles.sectionTitle}>UPCOMING EVENTS</Text>
          {eventError ? <View style={styles.messageBlock}><Text style={styles.message}>Upcoming events could not be loaded.</Text><RetryButton onPress={retry} /></View>
            : upcoming.length ? upcoming.map((event) => <EventListItem key={event.id} event={event} />)
              : <Text style={styles.message}>No upcoming events found.</Text>}
        </>
      )}
    </Screen>
  );
}

function RetryButton({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry loading artist"><Text style={styles.retryText}>Retry</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
  loader: { marginTop: spacing.xxl },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.xl },
  portrait: { width: 96, height: 96, borderRadius: 8, backgroundColor: colors.surface },
  fallback: { width: 96, height: 96, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  heroText: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.secondary, fontSize: 10, fontWeight: "700", marginBottom: spacing.xs },
  name: { color: colors.text, fontSize: 28, fontWeight: "700" },
  genres: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: spacing.xs },
  sectionTitle: { color: colors.secondary, fontSize: 11, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.md },
  summary: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  metric: { flex: 1, minHeight: 76, justifyContent: "center", paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8 },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: "700" },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: spacing.xs },
  seen: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.xs },
  meta: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  subheading: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: spacing.md },
  historyList: { marginTop: spacing.md },
  historyRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyText: { flex: 1, minWidth: 0 },
  historyDate: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  historyName: { color: colors.text, fontSize: 15, fontWeight: "700", marginTop: spacing.xs },
  message: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  messageBlock: { alignItems: "flex-start", gap: spacing.sm },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: 8 },
  retryText: { color: colors.background, fontWeight: "700" },
});