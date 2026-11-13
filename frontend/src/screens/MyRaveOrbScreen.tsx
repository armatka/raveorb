import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { openArtist } from "../components/ArtistLinks";
import { EmptyState } from "../components/EmptyState";
import { openFriend } from "../components/FriendLinks";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatEventDate } from "../lib/eventFormatting";
import { discoveryEventsQuery, loadDiscoverySettings } from "../lib/discoveryLocation";
import { formatCurrency } from "../lib/formatCurrency";
import { goBackOrReplace } from "../lib/navigation";
import { calculateNightStats, calculateProfileStats } from "../lib/nightStats";
import { nightsStorage } from "../lib/nightsStorage";
import { eventsRepository } from "../services/eventsRepository";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Night } from "../types/Night";
import type { EventEntry } from "../types/event";

export default function MyRaveOrbScreen() {
  const [nights, setNights] = useState<Night[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [journalError, setJournalError] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setJournalError(false);
    setEvents([]);
    setEventsError(false);
    setEventsLoading(false);
    nightsStorage.list().then((items) => {
      if (!active) return;
      setNights(items);
      setSelectedYear((current) => current && items.some((night) => night.date.startsWith(`${current}-`)) ? current : null);
      setLoading(false);
      if (!items.some((night) => night.sourceEventId)) return;
      setEventsLoading(true);
      loadDiscoverySettings()
        .then((preferences) => eventsRepository.listEvents(discoveryEventsQuery(preferences.location, preferences.radiusKm)))
        .then((result) => { if (active) setEvents(result); })
        .catch(() => { if (active) setEventsError(true); })
        .finally(() => { if (active) setEventsLoading(false); });
    }).catch(() => { if (active) { setJournalError(true); setLoading(false); } });
    return () => { active = false; };
  }, [retryToken]));

  const profile = useMemo(() => calculateProfileStats(nights, events), [nights, events]);
  const recapYear = selectedYear ?? profile.years[0] ?? null;
  const recap = useMemo(() => calculateNightStats(nights, recapYear), [nights, recapYear]);
  const retry = () => setRetryToken((token) => token + 1);
  const stats = profile.stats;

  return (
    <Screen edges={["left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader onBack={() => goBackOrReplace("/(tabs)")} />
      <Text style={styles.eyebrow}>MY RAVEORB</Text>
      <Text style={styles.title}>Your scene. Your history.</Text>
      <InfoRow label="Preferences" value="Manage saved settings" onPress={() => router.push("/preferences")} accessibilityLabel="Open Preferences" />
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : journalError ? (
        <EmptyState title="Profile unavailable" message="Your journal could not be loaded." icon="alert-circle-outline" action={<Action label="Retry" icon="refresh" onPress={retry} />} />
      ) : nights.length === 0 ? (
        <EmptyState title="Your RaveOrb" message="Your RaveOrb comes to life as you capture your nights." icon="sparkles-outline" action={<View style={styles.emptyActions}><Action label="Discover events" icon="compass-outline" onPress={() => router.push("/(tabs)/events")} /><Action label="Add your first Night" icon="add" onPress={() => router.push("/night/new")} /></View>} />
      ) : (
        <>
          <View style={styles.heroSummary}>
            <Text style={styles.heroCount}>{stats.totalNights}</Text>
            <Text style={styles.heroCaption}>{stats.totalNights === 1 ? "NIGHT" : "NIGHTS"}</Text>
            <Text style={styles.heroDates}>{profile.firstNightDate ? formatEventDate(profile.firstNightDate) : "—"}  ·  {profile.mostRecentNightDate ? formatEventDate(profile.mostRecentNightDate) : "—"}</Text>
            <Text style={styles.muted}>First Night  ·  Most recent Night</Text>
          </View>
          <View style={styles.metrics}>
            <Metric label="CITIES" value={String(stats.uniqueCities)} />
            <Metric label="VENUES" value={String(stats.uniqueVenues)} />
            <Metric label="ARTISTS" value={String(stats.uniqueArtists)} />
          </View>

          <Section title="MUSIC IDENTITY" />
          <InfoRow label="Most-seen artist" value={stats.mostSeenArtist?.label ?? "Not yet"} onPress={stats.mostSeenArtist ? () => openArtist(stats.mostSeenArtist!.label) : undefined} />
          <InfoRow label="Most active year" value={profile.mostActiveYear ? `${profile.mostActiveYear[0]} · ${nightCount(profile.mostActiveYear[1])}` : "Not yet"} />
          <InfoRow label="Most active month" value={profile.mostActiveMonth ? `${formatMonth(profile.mostActiveMonth[0])} · ${nightCount(profile.mostActiveMonth[1])}` : "Not yet"} />
          <Text style={styles.subheading}>TOP GENRES · LINKED EVENTS</Text>
          {eventsLoading ? <ActivityIndicator color={colors.primary} style={styles.inlineLoader} /> : eventsError ? <View style={styles.inlineError}><Text style={styles.muted}>Linked event genres unavailable.</Text><Pressable onPress={retry} style={styles.retryInline} accessibilityRole="button" accessibilityLabel="Retry loading linked event genres"><Text style={styles.linkText}>Retry</Text></Pressable></View> : profile.topGenres.length ? <Text style={styles.body}>{profile.topGenres.map((item) => `${item.label} (${item.value})`).join(" · ")}</Text> : <Text style={styles.muted}>No linked event genres available.</Text>}

          <Section title="PLACES" />
          <InfoRow label="Top venue" value={stats.mostVisitedVenue?.label ?? "Not yet"} />
          <InfoRow label="Most visited city" value={stats.mostFrequentCity?.label ?? "Not yet"} />
          <InfoRow label="Venues visited" value={String(stats.uniqueVenues)} />
          <Text style={styles.subheading}>CITIES VISITED</Text>
          <Text style={styles.body}>{stats.nightsByCity.map((item) => item.label).join(" · ") || "None yet"}</Text>

          <Section title="PEOPLE" />
          <InfoRow label="Friends in your journal" value={String(stats.uniqueFriends)} />
          {stats.friendsByFrequency.slice(0, 5).map((friend) => <InfoRow key={friend.label} label={friend.label} value={`${friend.value} ${friend.value === 1 ? "Night" : "Nights"}`} onPress={() => openFriend(friend.label)} accessibilityLabel={`View shared history with ${friend.label}`} />)}
          {!stats.friendsByFrequency.length ? <Text style={styles.muted}>No friends recorded yet.</Text> : null}

          <Section title="ARTISTS" />
          {profile.topArtists.length ? profile.topArtists.map((artist) => <InfoRow key={artist.label} label={artist.label} value={`${artist.value} ${artist.value === 1 ? "Night" : "Nights"}${artist.mostRecentDate ? ` · ${formatEventDate(artist.mostRecentDate)}` : ""}`} onPress={() => openArtist(artist.label)} accessibilityLabel={`View artist ${artist.label}`} />) : <Text style={styles.muted}>No artists recorded yet.</Text>}

          <Section title="YOUR NUMBERS" />
          <View style={styles.metrics}>
            <Metric label="NIGHTS" value={String(stats.totalNights)} />
            <Metric label="AVG RATING" value={stats.ratedNightCount ? stats.averageRating.toFixed(1) : "—"} />
            <Metric label="PHOTOS" value={String(stats.totalPhotos)} />
            <Metric label="ARTISTS" value={String(stats.uniqueArtists)} />
            <Metric label="VENUES" value={String(stats.uniqueVenues)} />
            <Metric label="CITIES" value={String(stats.uniqueCities)} />
            <Metric label="FRIENDS" value={String(stats.uniqueFriends)} />
          </View>

          <Section title="SPEND" />
          {stats.spending.length ? stats.spending.map((item) => <InfoRow key={item.currency} label={item.currency} value={formatCurrency(item.total, item.currency)} />) : <Text style={styles.muted}>No spending recorded.</Text>}

          <Section title="MILESTONES" />
          {profile.milestones.map((milestone) => (
            <View key={milestone.category} style={styles.milestone}>
              <View style={styles.milestoneHeader}><Text style={styles.body}>{milestone.category}</Text><Text style={styles.muted}>{milestone.next ? `${milestone.current} / ${milestone.next}` : `${milestone.current} · Complete`}</Text></View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${milestone.next ? Math.min(100, milestone.current / milestone.next * 100) : 100}%` }]} /></View>
              <Text style={styles.muted}>{milestone.achieved.length ? `Achieved: ${milestone.achieved.join(", ")} ${milestone.category}` : "No milestones yet"}</Text>
            </View>
          ))}

          <Section title="YEAR RECAP" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRail}>
            {profile.years.map((year) => <Pressable key={year} onPress={() => setSelectedYear(year)} style={[styles.yearButton, recapYear === year && styles.yearSelected]} accessibilityRole="radio" accessibilityState={{ checked: recapYear === year }} aria-checked={recapYear === year} accessibilityLabel={`Show ${year} recap`}><Text style={[styles.yearText, recapYear === year && styles.yearTextSelected]}>{year}</Text></Pressable>)}
          </ScrollView>
          {recapYear ? <>
            <Text style={styles.recapTitle}>{recapYear} RECAP</Text>
            <View style={styles.metrics}><Metric label="NIGHTS" value={String(recap.totalNights)} /><Metric label="ARTISTS" value={String(recap.uniqueArtists)} /><Metric label="CITIES" value={String(recap.uniqueCities)} /><Metric label="PHOTOS" value={String(recap.totalPhotos)} /></View>
            <InfoRow label="Top venue" value={recap.mostVisitedVenue?.label ?? "Not yet"} />
            <InfoRow label="Top artist" value={recap.mostSeenArtist?.label ?? "Not yet"} onPress={recap.mostSeenArtist ? () => openArtist(recap.mostSeenArtist!.label) : undefined} />
          </> : <Text style={styles.muted}>No dated Nights to recap.</Text>}
        </>
      )}
    </Screen>
  );
}

function formatMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, value - 1, 1)));
}

function nightCount(count: number) { return `${count} ${count === 1 ? "Night" : "Nights"}`; }

function Section({ title }: { title: string }) { return <Text style={styles.section}>{title}</Text>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function InfoRow({ label, value, onPress, accessibilityLabel }: { label: string; value: string; onPress?: () => void; accessibilityLabel?: string }) {
  return <Pressable style={styles.infoRow} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "link" : undefined} accessibilityLabel={onPress ? accessibilityLabel ?? `View artist ${value}` : undefined}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, onPress && styles.linkText]}>{value}</Text>{onPress ? <Ionicons name="chevron-forward" size={16} color={colors.secondary} /> : null}</Pressable>;
}
function Action({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityLabel={label}><Ionicons name={icon} size={18} color={colors.background} /><Text style={styles.actionText}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
  loader: { marginTop: spacing.xxl },
  eyebrow: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  title: { color: colors.text, fontSize: 26, fontWeight: "700", marginTop: spacing.xs, marginBottom: spacing.lg },
  heroSummary: { paddingVertical: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  heroCount: { color: colors.text, fontSize: 38, fontWeight: "700" },
  heroCaption: { color: colors.secondary, fontSize: 10, fontWeight: "700" },
  heroDates: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm },
  muted: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { width: "31%", flexGrow: 1, minHeight: 72, justifyContent: "center", paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8 },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: "700" },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: spacing.xs },
  section: { color: colors.secondary, fontSize: 11, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.sm },
  infoRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.textSecondary, fontSize: 13, flex: 1, minWidth: 0 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  linkText: { color: colors.secondary },
  subheading: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: spacing.md, marginBottom: spacing.xs },
  body: { color: colors.text, fontSize: 13, lineHeight: 20 },
  inlineLoader: { alignSelf: "flex-start", marginVertical: spacing.sm },
  inlineError: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  retryInline: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  milestone: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  milestoneHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  progressTrack: { height: 5, backgroundColor: colors.surfaceAlt, borderRadius: 3, marginVertical: spacing.sm, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: colors.primary },
  yearRail: { gap: spacing.sm, paddingVertical: spacing.sm },
  yearButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface },
  yearSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  yearText: { color: colors.textSecondary, fontWeight: "700", fontSize: 12 },
  yearTextSelected: { color: colors.background },
  recapTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginVertical: spacing.md },
  emptyActions: { gap: spacing.sm },
  action: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: 8 },
  actionText: { color: colors.background, fontWeight: "700", fontSize: 12 },
});