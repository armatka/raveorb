import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { homeContent } from "../../constants/homeContent";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { theme } from "../../theme/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

type HomePanelProps = {
  title: string;
  subtitle: string;
  icon: IconName;
  accent: string;
  onPress?: () => void;
  testID: string;
  singleColumn?: boolean;
  comingSoon?: boolean;
  badge?: string;
};

export function HomePanel({ title, subtitle, icon, accent, onPress, testID, singleColumn = false, comingSoon = false, badge }: HomePanelProps) {
  const content = (
    <>
      <View style={[styles.icon, { borderColor: accent }]}>
        <Ionicons name={icon} size={24} color={accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
      {badge ? <Text style={[styles.badge, { color: accent }]}>{badge}</Text> : null}
      {comingSoon ? <Text style={styles.comingSoon}>{homeContent.comingSoon}</Text> : null}
    </>
  );
  const accessibilityLabel = `${title}${badge ? `, ${badge}` : ""}${comingSoon ? ", coming soon" : ""}`;
  const cardStyle = [styles.card, singleColumn && styles.singleColumn, comingSoon && styles.comingSoonCard];

  if (comingSoon || !onPress) {
    return (
      <View
        style={cardStyle}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: true }}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 176,
    flexBasis: "48%",
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
  },
  singleColumn: { width: "100%", flexBasis: "auto", flexGrow: 0 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 19, flexShrink: 1 },
  badge: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  comingSoon: { color: colors.secondary, fontSize: 13, fontWeight: "600" },
  comingSoonCard: { opacity: 0.55 },
  pressed: { opacity: theme.pressed.opacity, transform: [{ scale: theme.pressed.scale }] },
});
