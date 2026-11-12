import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type ChartItem = {
  label: string;
  value: number;
};

type ChartCardProps = {
  title: string;
  items: ChartItem[];
  onItemPress?: (item: ChartItem) => void;
  itemAccessibilityLabel?: (item: ChartItem) => string;
};

export function ChartCard({ title, items, onItemPress, itemAccessibilityLabel }: ChartCardProps) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {items.map((item) => (
        <Pressable key={item.label} style={styles.row} disabled={!onItemPress} onPress={() => onItemPress?.(item)} accessibilityRole={onItemPress ? "link" : undefined} accessibilityLabel={onItemPress ? itemAccessibilityLabel?.(item) ?? `View artist ${item.label}, ${item.value} nights` : undefined}>
          <Text style={styles.label}>{item.label}</Text>
          <View style={styles.barContainer}>
            <View style={[styles.bar, { width: `${(item.value / maxValue) * 100}%` }]} />
          </View>
          <Text style={styles.value}>{item.value}</Text>
        </Pressable>
      ))}
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
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  label: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
  },
  barContainer: {
    flex: 2,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
    marginHorizontal: spacing.sm,
  },
  bar: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.secondary,
  },
  value: {
    color: colors.text,
    fontWeight: "700",
    minWidth: 32,
    textAlign: "right",
  },
});
