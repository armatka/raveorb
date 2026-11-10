import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { EventEntry } from "../types/event";
import type { EventStatus } from "../lib/eventStatusStorage";
import { formatEventPrice, formatEventSchedule } from "../lib/eventFormatting";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type EventListItemProps = {
  event: EventEntry;
  status?: EventStatus;
  onStatusChange?: (status: EventStatus | null) => Promise<void>;
};

const statusLabels: Record<EventStatus, string> = {
  interested: "Interested",
  going: "Going",
  attended: "Attended",
};

const statusIcons: Record<EventStatus, keyof typeof Ionicons.glyphMap> = {
  interested: "heart",
  going: "calendar-outline",
  attended: "checkmark-circle",
};

const statusCycle: Array<EventStatus | null> = [null, "interested", "going", "attended"];

export function EventListItem({ event, status, onStatusChange }: EventListItemProps) {
  const nextStatus = statusCycle[(statusCycle.indexOf(status ?? null) + 1) % statusCycle.length];
  const handleStatusPress = () => {
    if (onStatusChange) void onStatusChange(nextStatus);
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => router.push({ pathname: "/event/[id]", params: { id: event.id } })}
        style={({ pressed }) => pressed && styles.cardPressed}
        accessibilityRole="button"
        accessibilityLabel={`Open ${event.title}`}
      >
      {event.imageUrl ? (
        <Image source={{ uri: event.imageUrl }} contentFit="cover" style={styles.image} accessibilityLabel={`${event.title} event image`} />
      ) : (
        <View style={styles.imageFallback}>
          <Ionicons name="musical-notes-outline" size={27} color={colors.secondary} />
          <Text style={styles.fallbackLabel}>{event.genres.slice(0, 2).join(" · ").toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.type}>{event.type}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>{event.venueName}</Text>
        <Text style={styles.meta} numberOfLines={1}>{event.city}, {event.countryCode} · {formatEventSchedule(event)}</Text>
        <Text style={styles.genres} numberOfLines={1}>{event.genres.slice(0, 3).join(" · ")}</Text>
        <Text style={styles.artists} numberOfLines={1}>{event.artists.slice(0, 3).join(" · ")}</Text>
      </View>
      </Pressable>
        <View style={styles.footer}>
          <Text style={styles.price}>{formatEventPrice(event)}</Text>
          {status ? (
            <View style={styles.statusBadge}>
              <Ionicons name={statusIcons[status]} size={13} color={colors.secondary} />
              <Text style={styles.statusText}>{statusLabels[status]}</Text>
            </View>
          ) : null}
          {onStatusChange ? (
            <Pressable
              onPress={handleStatusPress}
              style={({ pressed }) => [styles.quickStatusButton, pressed && styles.quickStatusPressed]}
              accessibilityRole="button"
              accessibilityLabel={nextStatus ? `Mark ${event.title} ${nextStatus}` : `Clear status for ${event.title}`}
              accessibilityHint="Cycles this event's status without opening event details"
            >
              <Ionicons
                name={nextStatus ? statusIcons[nextStatus] : "close-circle-outline"}
                size={17}
                color={nextStatus ? colors.secondary : colors.muted}
              />
            </Pressable>
          ) : null}
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  cardPressed: {
    opacity: 0.9,
  },
  image: {
    width: "100%",
    height: 148,
    backgroundColor: colors.surfaceAlt,
  },
  imageFallback: {
    height: 116,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fallbackLabel: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  cardContent: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  type: {
    color: colors.secondary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  artists: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  genres: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  price: {
    color: colors.text,
    fontWeight: "700",
  },
  statusBadge: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  statusText: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
  },
  quickStatusButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  quickStatusPressed: {
    opacity: 0.7,
    backgroundColor: "rgba(212, 175, 55, 0.12)",
  },
});
