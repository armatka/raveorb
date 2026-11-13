import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EventListItem } from "../../components/EventListItem";
import { Screen } from "../../components/Screen";
import {
  filterElectronicDiscoveryEvents,
  filterDiscoveryEvents,
  groupDiscoveryEvents,
  type DiscoveryDateRange,
  type ElectronicDiscoveryCategory,
  type EventSection,
} from "../../lib/eventDiscovery";
import {
  allDiscoveryLocationsLabel,
  discoveryEventsQuery,
  DEFAULT_DISCOVERY_LOCATION,
  DEFAULT_DISCOVERY_RADIUS_KM,
  discoveryLocationFromCity,
  hasDiscoveryCoordinates,
  loadDiscoveryLocation,
  PRESET_DISCOVERY_LOCATIONS,
} from "../../lib/discoveryLocation";
import { eventStatusStorage, type EventStatus } from "../../lib/eventStatusStorage";
import { preferencesStorage } from "../../lib/preferencesStorage";
import { showAlert } from "../../lib/showAlert";
import { eventsDataMode, eventsRepository } from "../../services/eventsRepository";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import type { DiscoveryLocation, EventEntry } from "../../types/event";

const primaryCategoryOptions: Array<{ label: string; value: ElectronicDiscoveryCategory }> = [
  { label: "All", value: "all" },
  { label: "House", value: "House" },
  { label: "Techno", value: "Techno" },
  { label: "Trance", value: "Trance" },
  { label: "Drum & Bass", value: "Drum & Bass" },
  { label: "Bass", value: "Bass" },
  { label: "Festivals", value: "festivals" },
];

const secondaryCategoryOptions: Array<{ label: string; value: ElectronicDiscoveryCategory }> = [
  { label: "Tech House", value: "Tech House" },
  { label: "Deep House", value: "Deep House" },
  { label: "Minimal / Deep Tech", value: "Minimal / Deep Tech" },
  { label: "Hard Techno", value: "Hard Techno" },
  { label: "Melodic House & Techno", value: "Melodic House & Techno" },
  { label: "Progressive", value: "Progressive" },
  { label: "Garage", value: "Garage" },
  { label: "EDM", value: "EDM" },
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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [location, setLocation] = useState<DiscoveryLocation | null>(DEFAULT_DISCOVERY_LOCATION);
  const [locationReady, setLocationReady] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ElectronicDiscoveryCategory>("all");
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [dateRange, setDateRange] = useState<DiscoveryDateRange>("all-upcoming");
  const [now, setNow] = useState(() => new Date());
  const [statuses, setStatuses] = useState<Record<string, EventStatus>>({});
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventLoadError, setEventLoadError] = useState<string | null>(null);
  const [statusLoadError, setStatusLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      setNow(new Date());
      setLocationReady(false);
      Promise.allSettled([eventStatusStorage.list(), loadDiscoveryLocation()])
        .then(([statusResult, locationResult]) => {
          if (!isCurrent) return;
          if (statusResult.status === "fulfilled") setStatuses(statusResult.value);
          setStatusLoadError(statusResult.status === "rejected");
          if (locationResult.status === "fulfilled") setLocation(locationResult.value);
          setLocationError(locationResult.status === "rejected");
          setLocationReady(true);
        })
      return () => {
        isCurrent = false;
      };
    }, [retryToken]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!locationReady) return undefined;
      let isCurrent = true;
      setLoadingEvents(true);
      setEventLoadError(null);
      setEvents([]);
      setPage(0);
      setTotalPages(1);
      eventsRepository.listEventsPage({
        ...discoveryEventsQuery(location),
        classificationName: "Music",
        search: debouncedQuery || undefined,
        ...(!debouncedQuery ? { electronicOnly: true } : {}),
        page: 0,
        size: debouncedQuery ? 20 : 50,
        sort: "date,asc",
        unit: "km",
      }).then((result) => {
        if (!isCurrent) return;
        setEvents(result.events);
        setPage(result.page);
        setTotalPages(result.totalPages);
      }).catch((error: unknown) => {
        if (isCurrent) setEventLoadError(error instanceof Error ? error.message : "Could not load events.");
      }).finally(() => {
        if (isCurrent) {
          setLoadingEvents(false);
          setRefreshing(false);
        }
      });
      return () => { isCurrent = false; };
    }, [debouncedQuery, location, locationReady, retryToken]),
  );

  const visibleEvents = useMemo(() => {
    const filtered = filterDiscoveryEvents(events, query, {
      city: location?.city ?? null,
      hasCoordinates: eventsDataMode === "api" && hasDiscoveryCoordinates(location),
      genres: [],
      type: "all",
      dateRange,
    }, now);
    return filterElectronicDiscoveryEvents(filtered, query, selectedCategory);
  }, [dateRange, events, location, now, query, selectedCategory]);
  const sections = useMemo(() => groupDiscoveryEvents(visibleEvents, now), [now, visibleEvents]);
  const isFiltered = Boolean(query.trim()) || selectedCategory !== "all" || dateRange !== "all-upcoming";
  const hasMore = eventsDataMode === "api" && page + 1 < totalPages;

  const clearAll = () => {
    setQuery("");
    setSelectedCategory("all");
    setShowMoreCategories(false);
    setDateRange("all-upcoming");
  };

  const refreshEvents = () => {
    setRefreshing(true);
    setRetryToken((token) => token + 1);
  };

  const selectLocation = async (nextLocation: DiscoveryLocation | null) => {
    if (savingLocation) return;
    setSavingLocation(true);
    try {
      await preferencesStorage.setDiscoveryLocation(nextLocation);
      setLocation(nextLocation);
      setLocationSearch("");
      setLocationError(false);
      setLocationOpen(false);
    } catch {
      showAlert("Could not save location", "Your discovery location was not changed. Please try again.");
    } finally {
      setSavingLocation(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await eventsRepository.listEventsPage({
        ...discoveryEventsQuery(location),
        classificationName: "Music",
        search: debouncedQuery || undefined,
        ...(!debouncedQuery ? { electronicOnly: true } : {}),
        page: nextPage,
        size: debouncedQuery ? 20 : 50,
        sort: "date,asc",
        unit: "km",
      });
      setEvents((current) => {
        const existingIds = new Set(current.map((event) => event.id));
        return [...current, ...result.events.filter((event) => !existingIds.has(event.id))];
      });
      setPage(result.page);
      setTotalPages(result.totalPages);
    } catch (error) {
      showAlert("Could not load more events", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoadingMore(false);
    }
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
      showAlert("Could not update event", "Your status was not saved. Please try again.");
    }
  };

  const locationLabel = location
    ? `${location.label}${hasDiscoveryCoordinates(location) ? ` · within ${DEFAULT_DISCOVERY_RADIUS_KM} km` : ""}`
    : allDiscoveryLocationsLabel();
  const locationSearchValue = locationSearch.trim().toLocaleLowerCase();
  const locationChoices = PRESET_DISCOVERY_LOCATIONS.filter((option) => option.label.toLocaleLowerCase().includes(locationSearchValue));
  const selectedIsPreset = location !== null && PRESET_DISCOVERY_LOCATIONS.some((option) => option.city === location.city && option.countryCode === location.countryCode);
  const showSelectedCustomLocation = location !== null && !selectedIsPreset && location.label.toLocaleLowerCase().includes(locationSearchValue);
  const hasLocationChoice = PRESET_DISCOVERY_LOCATIONS.some((option) => option.city.toLocaleLowerCase() === locationSearchValue)
    || (location !== null && location.city.toLocaleLowerCase() === locationSearchValue);

  const listHeader = (
    <View style={styles.headerContent}>
      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>RAVEORB DISCOVERY</Text>
        <Text style={styles.title}>Discover</Text>
        <Pressable onPress={() => setLocationOpen(true)} disabled={loadingEvents || locationError} style={styles.locationButton} accessibilityRole="button" accessibilityLabel={`Discovery location: ${locationLabel}`} accessibilityHint="Choose a discovery location">
          <Ionicons name="location-outline" size={19} color={colors.secondary} />
          <Text style={styles.locationText} numberOfLines={1}>{locationLabel}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.secondary} />
        </Pressable>
      </View>
      {locationError ? (
        <Pressable onPress={() => setRetryToken((token) => token + 1)} style={styles.retryButton} accessibilityRole="button" accessibilityLabel="Retry loading location preference">
          <Text style={styles.retryText}>Location unavailable. Retry</Text>
        </Pressable>
      ) : null}
      {statusLoadError ? (
        <Pressable onPress={() => setRetryToken((token) => token + 1)} style={styles.retryButton} accessibilityRole="button" accessibilityLabel="Retry loading event statuses">
          <Text style={styles.retryText}>Event statuses unavailable. Retry</Text>
        </Pressable>
      ) : null}
      {eventsDataMode === "mock" ? <Text style={styles.mockNotice}>DEVELOPMENT SAMPLE EVENTS</Text> : null}
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
      <FilterRail label="RAVEORB STYLES" options={primaryCategoryOptions} selectedValues={[selectedCategory]} onSelect={(value) => setSelectedCategory(value as ElectronicDiscoveryCategory)} />
      <Pressable onPress={() => setShowMoreCategories((visible) => !visible)} style={styles.moreStylesButton} accessibilityRole="button" accessibilityState={{ expanded: showMoreCategories }} accessibilityLabel={showMoreCategories ? "Hide more music styles" : "Show more music styles"}>
        <Text style={styles.moreStylesText}>{showMoreCategories ? "Fewer styles" : "More styles"}</Text>
        <Ionicons name={showMoreCategories ? "chevron-up" : "chevron-down"} size={16} color={colors.secondary} />
      </Pressable>
      {showMoreCategories ? <FilterRail label="MORE STYLES" options={secondaryCategoryOptions} selectedValues={[selectedCategory]} onSelect={(value) => setSelectedCategory(value as ElectronicDiscoveryCategory)} /> : null}
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
          {selectedCategory !== "all" ? <ActiveFilter label={primaryCategoryOptions.concat(secondaryCategoryOptions).find((option) => option.value === selectedCategory)?.label ?? selectedCategory} onRemove={() => setSelectedCategory("all")} /> : null}
          {dateRange !== "all-upcoming" ? <ActiveFilter label={dateRangeOptions.find((option) => option.value === dateRange)?.label ?? dateRange} onRemove={() => setDateRange("all-upcoming")} /> : null}
        </View>
      ) : null}
    </View>
  );

  const emptyMessage = eventLoadError
    ? { title: "Discovery unavailable", message: eventLoadError }
    : { title: "No events found", message: location ? `No events found in ${location.city} with these filters.` : "No events found with these filters." };

  return (
    <Screen edges={["top", "left", "right"]} style={styles.container}>
      <SectionList
        sections={eventLoadError ? [] : sections}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshEvents} tintColor={colors.primary} colors={[colors.primary]} />}
        keyExtractor={(event) => event.id}
        renderItem={({ item }) => (
          <EventListItem event={item} status={statusLoadError ? undefined : statuses[item.id]} onStatusChange={statusLoadError ? undefined : (nextStatus) => updateEventStatus(item.id, nextStatus)} />
        )}
        renderSectionHeader={({ section }) => <SectionHeading section={section} />}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={listHeader}
        ListFooterComponent={hasMore ? <Pressable onPress={() => { void loadMore(); }} style={styles.loadMoreButton} disabled={loadingMore} accessibilityRole="button" accessibilityLabel="Load more events">{loadingMore ? <ActivityIndicator color={colors.background} /> : <Text style={styles.loadMoreText}>Load more</Text>}</Pressable> : undefined}
        ListEmptyComponent={loadingEvents ? <ActivityIndicator color={colors.primary} style={styles.emptyLoader} /> : <EmptyDiscovery title={emptyMessage.title} message={emptyMessage.message} actionLabel={eventLoadError ? "Retry" : "Clear filters"} onAction={eventLoadError ? () => setRetryToken((token) => token + 1) : clearAll} onViewAll={!eventLoadError && location ? () => { void selectLocation(null); } : undefined} onLoadMore={!eventLoadError && hasMore ? () => { void loadMore(); } : undefined} loadingMore={loadingMore} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      <Modal visible={locationOpen} transparent animationType="slide" onRequestClose={() => setLocationOpen(false)}>
        <SafeAreaView style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={styles.sheetAvoider}>
            <View style={styles.locationSheet} accessibilityViewIsModal>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Choose location</Text>
                <Pressable onPress={() => setLocationOpen(false)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close location selector">
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
              <TextInput
                value={locationSearch}
                onChangeText={setLocationSearch}
                placeholder="Search a city"
                placeholderTextColor={colors.muted}
                style={styles.locationSearch}
                returnKeyType="search"
                accessibilityLabel="Search discovery city"
              />
              <ScrollView keyboardShouldPersistTaps="handled">
                {[null, ...locationChoices, ...(showSelectedCustomLocation ? [location] : [])].map((option) => (
                  <Pressable key={option?.city ?? "all-locations"} onPress={() => { void selectLocation(option); }} disabled={savingLocation} style={styles.locationOption} accessibilityRole="radio" accessibilityState={{ checked: location?.city === option?.city && location?.countryCode === option?.countryCode, disabled: savingLocation }} aria-checked={location?.city === option?.city && location?.countryCode === option?.countryCode} accessibilityLabel={option?.label ?? "All locations"}>
                    <Text style={styles.locationOptionText}>{option?.label ?? "All locations"}</Text>
                    {location?.city === option?.city && location?.countryCode === option?.countryCode ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                  </Pressable>
                ))}
                {locationSearch.trim() && !hasLocationChoice ? (
                  <Pressable onPress={() => { void selectLocation(discoveryLocationFromCity(locationSearch, location?.countryCode ?? DEFAULT_DISCOVERY_LOCATION.countryCode)); }} disabled={savingLocation} style={styles.locationOption} accessibilityRole="button" accessibilityLabel={`Use city ${locationSearch.trim()}`}>
                    <Text style={styles.locationOptionText}>Use {locationSearch.trim()}</Text>
                    {savingLocation ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="arrow-forward" size={18} color={colors.secondary} />}
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
            <Pressable key={option.value} onPress={() => onSelect(option.value)} style={({ pressed }) => [styles.filterOption, selected && styles.filterOptionSelected, pressed && styles.filterPressed]} accessibilityRole={multiSelect ? "checkbox" : "radio"} accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={`${label.toLowerCase()}: ${option.label}`}>
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

function EmptyDiscovery({ title, message, actionLabel, onAction, onViewAll, onLoadMore, loadingMore = false }: { title: string; message: string; actionLabel?: string; onAction?: () => void; onViewAll?: () => void; onLoadMore?: () => void; loadingMore?: boolean }) {
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
      {onViewAll ? <Pressable onPress={onViewAll} style={styles.viewAllButton} accessibilityRole="button" accessibilityLabel="View all locations"><Text style={styles.viewAllText}>View all locations</Text></Pressable> : null}
      {onLoadMore ? <Pressable onPress={onLoadMore} style={styles.loadMoreButton} disabled={loadingMore} accessibilityRole="button" accessibilityLabel="Load more events">{loadingMore ? <ActivityIndicator color={colors.background} /> : <Text style={styles.loadMoreText}>Load more</Text>}</Pressable> : null}
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
  mockNotice: { color: colors.warning, fontSize: 10, fontWeight: "700", marginBottom: spacing.sm },
  locationButton: { minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: spacing.xs },
  locationText: { color: colors.secondary, fontSize: 17, fontWeight: "700", flexShrink: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.65)" },
  // Pads the sheet above the keyboard; flexShrink lets the sheet compress
  // instead of being pushed off-screen when the keyboard is open.
  sheetAvoider: { flex: 1, justifyContent: "flex-end" },
  locationSheet: { maxHeight: "75%", flexShrink: 1, backgroundColor: colors.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  sheetHeader: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  locationOption: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border },
  locationOptionText: { color: colors.text, fontSize: 15 },
  locationSearch: { minHeight: 48, color: colors.text, fontSize: 14, paddingHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  moreStylesButton: { minHeight: 40, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: spacing.xs, paddingHorizontal: spacing.xs },
  moreStylesText: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
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
  loadMoreButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: 8 },
  loadMoreText: { color: colors.background, fontSize: 13, fontWeight: "800" },
  viewAllButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  viewAllText: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
});
