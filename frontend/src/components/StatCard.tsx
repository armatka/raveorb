import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
};

export function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  value: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
  },
});
