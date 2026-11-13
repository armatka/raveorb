import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { DISCOVERY_RADIUS_OPTIONS, isSameDiscoveryLocation, type DiscoveryRadiusKm } from "../lib/discoveryLocation";
import type { DiscoveryDateRange } from "../lib/eventDiscovery";
import { goBackOrReplace } from "../lib/navigation";
import { preferencesStorage, type AppPreferences } from "../lib/preferencesStorage";
import { showAlert } from "../lib/showAlert";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { raveOrbCategories, type DiscoveryLocation, type RaveOrbCategory } from "../types/event";

const dateRangeOptions: Array<{ label: string; value: DiscoveryDateRange }> = [
  { label: "Tonight", value: "tonight" },
  { label: "This weekend", value: "weekend" },
  { label: "Next 7 days", value: "next-7-days" },
  { label: "Next 30 days", value: "next-30-days" },
  { label: "All upcoming", value: "all-upcoming" },
];

export default function PreferencesScreen() {
  const [preferences, setPreferences] = useState<AppPreferences | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    preferencesStorage.get().then((value) => {
      if (active) {
        setPreferences(value);
        setLoadError(false);
      }
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => { active = false; };
  }, [retryToken]));

  const update = async <K extends "savedLocations" | "favouriteCategories" | "radiusKm" | "defaultDateRange",>(
    key: K,
    value: AppPreferences[K],
    save: () => Promise<void>,
    errorTitle: string,
  ) => {
    if (!preferences) return;
    const previous = preferences[key];
    setPreferences((current) => current ? { ...current, [key]: value } : current);
    try {
      await save();
    } catch {
      setPreferences((current) => current ? { ...current, [key]: previous } : current);
      showAlert(errorTitle, "Your preference was not saved. Please try again.");
    }
  };

  const removeLocation = (location: DiscoveryLocation) => {
    if (!preferences) return;
    const locations = preferences.savedLocations.filter((saved) => !isSameDiscoveryLocation(saved, location));
    void update("savedLocations", locations, () => preferencesStorage.setSavedLocations(locations), "Could not remove city");
  };

  const toggleCategory = (category: RaveOrbCategory) => {
    if (!preferences) return;
    const categories = preferences.favouriteCategories.includes(category)
      ? preferences.favouriteCategories.filter((item) => item !== category)
      : [...preferences.favouriteCategories, category];
    void update("favouriteCategories", categories, () => preferencesStorage.setFavouriteCategories(categories), "Could not update favourite styles");
  };

  const setRadius = (radiusKm: DiscoveryRadiusKm) => {
    void update("radiusKm", radiusKm, () => preferencesStorage.setRadiusKm(radiusKm), "Could not update search radius");
  };

  const setDateRange = (dateRange: DiscoveryDateRange) => {
    void update("defaultDateRange", dateRange, () => preferencesStorage.setDefaultDateRange(dateRange), "Could not update default date range");
  };

  return (
    <Screen edges={["top", "left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader title="Preferences" onBack={() => goBackOrReplace("/(tabs)")} />
      {loadError ? (
        <View style={styles.message}>
          <Text style={styles.messageText}>Preferences could not be loaded.</Text>
          <Pressable onPress={() => setRetryToken((token) => token + 1)} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : !preferences ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <Text style={styles.intro}>Shape what you see across RaveOrb.</Text>
          <Section title="YOUR CITIES" />
          {preferences.savedLocations.length ? (
            preferences.savedLocations.map((location) => (
              <View key={`${location.city}-${location.region ?? ""}-${location.countryCode}`} style={styles.cityRow}>
                <View style={styles.cityCopy}>
                  <Text style={styles.cityName}>{location.city}</Text>
                  <Text style={styles.cityDetails}>{[location.region, location.countryCode].filter(Boolean).join(", ")}</Text>
                </View>
                <Pressable onPress={() => removeLocation(location)} style={styles.removeButton} accessibilityRole="button" accessibilityLabel={`Remove saved city ${location.label}`}>
                  <Ionicons name="close-circle-outline" size={21} color={colors.muted} />
                </Pressable>
              </View>
            ))
          ) : <Text style={styles.helper}>Save a city from the Discovery location picker.</Text>}

          <Section title="FAVOURITE STYLES" />
          <Text style={styles.helper}>Choose any styles for Discovery and Home recommendations.</Text>
          <View style={styles.chipWrap}>
            {raveOrbCategories.map((category) => (
              <Chip key={category} label={category} selected={preferences.favouriteCategories.includes(category)} onPress={() => toggleCategory(category)} />
            ))}
          </View>

          <Section title="SEARCH RADIUS" />
          <ChoiceRail
            options={DISCOVERY_RADIUS_OPTIONS.map((value) => ({ label: `${value} km`, value }))}
            selected={preferences.radiusKm}
            onSelect={(value) => setRadius(value as DiscoveryRadiusKm)}
            label="Search radius"
          />

          <Section title={'DEFAULT "WHEN"'} />
          <ChoiceRail
            options={dateRangeOptions}
            selected={preferences.defaultDateRange}
            onSelect={(value) => setDateRange(value as DiscoveryDateRange)}
            label="Default date range"
          />
        </>
      )}
    </Screen>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={label}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceRail<T extends string | number>({
  options,
  selected,
  onSelect,
  label,
}: {
  options: Array<{ label: string; value: T }>;
  selected: T;
  onSelect: (value: T) => void;
  label: string;
}) {
  return (
    <View style={styles.choiceRow} accessibilityLabel={label}>
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => onSelect(option.value)} style={[styles.choice, selected === option.value && styles.choiceSelected]} accessibilityRole="radio" accessibilityState={{ checked: selected === option.value }} aria-checked={selected === option.value} accessibilityLabel={option.label}>
          <Text style={[styles.choiceText, selected === option.value && styles.choiceTextSelected]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
  loader: { marginTop: spacing.xxl },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  section: { color: colors.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  cityRow: { minHeight: 54, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border },
  cityCopy: { flex: 1 },
  cityName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  cityDetails: { color: colors.muted, fontSize: 11, marginTop: 2 },
  removeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  chip: { minHeight: 42, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: "rgba(212, 175, 55, 0.12)", borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: colors.accent },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  choice: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  choiceSelected: { backgroundColor: "rgba(212, 175, 55, 0.12)", borderColor: colors.primary },
  choiceText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  choiceTextSelected: { color: colors.accent },
  message: { alignItems: "center", marginTop: spacing.xxl, gap: spacing.md },
  messageText: { color: colors.textSecondary, fontSize: 14 },
  retryText: { color: colors.secondary, fontWeight: "700", padding: spacing.md },
});
