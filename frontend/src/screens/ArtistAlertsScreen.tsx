import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import type { ArtistAlert } from "../lib/artistMatching";
import { formatEventDate } from "../lib/eventFormatting";
import { followedArtistsStorage } from "../lib/followedArtistsStorage";
import { goBackOrReplace } from "../lib/navigation";
import { listArtistAlerts } from "../services/artistAlertsService";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export default function ArtistAlertsScreen() {
  const [alerts, setAlerts] = useState<ArtistAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    listArtistAlerts().then(async (items) => {
      if (!active) return;
      setAlerts(items);
      setError(false);
      // Shown once here, so Home will not announce these events again.
      const unseen = items.filter((alert) => !alert.seenAt).map((alert) => alert.eventId);
      if (unseen.length) await followedArtistsStorage.markAlertsSeen(unseen);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  return (
    <Screen edges={["left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader title="Artists near you" onBack={() => goBackOrReplace("/(tabs)")} />
      {error ? <Text style={styles.error}>Artist alerts could not be loaded.</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : alerts.length ? alerts.map((alert) => (
        <Pressable key={alert.eventId} onPress={() => router.push({ pathname: "/event/[id]", params: { id: alert.eventId } })} style={styles.card} accessibilityRole="button" accessibilityLabel={`Open ${alert.title}`}>
          <View style={styles.header}>
            <Text style={styles.artists}>{alert.artistNames.join(", ")}</Text>
            {!alert.seenAt ? <Text style={styles.badge}>NEW</Text> : null}
          </View>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={styles.detail}>{formatEventDate(alert.date)} · {alert.venueName} · {alert.city}</Text>
        </Pressable>
      )) : !error ? <Text style={styles.detail}>No upcoming events from artists you follow near your saved location.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  artists: { flex: 1, color: colors.secondary, fontSize: 12, fontWeight: "700" },
  badge: { color: colors.primary, fontSize: 10, fontWeight: "700" },
  title: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: spacing.xs },
  detail: { color: colors.textSecondary, marginTop: spacing.xs },
  error: { color: colors.error, marginBottom: spacing.md },
});
