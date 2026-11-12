import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type RecommendationCardProps = {
  title: string;
  subtitle: string;
  tag: string;
  onPress?: () => void;
};

export default function RecommendationCard({
  title,
  subtitle,
  tag,
  onPress,
}: RecommendationCardProps) {
  const content = (
    <View style={styles.card}>
      <View style={styles.accentRule} />
      <Text style={styles.tag}>{tag}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginRight: spacing.md,
  },
  pressed: {
    opacity: 0.82,
  },
  accentRule: {
    width: 28,
    height: 2,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  tag: {
    color: colors.secondary,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
