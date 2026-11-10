import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { EventEntry } from "../types/event";
import { formatEventPrice, formatEventSchedule } from "../lib/eventFormatting";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type EventListItemProps = {
  event: EventEntry;
};

export function EventListItem({ event }: EventListItemProps) {
  return (
    <Link
      href={{
        pathname: "/event/[id]",
        params: { id: event.id },
      }}
      style={styles.card}
    >
      <View style={styles.row}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.type}>{event.type}</Text>
      </View>
      <Text style={styles.meta}>{event.venueName} · {event.city}, {event.countryCode}</Text>
      <Text style={styles.meta}>{formatEventSchedule(event)}</Text>
      <Text style={styles.meta}>{event.genres.join(" · ")}</Text>
      <Text style={styles.artists} numberOfLines={1}>{event.artists.join(", ")}</Text>
      <Text style={styles.footer}>{formatEventPrice(event)}</Text>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
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
    color: colors.text,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  artists: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
});
