import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type MetricTileProps = {
  title: string;
  value: string;
  caption: string;
};

export function MetricTile({ title, value, caption }: MetricTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  value: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  caption: {
    color: colors.muted,
    fontSize: 11,
  },
});
