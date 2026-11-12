import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Night } from "../types/Night";
import { formatCurrency } from "../lib/formatCurrency";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { ArtistLinks } from "./ArtistLinks";
import { FriendLinks } from "./FriendLinks";

type NightCardProps = {
  night: Night;
  layout?: "timeline" | "compact";
  showConnector?: boolean;
};

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function NightCard({ night, layout = "timeline", showConnector = true }: NightCardProps) {
  const isTimeline = layout === "timeline";

  return (
    <View style={isTimeline ? styles.timelineRow : styles.compactRow}>
      {isTimeline ? (
        <View style={styles.timelineRail}>
          <View style={styles.timelineMarker} />
          <View style={[styles.timelineConnector, !showConnector && styles.lastConnector]} />
        </View>
      ) : null}
      <View style={styles.cardSurface}>
        <Pressable
          onPress={() => router.push({ pathname: "/night/[id]", params: { id: night.id } })}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="button"
          accessibilityLabel={`Open ${night.eventName}`}
        >
        <View style={styles.topRow}>
          <Text style={styles.date}>{formatDate(night.date)}</Text>
          <View style={styles.topActions}>
            {night.rating > 0 ? (
              <View style={styles.rating}>
                <Ionicons name="star" size={13} color={colors.primary} />
                <Text style={styles.ratingText}>{night.rating}/5</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.bodyRow}>
          <View style={styles.bodyText}>
            <Text style={styles.name} numberOfLines={2}>{night.eventName}</Text>
            <Text style={styles.location} numberOfLines={1}>{night.venueName} · {night.city}</Text>
          </View>
          {night.photos[0] ? (
            <Image source={{ uri: night.photos[0] }} contentFit="cover" style={styles.thumbnail} accessibilityLabel={`${night.eventName} photo`} />
          ) : null}
        </View>
        </Pressable>
        {night.artistsSeen.length > 0 ? <View style={styles.artistLinks}><ArtistLinks names={night.artistsSeen} compact /></View> : null}
        {night.friends.length > 0 ? <View style={styles.artistLinks}><FriendLinks names={night.friends} compact /></View> : null}
        <Pressable onPress={() => router.push({ pathname: "/night/[id]", params: { id: night.id } })} style={styles.bottomRow} accessibilityRole="button" accessibilityLabel={`Open ${night.eventName} details`}>
          <View style={styles.metadataRow}>
            <Ionicons name="images-outline" size={13} color={colors.muted} />
            <Text style={styles.photoCount}>{night.photos.length} {night.photos.length === 1 ? "photo" : "photos"}</Text>
            <Ionicons name="people-outline" size={14} color={colors.muted} />
            <Text style={styles.photoCount}>{night.friends.length}</Text>
          </View>
          <Text style={styles.cost}>{formatCurrency(night.cost, night.currency)}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/night/[id]/edit", params: { id: night.id } })}
          style={({ pressed }) => [styles.editButton, pressed && styles.editPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${night.eventName}`}
        >
          <Ionicons name="create-outline" size={18} color={colors.secondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingLeft: spacing.xs,
  },
  compactRow: {
    flexDirection: "row",
  },
  timelineRail: {
    width: 22,
    alignItems: "center",
  },
  timelineMarker: {
    width: 10,
    height: 10,
    marginTop: spacing.lg,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.accent,
    zIndex: 1,
  },
  timelineConnector: {
    position: "absolute",
    top: spacing.xl,
    bottom: -spacing.md,
    width: 1,
    backgroundColor: "rgba(212, 175, 55, 0.35)",
  },
  lastConnector: {
    bottom: spacing.md,
  },
  cardSurface: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.88,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    minHeight: 44,
    paddingRight: 52,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  editButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
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
  bodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  bodyText: {
    flex: 1,
    minWidth: 0,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  location: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  artistLinks: { marginTop: spacing.sm },
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
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  cost: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: "auto",
    marginRight: spacing.md,
  },
});
