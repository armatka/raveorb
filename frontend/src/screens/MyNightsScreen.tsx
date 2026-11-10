import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { EmptyState } from "../components/EmptyState";
import { NightCard } from "../components/NightCard";
import { Screen } from "../components/Screen";
import { nightsStorage } from "../lib/nightsStorage";
import {
  filterNights,
  getNightFilterOptions,
  groupNightsByYearMonth,
  type NightRatingFilter,
  type NightTimelineSection,
} from "../lib/nightTimeline";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Night } from "../types/Night";

type NightViewMode = "timeline" | "compact";

export default function MyNightsScreen() {
  const [nights, setNights] = useState<Night[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [venue, setVenue] = useState<string | null>(null);
  const [artist, setArtist] = useState<string | null>(null);
  const [friend, setFriend] = useState<string | null>(null);
  const [rating, setRating] = useState<NightRatingFilter>("all");
  const [viewMode, setViewMode] = useState<NightViewMode>("timeline");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      setLoading(true);
      setError(false);
      nightsStorage.list()
        .then((items) => {
          if (isCurrent) setNights(items);
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

  const options = useMemo(() => getNightFilterOptions(nights), [nights]);
  const ratingOptionLabels = useMemo(
    () => ["Rated", ...options.ratings.map((value) => `${value} stars`)],
    [options.ratings],
  );
  const visibleNights = useMemo(
    () => filterNights(nights, query, { year, city, venue, artist, friend, rating }),
    [artist, city, friend, nights, query, rating, venue, year],
  );
  const sections = useMemo(
    () => groupNightsByYearMonth(visibleNights),
    [visibleNights],
  );
  const hasFilters = Boolean(query.trim()) || Boolean(year) || Boolean(city)
    || Boolean(venue) || Boolean(artist) || Boolean(friend) || rating !== "all";
  const activeFilterCount = [year, city, venue, artist, friend].filter(Boolean).length + (rating !== "all" ? 1 : 0);

  const clearAll = () => {
    setQuery("");
    setYear(null);
    setCity(null);
    setVenue(null);
    setArtist(null);
    setFriend(null);
    setRating("all");
  };

  const listHeader = (
    <View style={styles.headerContent}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>YOUR ARCHIVE</Text>
          <Text style={styles.title}>My Nights</Text>
          <Text style={styles.subtitle}>A history of nights worth keeping</Text>
        </View>
        <Pressable onPress={() => router.push("/night/new")} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add a night">
          <Ionicons name="add" size={22} color={colors.background} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search nights, artists, people, notes"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search My Nights"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} style={styles.clearSearch} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.toolbarRow}>
        <Pressable
          onPress={() => setFiltersExpanded((expanded) => !expanded)}
          style={({ pressed }) => [styles.filterToggle, pressed && styles.filterPressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersExpanded }}
          accessibilityLabel={filtersExpanded ? "Hide filters" : `Show filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}
        >
          <Ionicons name="options-outline" size={17} color={colors.secondary} />
          <Text style={styles.filterToggleText}>Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}</Text>
        </Pressable>
        <View style={styles.modeControl} accessibilityRole="radiogroup" accessibilityLabel="Night view mode">
          <ModeButton label="Timeline" icon="git-branch-outline" selected={viewMode === "timeline"} onPress={() => setViewMode("timeline")} />
          <ModeButton label="List" icon="list-outline" selected={viewMode === "compact"} onPress={() => setViewMode("compact")} />
        </View>
      </View>

      {filtersExpanded ? (
        <View style={styles.filtersPanel}>
          <FilterRail label="YEAR" options={options.years} selected={year} allLabel="All years" onSelect={setYear} />
          <FilterRail label="CITY" options={options.cities} selected={city} allLabel="All cities" onSelect={setCity} />
          <FilterRail label="VENUE" options={options.venues} selected={venue} allLabel="All venues" onSelect={setVenue} />
          <FilterRail label="ARTIST" options={options.artists} selected={artist} allLabel="All artists" onSelect={setArtist} />
          <FilterRail label="FRIEND" options={options.friends} selected={friend} allLabel="All friends" onSelect={setFriend} />
          <FilterRail
            label="RATING"
            options={ratingOptionLabels}
            selected={rating === "all" ? null : rating === "rated" ? "Rated" : `${rating} stars`}
            allLabel="Any rating"
            onSelect={(label) => {
              if (!label) {
                setRating("all");
              } else if (label === "Rated") {
                setRating("rated");
              } else {
                setRating(Number.parseInt(label, 10));
              }
            }}
          />
        </View>
      ) : null}

      <View style={styles.resultsRow}>
        <Text style={styles.resultCount}>{visibleNights.length} {visibleNights.length === 1 ? "night" : "nights"}</Text>
        {hasFilters ? (
          <Pressable onPress={clearAll} style={styles.clearAllButton} accessibilityRole="button" accessibilityLabel="Clear all filters">
            <Text style={styles.clearAllText}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {hasFilters ? (
        <View style={styles.activeFilters}>
          {query.trim() ? <ActiveChip label={`Search: ${query.trim()}`} onRemove={() => setQuery("")} /> : null}
          {year ? <ActiveChip label={year} onRemove={() => setYear(null)} /> : null}
          {city ? <ActiveChip label={city} onRemove={() => setCity(null)} /> : null}
          {venue ? <ActiveChip label={venue} onRemove={() => setVenue(null)} /> : null}
          {artist ? <ActiveChip label={artist} onRemove={() => setArtist(null)} /> : null}
          {friend ? <ActiveChip label={`With ${friend}`} onRemove={() => setFriend(null)} /> : null}
          {rating !== "all" ? <ActiveChip label={rating === "rated" ? "Rated" : `${rating} stars`} onRemove={() => setRating("all")} /> : null}
        </View>
      ) : null}
    </View>
  );

  let emptyContent;
  if (loading) {
    emptyContent = <ActivityIndicator color={colors.primary} style={styles.loader} />;
  } else if (error) {
    emptyContent = <EmptyState title="Journal unavailable" message="Your nights could not be loaded. Check your device storage and try again." icon="alert-circle-outline" />;
  } else if (nights.length === 0) {
    emptyContent = (
      <EmptyState
        title="Start your archive"
        message="Capture the artists, people, and moments that made a night yours."
        icon="moon-outline"
        action={(
          <Pressable onPress={() => router.push("/night/new")} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Add your first night</Text>
          </Pressable>
        )}
      />
    );
  } else {
    emptyContent = <EmptyState title="No nights match" message="Try a different search or remove one of the active filters." icon="search-outline" />;
  }

  return (
    <Screen edges={["top", "left", "right"]} style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(night) => night.id}
        renderItem={({ item, index, section }) => (
          <NightCard
            night={item}
            layout={viewMode}
            showConnector={viewMode === "timeline" && index < section.data.length - 1}
          />
        )}
        renderSectionHeader={({ section }) => <TimelineHeading section={section} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyContent}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </Screen>
  );
}

function FilterRail({
  label,
  options,
  selected,
  allLabel,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string | null;
  allLabel: string;
  onSelect: (value: string | null) => void;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterItems}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
          {[allLabel, ...options].map((option) => {
            const value = option === allLabel ? null : option;
            const isSelected = selected === value;
            return (
              <Pressable
                key={option}
                onPress={() => onSelect(value)}
                style={({ pressed }) => [styles.filterOption, isSelected && styles.filterOptionSelected, pressed && styles.filterPressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${label.toLowerCase()}: ${option}`}
              >
                <Text style={[styles.filterText, isSelected && styles.filterTextSelected]} numberOfLines={1}>{option}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function ModeButton({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeButton, selected && styles.modeButtonSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} view`}
    >
      <Ionicons name={icon} size={15} color={selected ? colors.background : colors.textSecondary} />
      <Text style={[styles.modeText, selected && styles.modeTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable onPress={onRemove} style={styles.activeChip} accessibilityRole="button" accessibilityLabel={`Remove ${label} filter`}>
      <Text style={styles.activeChipText} numberOfLines={1}>{label}</Text>
      <Ionicons name="close" size={14} color={colors.secondary} />
    </Pressable>
  );
}

function TimelineHeading({ section }: { section: NightTimelineSection }) {
  return (
    <View style={styles.timelineHeading}>
      {section.startsYear ? <Text style={styles.yearHeading}>{section.year}</Text> : null}
      <View style={styles.monthHeadingRow}>
        <Text style={styles.monthHeading}>{section.monthLabel.toUpperCase()}</Text>
        <View style={styles.monthRule} />
        <Text style={styles.monthCount}>{section.data.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingBottom: spacing.xxl * 2,
  },
  headerContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  titleBlock: {
    flex: 1,
  },
  eyebrow: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
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
  searchBox: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: colors.text,
    fontSize: 14,
  },
  clearSearch: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBlock: {
    marginTop: spacing.md,
  },
  toolbarRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  filterToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterToggleText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  filtersPanel: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.backgroundElevated,
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: spacing.xs,
  },
  filterItems: {
    marginHorizontal: -spacing.lg,
  },
  filterRail: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  filterOption: {
    minHeight: 44,
    maxWidth: 220,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  filterOptionSelected: {
    backgroundColor: "rgba(212, 175, 55, 0.12)",
    borderColor: colors.primary,
  },
  filterPressed: {
    opacity: 0.75,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  filterTextSelected: {
    color: colors.accent,
  },
  resultsRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  resultCount: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  modeControl: {
    flexDirection: "row",
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surface,
  },
  modeButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 7,
  },
  modeButtonSelected: {
    backgroundColor: colors.primary,
  },
  modeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  modeTextSelected: {
    color: colors.background,
  },
  clearAllButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  clearAllText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "700",
  },
  activeFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  activeChip: {
    minHeight: 44,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.45)",
    backgroundColor: "rgba(212, 175, 55, 0.08)",
  },
  activeChipText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  timelineHeading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  yearHeading: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  monthHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  monthHeading: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  monthRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  monthCount: {
    color: colors.muted,
    fontSize: 11,
  },
  addButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: colors.primary,
  },
  loader: {
    marginTop: spacing.xxl * 2,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyButtonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "800",
  },
});
