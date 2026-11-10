import { StyleSheet, Text, View } from "react-native";

import { ChartCard } from "../../components/ChartCard";
import { Screen } from "../../components/Screen";
import { StatCard } from "../../components/StatCard";
import { mockEvents } from "../../data/mockData";
import { getSummaryStats, getTopGenres, getVenueBreakdown } from "../../lib/stats";
import { formatCurrency } from "../../lib/formatCurrency";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function StatsScreen() {
  const summary = getSummaryStats(mockEvents);
  const topGenres = getTopGenres(mockEvents);
  const venueBreakdown = getVenueBreakdown(mockEvents);

  return (
    <Screen edges={["top", "left", "right"]} scrollable style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nightly stats</Text>

      <View style={styles.grid}>
        <StatCard title="Total nights" value={String(summary.totalEvents)} subtitle="logged" />
        <StatCard title="Avg. spend" value={formatCurrency(summary.avgSpend, "USD")} subtitle="per night" />
        <StatCard title="Avg. duration" value={`${summary.avgHours.toFixed(1)}h`} subtitle="on the floor" />
        <StatCard title="Peak vibe" value={`${summary.avgVibe}`} subtitle="average score" />
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
