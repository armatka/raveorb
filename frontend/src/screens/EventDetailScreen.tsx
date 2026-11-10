import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import EventDetailHeader from "../components/EventDetailHeader";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

const event = {
  title: "Sunset Ritual",
  type: "festival",
  date: "March 14 · 7:00 PM",
  location: "Solar Shore · Miami, FL",
  artists: ["KAYO", "Nova Bloom", "Astra Vale", "Mira Lane"],
  stats: [
    { label: "Vibe", value: "94/100" },
    { label: "Spend", value: "$128" },
    { label: "Duration", value: "9h" },
  ],
  notes: "A high-energy open-air set with strong visuals, immersive sound, and a crowd that stayed locked in from the first drop to the final sunrise moment.",
  lineup: ["Main stage", "Sunset deck", "After hours room"],
};

export default function EventDetailScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <EventDetailHeader
          title={event.title}
          date={event.date}
          location={event.location}
          type={event.type}
        />

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <View style={styles.statRow}>
            {event.stats.map((stat) => (
              <View key={stat.label} style={styles.statBox}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Artist lineup</Text>
          <View style={styles.tagRow}>
            {event.artists.map((artist) => (
              <View key={artist} style={styles.tag}>
                <Text style={styles.tagText}>{artist}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Experience</Text>
          <Text style={styles.notes}>{event.notes}</Text>
          <View style={styles.listWrap}>
            {event.lineup.map((item) => (
              <View key={item} style={styles.listItem}>
                <View style={styles.listBullet} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  notes: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  listWrap: {
    marginTop: spacing.sm,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  listBullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  listText: {
    color: colors.text,
    fontSize: 14,
  },
});
