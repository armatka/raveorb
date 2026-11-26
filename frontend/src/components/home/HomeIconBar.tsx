import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse } from "react-native-svg";

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
        <Svg width={25} height={25} viewBox="0 0 25 25">
          <Circle cx="12.5" cy="12.5" r="7" fill="none" stroke={colors.secondary} strokeWidth="1.5" />
          <Ellipse cx="12.5" cy="12.5" rx="11" ry="5" rotation="-28" origin="12.5, 12.5" fill="none" stroke={colors.secondary} strokeWidth="1.5" />
          <Circle cx="10" cy="10" r="1.5" fill={colors.secondary} fillOpacity={0.4} />
        </Svg>
        <Text style={styles.label} numberOfLines={1}>{hero.profile}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hero.venues}
        onPress={() => router.push("/venues")}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        testID="home-venues-button"
      >
        <Ionicons name="location" size={22} color={colors.secondary} />
        <Text style={styles.label} numberOfLines={1}>Venues</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={alertLabel}
        onPress={() => router.push("/artist-alerts")}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        testID="home-artist-alerts-button"
      >
        <View style={styles.pin}>
          <Ionicons name="location-outline" size={24} color={colors.secondary} />
          <Ionicons name="musical-note" size={11} color={colors.secondary} style={styles.note} />
        </View>
        <Text style={styles.label} numberOfLines={1}>Artists</Text>
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
    width: 80,
    minHeight: theme.touchTarget + 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { color: colors.textSecondary, fontSize: 10, lineHeight: 12 },
  pin: { width: 24, height: 24 },
  note: { position: "absolute", top: 5, left: 7 },
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
