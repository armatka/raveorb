import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { homeContent } from "../../constants/homeContent";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { theme } from "../../theme/theme";

export function HomeIconBar({ alertCount }: { alertCount: number }) {
  const { hero } = homeContent;
  const profile = homeContent.panels.find((panel) => panel.key === "profile");
  const orbit = homeContent.panels.find((panel) => panel.key === "orbit");
  const artists = homeContent.panels.find((panel) => panel.key === "artist-alerts");
  if (!profile || !orbit || !artists) throw new Error("Home icon bar panels are missing.");
  const alertLabel = alertCount ? hero.artistAlertsCount(alertCount) : hero.artistAlerts;
  const badgeLabel = alertCount > 99 ? "99+" : String(alertCount);
  const buttons = [
    { label: profile.title, accessibilityLabel: profile.title, icon: profile.icon, route: profile.route, testID: "home-profile-button" },
    { label: orbit.iconBarLabel, accessibilityLabel: orbit.title, icon: orbit.icon, route: orbit.route, testID: "home-orbit-button" },
    { label: hero.venues, accessibilityLabel: hero.venues, icon: "location", route: "/venues", testID: "home-venues-button" },
    { label: artists.iconBarLabel, accessibilityLabel: alertLabel, icon: artists.icon, route: artists.route, testID: "home-artist-alerts-button" },
  ] as const;

  return (
    <View style={styles.bar}>
      {buttons.map((button) => (
        <Pressable
          key={button.testID}
          accessibilityRole="button"
          accessibilityLabel={button.accessibilityLabel}
          onPress={() => router.push(button.route)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          testID={button.testID}
        >
          <Ionicons name={button.icon} size={24} color={colors.secondary} />
          <Text style={styles.label} numberOfLines={1}>{button.label}</Text>
          {button.testID === "home-artist-alerts-button" && alertCount > 0 ? (
            <View pointerEvents="none" style={styles.badge}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: theme.touchTarget, flexDirection: "row", justifyContent: "flex-end", gap: spacing.xs },
  button: {
    width: 68,
    minHeight: theme.touchTarget + 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { color: colors.textSecondary, fontSize: 10, lineHeight: 12 },
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
