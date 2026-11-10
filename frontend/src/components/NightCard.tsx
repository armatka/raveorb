import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Night } from "../types/Night";
import { formatCurrency } from "../lib/formatCurrency";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type NightCardProps = {
  night: Night;
};

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function NightCard({ night }: NightCardProps) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/night/[id]", params: { id: night.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${night.eventName}`}
    >
        <View style={styles.topRow}>
          <Text style={styles.date}>{formatDate(night.date)}</Text>
          <View style={styles.topActions}>
            {night.rating > 0 ? (
              <View style={styles.rating}>
                <Ionicons name="star" size={13} color={colors.primary} />
                <Text style={styles.ratingText}>{night.rating}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                router.push({ pathname: "/night/[id]/edit", params: { id: night.id } });
              }}
              style={({ pressed }) => [styles.editButton, pressed && styles.editPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${night.eventName}`}
              hitSlop={0}
            >
              <Ionicons name="create-outline" size={18} color={colors.secondary} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.name} numberOfLines={1}>{night.eventName}</Text>
        <Text style={styles.location} numberOfLines={1}>{night.venueName} · {night.city}</Text>
        {night.artistsSeen.length > 0 ? (
          <Text style={styles.artists} numberOfLines={1}>{night.artistsSeen.join(" · ")}</Text>
        ) : null}
        <View style={styles.bottomRow}>
          <Text style={styles.photoCount}>{night.photos.length > 0 ? `${night.photos.length} photo${night.photos.length === 1 ? "" : "s"}` : "Night journal"}</Text>
          <Text style={styles.cost}>{formatCurrency(night.cost, night.currency)}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.secondary} />
        </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.88,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  editButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  editPressed: {
    backgroundColor: "rgba(212, 175, 55, 0.2)",
  },
  date: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  name: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 4,
  },
  location: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  artists: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  photoCount: {
    color: colors.muted,
    fontSize: 11,
  },
  cost: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: "auto",
    marginRight: spacing.md,
  },
});
