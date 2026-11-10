import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import type { Night } from "../types/Night";
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
    <Link href={{ pathname: "/night/[id]", params: { id: night.id } }} style={styles.link}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.date}>{formatDate(night.date)}</Text>
          {night.rating > 0 ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={13} color={colors.primary} />
              <Text style={styles.ratingText}>{night.rating}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.name} numberOfLines={1}>{night.eventName}</Text>
        <Text style={styles.location} numberOfLines={1}>{night.venueName} · {night.city}</Text>
        {night.artistsSeen.length > 0 ? (
          <Text style={styles.artists} numberOfLines={1}>{night.artistsSeen.join(" · ")}</Text>
        ) : null}
        <View style={styles.bottomRow}>
          <Text style={styles.photoCount}>{night.photos.length > 0 ? `${night.photos.length} photo${night.photos.length === 1 ? "" : "s"}` : "Night journal"}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.secondary} />
        </View>
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
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
});
