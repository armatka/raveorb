import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import type { EventEntry } from "../types/event";
import type { EventStatus } from "../lib/eventStatusStorage";
import { formatEventPrice, formatEventSchedule } from "../lib/eventFormatting";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type EventListItemProps = {
  event: EventEntry;
  status?: EventStatus;
};

const statusLabels: Record<EventStatus, string> = {
  interested: "Interested",
  going: "Going",
  attended: "Attended",
};

export function EventListItem({ event, status }: EventListItemProps) {
  return (
    <Link
      href={{
        pathname: "/event/[id]",
        params: { id: event.id },
      }}
      style={styles.card}
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
        <View style={styles.footer}>
          <Text style={styles.price}>{formatEventPrice(event)}</Text>
          {status ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{statusLabels[status]}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Link>
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
    justifyContent: "space-between",
    marginTop: spacing.sm,
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
});
