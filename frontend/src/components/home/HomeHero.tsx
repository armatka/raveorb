import { router, useIsFocused } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import Logo from "../Logo";
import { homeContent } from "../../constants/homeContent";
import { useReduceMotion } from "../../lib/useReduceMotion";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { theme } from "../../theme/theme";
import { HomeButton } from "./HomeButton";

export function HomeHero({ changedCount, updatesError }: { changedCount: number; updatesError: boolean }) {
  const { hero } = homeContent;
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const logoSize = Math.min(width * 0.5, 280);

  return (
    <View style={styles.hero}>
      <Logo size={logoSize} animated={isFocused && !reduceMotion} />
      <Text style={styles.headline}>{hero.headline}</Text>
      <Text style={styles.subhead}>{hero.subhead}</Text>
      {changedCount ? (
        <Pressable accessibilityRole="button" accessibilityLabel={hero.changes(changedCount)} onPress={() => router.push("/event-changes")} style={styles.link}>
          <Text style={styles.notice}>{hero.changes(changedCount)}</Text>
        </Pressable>
      ) : null}
      {updatesError ? <Text style={styles.notice}>{hero.updatesError}</Text> : null}
      <View style={styles.buttons}>
        <HomeButton label={hero.primaryCta} onPress={() => router.push("/(tabs)/events")} />
        <HomeButton label={hero.secondaryCta} secondary onPress={() => router.push("/event-changes")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.lg, paddingVertical: spacing.lg },
  link: { minHeight: theme.touchTarget, justifyContent: "center", paddingHorizontal: spacing.sm },
  notice: { color: colors.secondary, fontSize: 15, lineHeight: 22 },
  headline: { color: colors.text, ...theme.typography.headline },
  subhead: { color: colors.textSecondary, fontSize: 18, lineHeight: 27 },
  buttons: { gap: spacing.md },
});
