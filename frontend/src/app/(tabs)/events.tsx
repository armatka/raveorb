import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { EventListItem } from "../../components/EventListItem";
import { Screen } from "../../components/Screen";
import {
  filterDiscoveryEvents,
  groupDiscoveryEvents,
  matchesDiscoveryDateRange,
  type DiscoveryDateRange,
  type DiscoveryTypeFilter,
  type EventSection,
} from "../../lib/eventDiscovery";
import { eventStatusStorage, type EventStatus } from "../../lib/eventStatusStorage";
import { eventsRepository } from "../../services/eventsRepository";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import type { EventEntry } from "../../types/event";

const eventTypeOptions: Array<{ label: string; value: DiscoveryTypeFilter }> = [
  { label: "All", value: "all" },
  { label: "Rave", value: "rave" },
  { label: "Club", value: "club" },
  { label: "Festival", value: "festival" },
  { label: "Concert", value: "concert" },
];

const dateRangeOptions: Array<{ label: string; value: DiscoveryDateRange }> = [
  { label: "Tonight", value: "tonight" },
  { label: "This weekend", value: "weekend" },
  { label: "Next 7 days", value: "next-7-days" },
  { label: "Next 30 days", value: "next-30-days" },
  { label: "All upcoming", value: "all-upcoming" },
];

export default function EventsScreen() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [type, setType] = useState<DiscoveryTypeFilter>("all");
  const [dateRange, setDateRange] = useState<DiscoveryDateRange>("all-upcoming");
  const [now, setNow] = useState(() => new Date());
  const [statuses, setStatuses] = useState<Record<string, EventStatus>>({});
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventLoadError, setEventLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      setNow(new Date());
      setLoadingEvents(true);
      Promise.allSettled([eventsRepository.listEvents(), eventStatusStorage.list()])
        .then(([eventResult, statusResult]) => {
          if (!isCurrent) return;
          if (eventResult.status === "fulfilled") {
            setEvents(eventResult.value);
            setEventLoadError(null);
          } else {
            setEventLoadError(eventResult.reason instanceof Error ? eventResult.reason.message : "Could not load events.");
          }
          setStatuses(statusResult.status === "fulfilled" ? statusResult.value : {});
        })
        .finally(() => {
          if (isCurrent) setLoadingEvents(false);
        });
      return () => {
        isCurrent = false;
      };
    }, [retryToken]),
  );

  const cityOptions = useMemo(
    () => [...new Set(events.map((event) => event.city))].sort((first, second) => first.localeCompare(second)),
    [events],
  );
  const genreOptions = useMemo(
    () => [...new Set(events.flatMap((event) => event.genres))].sort((first, second) => first.localeCompare(second)),
    [events],
  );
  const visibleEvents = useMemo(
    () => filterDiscoveryEvents(events, query, { city, genres, type, dateRange }, now),
    [city, dateRange, events, genres, now, query, type],
  );
  const sections = useMemo(() => groupDiscoveryEvents(visibleEvents, now), [now, visibleEvents]);
  const upcomingCount = useMemo(
    () => events.filter((event) => matchesDiscoveryDateRange(event.date, "all-upcoming", now)).length,
    [events, now],
  );
  const isFiltered = Boolean(query.trim()) || city !== null || genres.length > 0 || type !== "all" || dateRange !== "all-upcoming";

  const clearAll = () => {
    setQuery("");
    setCity(null);
    setGenres([]);
    setType("all");
    setDateRange("all-upcoming");
  };

  const removeGenre = (genre: string) => {
    setGenres((current) => current.filter((item) => item !== genre));
  };

  const updateEventStatus = async (eventId: string, nextStatus: EventStatus | null) => {
    try {
      await eventStatusStorage.set(eventId, nextStatus);
      setStatuses((current) => {
        if (nextStatus === null) {
          const { [eventId]: _removed, ...remaining } = current;
          return remaining;
        }
        return { ...current, [eventId]: nextStatus };
      });
    } catch {
      Alert.alert("Could not update event", "Your status was not saved. Please try again.");
    }
  };

  const listHeader = (
    <View style={styles.headerContent}>
      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>RAVEORB DISCOVERY</Text>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>Find your next night</Text>
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={19} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Artists, venues, genres, cities"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search events"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} style={styles.clearSearch} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <FilterRail
        label="CITY"
        options={[{ label: "All cities", value: "all" }, ...cityOptions.map((item) => ({ label: item, value: item }))]}
        selectedValues={[city ?? "all"]}
        onSelect={(value) => setCity(value === "all" ? null : value)}
      />
      <FilterRail
        label="GENRE"
        options={genreOptions.map((item) => ({ label: item, value: item }))}
        selectedValues={genres}
        onSelect={(value) => setGenres((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])}
        multiSelect
      />
      <FilterRail label="EVENT TYPE" options={eventTypeOptions} selectedValues={[type]} onSelect={(value) => setType(value as DiscoveryTypeFilter)} />
      <FilterRail label="WHEN" options={dateRangeOptions} selectedValues={[dateRange]} onSelect={(value) => setDateRange(value as DiscoveryDateRange)} />
      <View style={styles.resultsRow}>
        <Text style={styles.resultCount}>{visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"}</Text>
        {isFiltered ? (
          <Pressable onPress={clearAll} style={styles.clearAllButton} accessibilityRole="button" accessibilityLabel="Clear all filters">
            <Text style={styles.clearAllText}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>
      {isFiltered ? (
        <View style={styles.activeFilters}>
          {query.trim() ? <ActiveFilter label={`Search: ${query.trim()}`} onRemove={() => setQuery("")} /> : null}
          {city ? <ActiveFilter label={city} onRemove={() => setCity(null)} /> : null}
          {genres.map((genre) => <ActiveFilter key={genre} label={genre} onRemove={() => removeGenre(genre)} />)}
          {type !== "all" ? <ActiveFilter label={eventTypeOptions.find((option) => option.value === type)?.label ?? type} onRemove={() => setType("all")} /> : null}
          {dateRange !== "all-upcoming" ? <ActiveFilter label={dateRangeOptions.find((option) => option.value === dateRange)?.label ?? dateRange} onRemove={() => setDateRange("all-upcoming")} /> : null}
        </View>
      ) : null}
    </View>
  );

  const emptyMessage = eventLoadError
    ? { title: "Discovery unavailable", message: eventLoadError }
    : upcomingCount === 0
      ? { title: "No upcoming events", message: "New nights will appear here as the discovery lineup is updated." }
      : query.trim()
        ? { title: "No search matches", message: "Try another artist, venue, genre, or city." }
        : { title: "No events match these filters", message: "Remove a filter or choose a wider date range." };

  return (
    <Screen edges={["top", "left", "right"]} style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(event) => event.id}
        renderItem={({ item }) => (
          <EventListItem event={item} status={statuses[item.id]} onStatusChange={(nextStatus) => updateEventStatus(item.id, nextStatus)} />
        )}
        renderSectionHeader={({ section }) => <SectionHeading section={section} />}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={loadingEvents ? <ActivityIndicator color={colors.primary} style={styles.emptyLoader} /> : <EmptyDiscovery title={emptyMessage.title} message={emptyMessage.message} actionLabel={eventLoadError ? "Retry" : undefined} onAction={eventLoadError ? () => setRetryToken((token) => token + 1) : undefined} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </Screen>
  );
}

type FilterOption = { label: string; value: string };

type FilterRailProps = {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onSelect: (value: string) => void;
  multiSelect?: boolean;
};

function FilterRail({ label, options, selectedValues, onSelect, multiSelect = false }: FilterRailProps) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        {options.map((option) => {
          const selected = selectedValues.includes(option.value);
          return (
            <Pressable key={option.value} onPress={() => onSelect(option.value)} style={({ pressed }) => [styles.filterOption, selected && styles.filterOptionSelected, pressed && styles.filterPressed]} accessibilityRole={multiSelect ? "checkbox" : "radio"} accessibilityState={{ selected }} accessibilityLabel={`${label.toLowerCase()}: ${option.label}`}>
              <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ActiveFilter({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable onPress={onRemove} style={styles.activeChip} accessibilityRole="button" accessibilityLabel={`Remove ${label} filter`}>
      <Text numberOfLines={1} style={styles.activeChipText}>{label}</Text>
      <Ionicons name="close" size={14} color={colors.secondary} />
    </Pressable>
  );
}

function SectionHeading({ section }: { section: EventSection }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );
}

function ItemSeparator() {
  return <View style={styles.itemSeparator} />;
}

function EmptyDiscovery({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="radio-outline" size={28} color={colors.secondary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.retryButton} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={styles.retryText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl * 2, maxWidth: 900, width: "100%", alignSelf: "center" },
  headerContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  titleBlock: { marginBottom: spacing.lg },
  eyebrow: { color: colors.secondary, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  searchBox: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: spacing.md },
  searchInput: { flex: 1, minHeight: 48, color: colors.text, fontSize: 14 },
  clearSearch: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  filterBlock: { marginBottom: spacing.sm },
  filterLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.1, marginBottom: spacing.xs },
  filterRail: { gap: spacing.xs, paddingRight: spacing.sm },
  filterOption: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  filterOptionSelected: { backgroundColor: "rgba(212, 175, 55, 0.12)", borderColor: colors.primary },
  filterPressed: { opacity: 0.75 },
  filterOptionText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  filterOptionTextSelected: { color: colors.accent },
  resultsRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  resultCount: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  clearAllButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  clearAllText: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
  activeFilters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  activeChip: { minHeight: 44, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 18, borderWidth: 1, borderColor: "rgba(212, 175, 55, 0.45)", backgroundColor: "rgba(212, 175, 55, 0.08)" },
  activeChipText: { color: colors.textSecondary, fontSize: 11 },
  sectionHeading: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "700" },
  sectionCount: { color: colors.muted, fontSize: 12 },
  itemSeparator: { height: 0 },
  emptyState: { alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl * 2 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center", marginTop: spacing.md },
  emptyMessage: { maxWidth: 300, color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: spacing.lg },
  emptyLoader: { marginTop: spacing.xxl * 2 },
  retryButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: 9, backgroundColor: colors.primary },
  retryText: { color: colors.background, fontSize: 12, fontWeight: "800" },
});
