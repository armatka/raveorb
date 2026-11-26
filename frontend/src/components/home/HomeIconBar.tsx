import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { homeContent } from "../../constants/homeContent";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { theme } from "../../theme/theme";

export function HomeIconBar({ alertCount }: { alertCount: number }) {
  const { hero } = homeContent;
  const alertLabel = alertCount ? hero.artistAlertsCount(alertCount) : hero.artistAlerts;
  const badgeLabel = alertCount > 99 ? "99+" : String(alertCount);

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hero.profile}
        onPress={() => router.push("/my-raveorb")}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        testID="home-profile-button"
      >
        <Ionicons name="person-circle-outline" size={24} color={colors.secondary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={alertLabel}
        onPress={() => router.push("/artist-alerts")}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        testID="home-artist-alerts-button"
      >
        <Ionicons name="notifications-outline" size={24} color={colors.secondary} />
        {alertCount > 0 ? (
          <View pointerEvents="none" style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: theme.touchTarget, flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  button: {
    width: theme.touchTarget,
    height: theme.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  badgeText: { color: colors.background, fontSize: 10, lineHeight: 14, fontWeight: "800" },
  pressed: { opacity: theme.pressed.opacity, transform: [{ scale: theme.pressed.scale }] },
});
