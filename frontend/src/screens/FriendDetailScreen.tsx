import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ArtistLinks } from "../components/ArtistLinks";
import { EmptyState } from "../components/EmptyState";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatEventDate } from "../lib/eventFormatting";
import { getFriendHistory } from "../lib/friendHistory";
import { goBackOrReplace } from "../lib/navigation";
import { nightsStorage } from "../lib/nightsStorage";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Night } from "../types/Night";

export default function FriendDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const [nights, setNights] = useState<Night[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(false);
    nightsStorage.list()
      .then((items) => { if (active) setNights(items); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [name, retryToken]));

  const history = getFriendHistory(typeof name === "string" ? name : "", nights);

  return (
    <Screen edges={["left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader onBack={() => goBackOrReplace("/(tabs)/nights")} />
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : error ? (
        <EmptyState title="History unavailable" message="Your journal could not be loaded." icon="alert-circle-outline" action={<Pressable onPress={() => setRetryToken((token) => token + 1)} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry loading friend history"><Text style={styles.retryText}>Retry</Text></Pressable>} />
      ) : !history.name ? (
        <EmptyState title="Friend not found" message="No Nights include this name." icon="people-outline" />
      ) : (
        <>
          <Text style={styles.eyebrow}>SHARED HISTORY</Text>
          <Text style={styles.name}>{history.name}</Text>
          <Text style={styles.sectionTitle}>TOGETHER</Text>
          <View style={styles.metrics}>
            <Metric label="NIGHTS" value={String(history.nights.length)} />
            <Metric label="CITIES" value={String(history.cities.length)} />
            <Metric label="VENUES" value={String(history.venues.length)} />
            <Metric label="ARTISTS" value={String(history.artists.length)} />
            <Metric label="PHOTOS" value={String(history.photos.length)} />
            <Metric label="AVG RATING" value={history.averageRating === null ? "—" : `${history.averageRating.toFixed(1)} / 5`} />
          </View>
          {history.cities.length ? <Text style={styles.meta}>{history.cities.map((item) => item.label).join(" · ")}</Text> : null}
          {history.mostRecentNight ? <Text style={styles.recent}>Most recent: {formatEventDate(history.mostRecentNight.date)} · {history.mostRecentNight.eventName}</Text> : null}

          <Text style={styles.sectionTitle}>NIGHTS TOGETHER</Text>
          {history.nights.map((night) => (
            <Pressable key={night.id} onPress={() => router.push({ pathname: "/night/[id]", params: { id: night.id } })} style={styles.historyRow} accessibilityRole="button" accessibilityLabel={`Open ${night.eventName}`}>
              <View style={styles.historyText}><Text style={styles.historyDate}>{formatEventDate(night.date)}</Text><Text style={styles.historyName}>{night.eventName}</Text><Text style={styles.meta}>{night.venueName} · {night.city}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
            </Pressable>
          ))}

          <Text style={styles.sectionTitle}>MEMORIES</Text>
          {history.photos.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {history.photos.map((photo) => (
                <Pressable key={photo.uri} onPress={() => router.push({ pathname: "/night/[id]", params: { id: photo.nightId } })} accessibilityRole="button" accessibilityLabel={`Open photo from ${photo.eventName}`}>
                  <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.photo} accessibilityLabel={`Photo from ${photo.eventName}`} />
                </Pressable>
              ))}
            </ScrollView>
          ) : <Text style={styles.meta}>No photos from shared Nights yet.</Text>}

          <Text style={styles.sectionTitle}>ARTISTS</Text>
          {history.mostFrequentArtist ? <Text style={styles.meta}>Most seen: {history.mostFrequentArtist.label} · {history.mostFrequentArtist.count} {history.mostFrequentArtist.count === 1 ? "Night" : "Nights"}</Text> : <Text style={styles.meta}>No artists recorded yet.</Text>}
          {history.artists.length ? <View style={styles.links}><ArtistLinks names={history.artists.map((item) => item.label)} /></View> : null}

          <Text style={styles.sectionTitle}>VENUES</Text>
          {history.mostFrequentVenue ? <Text style={styles.meta}>Most visited: {history.mostFrequentVenue.label} · {history.mostFrequentVenue.count} {history.mostFrequentVenue.count === 1 ? "Night" : "Nights"}</Text> : null}
          {history.venues.length ? <Text style={styles.venueList}>{history.venues.map((item) => item.label).join(" · ")}</Text> : <Text style={styles.meta}>No venues recorded yet.</Text>}
        </>
      )}
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
  loader: { marginTop: spacing.xxl },
  eyebrow: { color: colors.secondary, fontSize: 10, fontWeight: "700", marginBottom: spacing.xs },
  name: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sectionTitle: { color: colors.secondary, fontSize: 11, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.md },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  metric: { width: "31%", flexGrow: 1, minHeight: 76, justifyContent: "center", paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8 },
  metricValue: { color: colors.text, fontSize: 19, fontWeight: "700" },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: spacing.xs },
  meta: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  recent: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  historyRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyText: { flex: 1, minWidth: 0 },
  historyDate: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  historyName: { color: colors.text, fontSize: 15, fontWeight: "700", marginTop: spacing.xs },
  photoRow: { gap: spacing.sm },
  photo: { width: 120, height: 120, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  links: { marginTop: spacing.sm },
  venueList: { color: colors.text, fontSize: 14, lineHeight: 22, marginTop: spacing.sm },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: 8 },
  retryText: { color: colors.background, fontWeight: "700" },
});