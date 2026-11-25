import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type RecommendationCardProps = {
  title: string;
  subtitle: string;
  tag: string;
  onPress?: () => void;
  onNotInterested?: () => void;
};

export default function RecommendationCard({
  title,
  subtitle,
  tag,
  onPress,
  onNotInterested,
}: RecommendationCardProps) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`}>
        <View style={styles.accentRule} />
        <Text style={styles.tag}>{tag}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Pressable>
      {onNotInterested ? <Pressable onPress={onNotInterested} style={styles.dismiss} accessibilityRole="button" accessibilityLabel={`Not interested in ${title}`}>
        <Text style={styles.dismissText}>Not interested</Text>
      </Pressable> : null}
    </View>
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
  dismiss: { minHeight: 44, justifyContent: "center", marginTop: spacing.sm },
  dismissText: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
});
