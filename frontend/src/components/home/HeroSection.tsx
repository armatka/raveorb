import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { homeContent } from "../../constants/homeContent";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { HomeButton } from "./HomeButton";

export function HeroSection({ alertCount, changedCount, updatesError }: { alertCount: number; changedCount: number; updatesError: boolean }) {
  const { hero } = homeContent;
  return (
    <View style={styles.hero}>
      <View style={styles.top}>
        <Image source={require("../../../assets/images/RaveOrbLogo2.png")} contentFit="contain" style={styles.logo} accessibilityLabel={hero.logoLabel} />
        <View style={styles.links}>
          <Pressable accessibilityRole="button" accessibilityLabel={hero.profile} onPress={() => router.push("/my-raveorb")} style={styles.link}><Text style={styles.linkText}>{hero.profile}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={alertCount ? hero.artistAlertsCount(alertCount) : hero.artistAlerts} onPress={() => router.push("/artist-alerts")} style={styles.link}><Text style={styles.linkText}>{alertCount ? hero.artistAlertsCount(alertCount) : hero.artistAlerts}</Text></Pressable>
        </View>
      </View>
      <Text style={styles.headline}>{hero.headline}</Text>
      <Text style={styles.subhead}>{hero.subhead}</Text>
      {changedCount ? <Pressable accessibilityRole="button" accessibilityLabel={hero.changes(changedCount)} onPress={() => router.push("/event-changes")} style={styles.link}><Text style={styles.notice}>{hero.changes(changedCount)}</Text></Pressable> : null}
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
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  logo: { width: 90, height: 90 },
  links: { alignItems: "flex-end", flexShrink: 1 },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  linkText: { color: colors.secondary, fontSize: 15, fontWeight: "600", textAlign: "right" },
  notice: { color: colors.secondary, fontSize: 15, lineHeight: 22 },
  headline: { color: colors.text, fontSize: 34, lineHeight: 42, fontWeight: "800" },
  subhead: { color: colors.textSecondary, fontSize: 18, lineHeight: 27 },
  buttons: { gap: spacing.md },
});
