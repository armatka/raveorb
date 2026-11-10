import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../../components/EmptyState";
import { Screen } from "../../components/Screen";
import { eventsRepository } from "../../services/eventsRepository";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import type { Venue } from "../../types/venue";

export default function VenuesScreen() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      setLoading(true);
      eventsRepository.listVenues()
        .then((items) => {
          if (!isCurrent) return;
          setVenues(items);
          setError(null);
        })
        .catch((reason: unknown) => {
          if (isCurrent) setError(reason instanceof Error ? reason.message : "Could not load venues.");
        })
        .finally(() => {
          if (isCurrent) setLoading(false);
        });
      return () => { isCurrent = false; };
    }, [retryToken]),
  );

  return (
    <Screen edges={["top", "left", "right"]} scrollable style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Favorite venues</Text>

      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      {!loading && error ? (
        <EmptyState
          title="Venues unavailable"
          message={error}
          icon="cloud-offline-outline"
          action={<Pressable onPress={() => setRetryToken((token) => token + 1)} style={styles.retryButton} accessibilityRole="button" accessibilityLabel="Retry loading venues"><Text style={styles.retryText}>Retry</Text></Pressable>}
        />
      ) : null}
      {!loading && !error && venues.length === 0 ? (
        <EmptyState title="No venues yet" message="Venues will appear when event listings are available." icon="location-outline" />
      ) : null}
      {!loading && !error ? venues.map((venue) => (
        <View key={venue.id} style={styles.card}>
          <Text style={styles.name}>{venue.name}</Text>
          <Text style={styles.meta}>{venue.city}{venue.countryCode ? `, ${venue.countryCode}` : ""}</Text>
          <Text style={styles.meta}>{venue.type}</Text>
          <Text style={styles.meta}>{venue.visits} visits</Text>
        </View>
      )) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.lg,
  },
  loader: {
    marginTop: spacing.xxl * 2,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  retryText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 2,
  },
});
