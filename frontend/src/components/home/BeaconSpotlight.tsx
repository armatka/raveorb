import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { homeContent } from "../../constants/homeContent";
import { useReduceMotion } from "../../lib/useReduceMotion";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { theme } from "../../theme/theme";
import type { EventEntry } from "../../types/event";
import { HomeButton } from "./HomeButton";

export function BeaconSpotlight({ events, loadError, onRetry }: { events: EventEntry[]; loadError: boolean; onRetry: () => void }) {
  const { beacon } = homeContent;
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const [glow] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    if (reduceMotion || !focused) {
      glow.setValue(0.55);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.9, duration: 1800, useNativeDriver: Platform.OS !== "web", isInteraction: false }),
      Animated.timing(glow, { toValue: 0.55, duration: 1800, useNativeDriver: Platform.OS !== "web", isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [focused, glow, reduceMotion]);

  return (
    <View style={styles.card}>
      <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow }]}>
        <LinearGradient colors={theme.glow.dark.colors} style={styles.gradient} />
      </Animated.View>
      <View style={styles.heading}>
        <View style={styles.icon}><Ionicons name="radio-outline" size={30} color={colors.accent} /></View>
        <Text style={styles.badge}>{beacon.badge}</Text>
      </View>
      <Text style={styles.title}>{beacon.title}</Text>
      <Text style={styles.body}>{beacon.body}</Text>
      <Text style={styles.tagline}>{beacon.tagline}</Text>
      <HomeButton label={beacon.cta} onPress={() => router.push("/event-changes")} />
      <Text style={styles.guidance}>{beacon.guidance}</Text>
      {events.map((event) => (
        <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={beacon.tonightAccessibility(event.title)}
          onPress={() => router.push({ pathname: "/beacon/[id]", params: { id: event.id } })} style={styles.tonight}>
          <Text style={styles.tonightText}>{beacon.tonight(event.title)}</Text>
        </Pressable>
      ))}
      {loadError ? (
        <View>
          <Text style={styles.guidance}>{beacon.loadError}</Text>
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={beacon.retry} style={styles.retry}>
            <Text style={styles.tonightText}>{beacon.retry}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.xl, gap: spacing.md, borderRadius: theme.borderRadius.xl, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary, ...theme.elevation.subtle },
  glow: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: theme.borderRadius.xl, overflow: "hidden" },
  gradient: { flex: 1 },
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.backgroundElevated, alignItems: "center", justifyContent: "center" },
  badge: { color: colors.accent, fontSize: 15, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: "800" },
  body: { color: colors.text, fontSize: 17, lineHeight: 25 },
  tagline: { color: colors.accent, fontSize: 16, lineHeight: 24, fontWeight: "700" },
  guidance: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  tonight: { minHeight: 48, justifyContent: "center", borderColor: colors.secondary, borderWidth: 1, borderRadius: theme.borderRadius.sm, padding: spacing.md },
  tonightText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  retry: { minHeight: 44, justifyContent: "center" },
});
