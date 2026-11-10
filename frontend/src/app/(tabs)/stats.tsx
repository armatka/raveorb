import { StyleSheet, Text, View } from "react-native";

import { ChartCard } from "../../components/ChartCard";
import { Screen } from "../../components/Screen";
import { StatCard } from "../../components/StatCard";
import { mockEvents } from "../../data/mockData";
import { getSummaryStats, getTopGenres, getVenueBreakdown } from "../../lib/stats";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function StatsScreen() {
  const summary = getSummaryStats(mockEvents);
  const topGenres = getTopGenres(mockEvents);
  const venueBreakdown = getVenueBreakdown(mockEvents);

  return (
    <Screen edges={["top", "left", "right"]} scrollable style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Discovery stats</Text>

      <View style={styles.grid}>
        <StatCard title="Events" value={String(summary.totalEvents)} subtitle="in discovery" />
        <StatCard title="Cities" value={String(summary.totalCities)} subtitle="represented" />
        <StatCard title="Venues" value={String(summary.totalVenues)} subtitle="listed" />
        <StatCard title="Genres" value={String(summary.totalGenres)} subtitle="represented" />
      </View>

      <ChartCard title="Top genres" items={topGenres} />
      <ChartCard title="Top venues" items={venueBreakdown} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.lg,
  },
  grid: {
    marginBottom: spacing.lg,
  },
});
