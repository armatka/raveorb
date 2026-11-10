import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../components/EmptyState";
import { NightCard } from "../components/NightCard";
import { Screen } from "../components/Screen";
import { nightsStorage } from "../lib/nightsStorage";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Night } from "../types/Night";

export default function MyNightsScreen() {
  const [nights, setNights] = useState<Night[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      setLoading(true);
      setError(false);
      nightsStorage.list()
        .then((items) => {
          if (isCurrent) setNights(items);
        })
        .catch(() => {
          if (isCurrent) setError(true);
        })
        .finally(() => {
          if (isCurrent) setLoading(false);
        });
      return () => { isCurrent = false; };
    }, []),
  );

  return (
    <Screen edges={["top", "left", "right"]} scrollable style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR ARCHIVE</Text>
          <Text style={styles.title}>My Nights</Text>
          <Text style={styles.subtitle}>{nights.length} {nights.length === 1 ? "night" : "nights"} remembered</Text>
        </View>
        <Pressable onPress={() => router.push("/night/new")} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add a night">
          <Ionicons name="add" size={22} color={colors.background} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : error ? (
        <EmptyState title="Journal unavailable" message="Your nights could not be loaded. Check your device storage and try again." icon="alert-circle-outline" />
      ) : nights.length === 0 ? (
        <EmptyState
          title="Start your archive"
          message="Capture the artists, people, and moments that made a night yours."
          icon="moon-outline"
          action={(
            <Pressable onPress={() => router.push("/night/new")} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Add your first night</Text>
            </Pressable>
          )}
        />
      ) : (
        <View style={styles.list}>
          {nights.map((night) => <NightCard key={night.id} night={night} />)}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  eyebrow: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  addButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: colors.primary,
  },
  loader: {
    marginTop: 80,
  },
  list: {
    gap: spacing.sm,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyButtonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "800",
  },
});
