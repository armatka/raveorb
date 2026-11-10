import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ChartCard } from "../../components/ChartCard";
import { EmptyState } from "../../components/EmptyState";
import { Screen } from "../../components/Screen";
import { StatCard } from "../../components/StatCard";
import { formatCurrency } from "../../lib/formatCurrency";
import { calculateNightStats } from "../../lib/nightStats";
import { nightsStorage } from "../../lib/nightsStorage";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import type { Night } from "../../types/Night";

export default function StatsScreen() {
  const [nights, setNights] = useState<Night[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      setLoading(true);
      setError(false);
      setNow(new Date());
      nightsStorage.list()
        .then((items) => {
          if (!isCurrent) return;
          setNights(items);
          setSelectedYear((current) => {
            if (current === null) return null;
            return items.some((night) => night.date.startsWith(`${current}-`))
              ? current
              : null;
          });
        })
        .catch(() => {
          if (isCurrent) setError(true);
        })
        .finally(() => {
          if (isCurrent) setLoading(false);
        });
      return () => { isCurrent = false; };
    }, []),
  );

  const years = useMemo(
    () => [...new Set(nights.map((night) => night.date.slice(0, 4)).filter((year) => /^\d{4}$/.test(year)))].sort((a, b) => b.localeCompare(a)),
    [nights],
  );
  const stats = useMemo(
    () => calculateNightStats(nights, selectedYear, now),
    [nights, now, selectedYear],
  );

  return (
    <Screen edges={["top", "left", "right"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>PERSONAL HISTORY</Text>
            <Text style={styles.title}>Night Stats</Text>
            <Text style={styles.subtitle}>Your nights, measured over time</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRail}>
          <YearButton label="All time" selected={selectedYear === null} onPress={() => setSelectedYear(null)} />
          {years.map((year) => (
            <YearButton key={year} label={year} selected={selectedYear === year} onPress={() => setSelectedYear(year)} />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <EmptyState title="Stats unavailable" message="Your journal statistics could not be loaded. Please try again." icon="alert-circle-outline" />
        ) : nights.length === 0 ? (
          <EmptyState
            title="Your stats start with a night"
            message="After you add Nights to your journal, this page will show your listening history, favorite places, and spending by currency."
            icon="bar-chart-outline"
            action={(
              <Pressable onPress={() => router.push("/night/new")} style={styles.addNightButton} accessibilityRole="button">
                <Text style={styles.addNightText}>Add a Night</Text>
              </Pressable>
            )}
          />
        ) : (
          <>
            {stats.totalNights === 0 ? (
              <EmptyState title={`No Nights in ${selectedYear}`} message="Choose another year or switch to All time to see your journal history." icon="calendar-outline" />
            ) : (
              <>
                <Text style={styles.scopeCaption}>{selectedYear ? `SUMMARY · ${selectedYear}` : "SUMMARY · ALL TIME"}</Text>
                <View style={styles.statsGrid}>
                  <StatCard style={styles.statCard} title="Total Nights" value={String(stats.totalNights)} subtitle={selectedYear ?? "all time"} />
                  <StatCard style={styles.statCard} title="This Year" value={String(stats.nightsThisYear)} subtitle="nights logged" />
                  <StatCard style={styles.statCard} title="This Month" value={String(stats.nightsThisMonth)} subtitle="nights logged" />
                  <StatCard style={styles.statCard} title="Average Rating" value={stats.ratedNightCount ? `${stats.averageRating.toFixed(1)} / 5` : "—"} subtitle={`${stats.ratedNightCount} rated`} />
                  <StatCard style={styles.statCard} title="Photos" value={String(stats.totalPhotos)} subtitle="memories saved" />
                  <StatCard style={styles.statCard} title="Cities" value={String(stats.uniqueCities)} subtitle="explored" />
                  <StatCard style={styles.statCard} title="Venues" value={String(stats.uniqueVenues)} subtitle="visited" />
                  <StatCard style={styles.statCard} title="Artists" value={String(stats.uniqueArtists)} subtitle="seen" />
                  <StatCard style={styles.statCard} title="Friends" value={String(stats.uniqueFriends)} subtitle="shared nights" />
                </View>

                <Text style={styles.scopeCaption}>TOP INSIGHTS</Text>
                <View style={styles.insightList}>
                  <Insight label="Most-seen artist" item={stats.mostSeenArtist} suffix="nights" />
                  <Insight label="Most-visited venue" item={stats.mostVisitedVenue} suffix="nights" />
                  <Insight label="Most frequent city" item={stats.mostFrequentCity} suffix="nights" />
                  <Insight label="Most frequent friend" item={stats.mostFrequentFriend} suffix="nights" />
                  <Insight label="Busiest month" item={stats.busiestMonth} suffix="nights" />
                  {stats.highestRatedNight ? (
                    <View style={styles.highestRated}>
                      <Text style={styles.insightLabel}>HIGHEST-RATED NIGHT</Text>
                      <Text style={styles.insightName}>{stats.highestRatedNight.eventName}</Text>
                      <Text style={styles.insightMeta}>
                        {"★"} {stats.highestRatedNight.rating}/5 · {stats.highestRatedNight.venueName} · {stats.highestRatedNight.date}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.highestRated}>
                      <Text style={styles.insightLabel}>HIGHEST-RATED NIGHT</Text>
                      <Text style={styles.insightMeta}>No rated Nights yet</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.scopeCaption}>ACTIVITY</Text>
                <ChartCard title={selectedYear ? "Nights by month" : "Nights by month"} items={stats.nightsByMonth} />
                <ChartCard title="Nights by city" items={stats.nightsByCity} />
                <ChartCard title="Nights by venue" items={stats.nightsByVenue} />
                <ChartCard title="Nights by rating" items={stats.nightsByRating} />
                <ChartCard title="Artists seen most often" items={stats.artistsByFrequency} />
                <ChartCard title="Friends appearing most often" items={stats.friendsByFrequency} />

                <Text style={styles.scopeCaption}>SPEND BY CURRENCY</Text>
                {stats.spending.length > 0 ? (
                  <View style={styles.spendList}>
                    {stats.spending.map((spend) => (
                      <View key={spend.currency} style={styles.spendRow}>
                        <View>
                          <Text style={styles.spendCurrency}>{spend.currency}</Text>
                          <Text style={styles.spendMeta}>Average · {formatCurrency(spend.average, spend.currency)} across {spend.nights} {spend.nights === 1 ? "Night" : "Nights"}</Text>
                        </View>
                        <Text style={styles.spendTotal}>{formatCurrency(spend.total, spend.currency)}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noSpend}>
                    <Text style={styles.insightMeta}>No valid spending entries for this period.</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function YearButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.yearButton, selected && styles.yearButtonSelected, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Show ${label} statistics`}
    >
      <Text style={[styles.yearText, selected && styles.yearTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Insight({ label, item, suffix }: { label: string; item: { label: string; value: number } | null; suffix: string }) {
  return (
    <View style={styles.insightRow}>
      <View style={styles.insightMarker} />
      <View style={styles.insightCopy}>
        <Text style={styles.insightLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.insightName} numberOfLines={1}>{item?.label ?? "Not enough data"}</Text>
      </View>
      {item ? <Text style={styles.insightCount}>{item.value} {suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  content: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  yearRail: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  yearButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  yearButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  yearTextSelected: {
    color: colors.background,
  },
  pressed: {
    opacity: 0.75,
  },
  loader: {
    marginTop: spacing.xxl * 2,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  statCard: {
    width: "48%",
    marginBottom: spacing.md,
  },
  scopeCaption: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  insightList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  insightRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  insightMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  insightCopy: {
    flex: 1,
    minWidth: 0,
  },
  insightLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.9,
  },
  insightName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 3,
  },
  insightMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  insightCount: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "600",
  },
  highestRated: {
    paddingVertical: spacing.md,
  },
  spendList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  spendRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  spendCurrency: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  spendMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  spendTotal: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  noSpend: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  addNightButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  addNightText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "800",
  },
});
