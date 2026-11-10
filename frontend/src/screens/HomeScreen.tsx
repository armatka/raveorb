import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import Logo from "../components/Logo";
import MetricCard from "../components/MetricCard";
import RecommendationCard from "../components/RecommendationCard";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

const stats = [
  { title: "Nights", value: "24", caption: "this year" },
  { title: "Avg vibe", value: "92", caption: "out of 100" },
  { title: "Cities", value: "7", caption: "explored" },
  { title: "Top venue", value: "Solar Shore", caption: "favorite spot" },
];

const upcoming = [
  { title: "Neon District", time: "Fri · 11:30 PM", vibe: "Peak energy" },
  { title: "Sunset Ritual", time: "Sat · 8:00 PM", vibe: "Open air" },
  { title: "Velvet Echo", time: "Sun · 10:15 PM", vibe: "Deep house" },
];

const recommendations = [
  { title: "Afterglow", subtitle: "Tech house and open-air energy", tag: "Tonight" },
  { title: "Neon Pulse", subtitle: "Warehouse night with peak visuals", tag: "Trending" },
  { title: "Solar Drift", subtitle: "Sunset rave and live sets", tag: "For you" },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[colors.background, colors.backgroundElevated, colors.background]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerWrap}>
            <Logo size={300} background="dark" style={styles.heroLogo} />
            <Text style={styles.brandTag}>Nightlife Journal</Text>
          </View>

          <View style={styles.welcomeCard}>
            <Text style={styles.kicker}>Curated for nights worth remembering</Text>
            <Text style={styles.headline}>Discover Your Sound</Text>
            <Text style={styles.supportingText}>
              Personalized festival, rave, and music discovery built around your favorite nights,
              your best venues, and your signature energy.
            </Text>

            <View style={styles.featureRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featureText}>Festivals</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featureText}>Raves</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featureText}>Concerts</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your pulse</Text>
            <Text style={styles.sectionMeta}>This season</Text>
          </View>

          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <MetricCard
                key={stat.title}
                title={stat.title}
                value={stat.value}
                caption={stat.caption}
              />
            ))}
          </View>

          <View style={styles.discoveryCard}>
            <Text style={styles.discoveryTitle}>Next up</Text>
            <Text style={styles.discoveryHeadline}>Your perfect night is waiting</Text>
            <Text style={styles.discoveryCopy}>
              Based on your energy, genre mix, and recent venue visits, we found a strong match for tonight.
            </Text>

            <View style={styles.discoveryRow}>
              <View style={styles.discoveryTag}>
                <Text style={styles.discoveryTagText}>Tech House</Text>
              </View>
              <View style={styles.discoveryTag}>
                <Text style={styles.discoveryTagText}>Warehouse</Text>
              </View>
              <View style={styles.discoveryTag}>
                <Text style={styles.discoveryTagText}>Late Night</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>For you</Text>
            <Text style={styles.sectionMeta}>Based on your vibe</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recommendationRow}
            style={styles.recommendationScroll}
          >
            {recommendations.map((item) => (
              <RecommendationCard
                key={item.title}
                title={item.title}
                subtitle={item.subtitle}
                tag={item.tag}
              />
            ))}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent nights</Text>
            <Text style={styles.sectionMeta}>Keep the momentum</Text>
          </View>

          <View style={styles.listWrap}>
            {upcoming.map((entry) => (
              <View key={entry.title} style={styles.eventCard}>
                <View style={styles.eventMetaRow}>
                  <Text style={styles.eventTitle}>{entry.title}</Text>
                  <Text style={styles.eventVibe}>{entry.vibe}</Text>
                </View>
                <Text style={styles.eventTime}>{entry.time}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerWrap: {
    alignItems: "center",
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  heroLogo: {
    marginBottom: spacing.xs,
  },
  brandTag: {
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.secondary,
    fontWeight: "700",
  },
  welcomeCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kicker: {
    marginBottom: spacing.sm,
    color: colors.secondary,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  headline: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  supportingText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
  featurePill: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  discoveryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  discoveryTitle: {
    color: colors.secondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
    fontWeight: "700",
  },
  discoveryHeadline: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  discoveryCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  discoveryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  discoveryTag: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  discoveryTagText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  recommendationScroll: {
    marginBottom: spacing.lg,
  },
  recommendationRow: {
    paddingRight: spacing.md,
  },
  listWrap: {
    marginBottom: spacing.lg,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  eventMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  eventVibe: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  eventTime: {
    color: colors.muted,
    fontSize: 13,
  },
});
