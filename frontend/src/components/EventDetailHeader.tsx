import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type EventDetailHeaderProps = {
  title: string;
  date: string;
  location: string;
  type: string;
};

export default function EventDetailHeader({ title, date, location, type }: EventDetailHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.badge}>{type}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>{date}</Text>
      <Text style={styles.meta}>{location}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  badge: {
    color: colors.secondary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
});
