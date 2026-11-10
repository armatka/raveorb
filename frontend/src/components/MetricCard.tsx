import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type MetricCardProps = {
  title: string;
  value: string;
  caption: string;
};

export default function MetricCard({ title, value, caption }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.accentRule} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "46%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  accentRule: {
    width: 28,
    height: 2,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  value: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 2,
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
  },
});
