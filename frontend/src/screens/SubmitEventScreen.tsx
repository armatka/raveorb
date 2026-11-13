import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { DateInput } from "../components/DateInput";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { TimePickerField } from "../components/TimePickerField";
import { formatCalendarDate } from "../lib/calendarDate";
import { searchLocations } from "../services/locationsApi";
import { submitEvent } from "../services/submissionsApi";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { raveOrbCategories, type CitySearchResult, type EventSubmissionInput, type RaveOrbCategory } from "../types/event";

export default function SubmitEventScreen() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(formatCalendarDate(new Date()));
  const [startTime, setStartTime] = useState("21:00");
  const [endTime, setEndTime] = useState("03:00");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [city, setCity] = useState<CitySearchResult | null>(null);
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [cityError, setCityError] = useState("");
  const [artists, setArtists] = useState("");
  const [style, setStyle] = useState<RaveOrbCategory>("Techno");
  const [description, setDescription] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [currency, setCurrency] = useState("");
  const [ageRestriction, setAgeRestriction] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [loadingCity, setLoadingCity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (city || cityQuery.trim().length < 2) {
      setCityResults([]);
      setCityError("");
      setLoadingCity(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoadingCity(true);
      searchLocations(cityQuery.trim())
        .then((results) => { if (active) { setCityResults(results); setCityError(""); } })
        .catch((cause: unknown) => { if (active) { setCityResults([]); setCityError(cause instanceof Error ? cause.message : "City search is unavailable."); } })
        .finally(() => { if (active) setLoadingCity(false); });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [city, cityQuery]);

  const chooseCity = (result: CitySearchResult) => {
    setCity(result);
    setCityQuery(result.label);
    setCityError(result.timezone ? "" : "Timezone information is unavailable for this city. Choose another result.");
  };

  const submit = async () => {
    setError("");
    if (!city) {
      setError("Choose a city from the search results.");
      return;
    }
    if (!city.timezone) {
      setError("The selected city has no timezone information. Choose another city.");
      return;
    }
    const input: EventSubmissionInput = {
      title: title.trim(),
      date,
      startTime,
      endTime,
      timezone: city.timezone,
      venueName: venueName.trim(),
      address: address.trim(),
      city: city.city,
      ...(city.region ? { region: city.region } : {}),
      countryCode: city.countryCode,
      latitude: city.latitude,
      longitude: city.longitude,
      artists: artists.split(",").map((artist) => artist.trim()).filter(Boolean),
      style,
      description: description.trim(),
      ...(ticketUrl.trim() ? { ticketUrl: ticketUrl.trim() } : {}),
      ...(priceMin.trim() ? { priceMin: Number(priceMin) } : {}),
      ...(priceMax.trim() ? { priceMax: Number(priceMax) } : {}),
      ...(currency.trim() ? { currency: currency.trim().toUpperCase() } : {}),
      ...(ageRestriction.trim() ? { ageRestriction: ageRestriction.trim() } : {}),
      ...(submitterEmail.trim() ? { submitterEmail: submitterEmail.trim() } : {}),
    };
    setSubmitting(true);
    try {
      await submitEvent(input);
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your event could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={["top", "left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader title="Submit an event" onBack={() => router.back()} />
      {submitted ? (
        <View style={styles.success}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
          <Text style={styles.successTitle}>Thanks for contributing</Text>
          <Text style={styles.body}>Thanks, your event will appear once it's reviewed.</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.intro}>Share an underground or independent event that isn't on Ticketmaster. Every submission is reviewed before it appears in Discovery.</Text>
          <Field label="Event title *" value={title} onChangeText={setTitle} maxLength={150} />
          <DateInput label="Date *" value={date} onChange={setDate} />
          <View style={styles.timeRow}>
            <View style={styles.timeField}><TimePickerField label="Start time *" value={startTime} onChange={setStartTime} /></View>
            <View style={styles.timeField}><TimePickerField label="End time *" value={endTime} onChange={setEndTime} /></View>
          </View>
          <Field label="Venue name *" value={venueName} onChangeText={setVenueName} maxLength={120} />
          <Field label="Street address *" value={address} onChangeText={setAddress} maxLength={200} />
          <Field
            label="City *"
            value={cityQuery}
            onChangeText={(value) => { setCityQuery(value); setCity(null); }}
            placeholder="Search a city"
            maxLength={80}
          />
          {loadingCity ? <ActivityIndicator color={colors.primary} style={styles.cityMessage} accessibilityLabel="Searching cities" /> : null}
          {cityError ? <Text style={styles.errorText}>{cityError}</Text> : null}
          {cityResults.map((result) => (
            <Pressable key={result.id} onPress={() => chooseCity(result)} style={styles.cityResult} accessibilityRole="button" accessibilityLabel={`Choose ${result.label}`}>
              <Text style={styles.cityResultText}>{result.label}</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.secondary} />
            </Pressable>
          ))}
          {city ? <Text style={styles.helper}>Timezone: {city.timezone ?? "Unavailable"} · {city.countryCode}</Text> : null}
          <Field label="Artists (comma-separated)" value={artists} onChangeText={setArtists} maxLength={1600} placeholder="Artist names" />

          <Text style={styles.label}>Style *</Text>
          <View style={styles.chipWrap}>
            {raveOrbCategories.map((category) => (
              <Pressable
                key={category}
                onPress={() => setStyle(category)}
                style={[styles.chip, category === style && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ checked: category === style }}
                aria-checked={category === style}
                accessibilityLabel={category}
              >
                <Text style={[styles.chipText, category === style && styles.chipTextSelected]}>{category}</Text>
              </Pressable>
            ))}
          </View>

          <Field label="Description *" value={description} onChangeText={setDescription} maxLength={2000} multiline />
          <Field label="Ticket link (HTTPS only)" value={ticketUrl} onChangeText={setTicketUrl} maxLength={500} keyboardType="url" autoCapitalize="none" />
          <View style={styles.priceRow}>
            <View style={styles.priceField}><Field label="Minimum price" value={priceMin} onChangeText={setPriceMin} keyboardType="decimal-pad" /></View>
            <View style={styles.priceField}><Field label="Maximum price" value={priceMax} onChangeText={setPriceMax} keyboardType="decimal-pad" /></View>
          </View>
          <View style={styles.priceRow}>
            <View style={styles.priceField}><Field label="Currency" value={currency} onChangeText={setCurrency} maxLength={3} autoCapitalize="characters" placeholder="EUR" /></View>
            <View style={styles.priceField}><Field label="Age restriction" value={ageRestriction} onChangeText={setAgeRestriction} maxLength={40} placeholder="18+" /></View>
          </View>
          <Field label="Your email (optional)" value={submitterEmail} onChangeText={setSubmitterEmail} maxLength={254} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.helper}>Only used if moderators have a question. Your email is never shown publicly.</Text>
          {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
          <Pressable onPress={() => { void submit(); }} disabled={submitting} style={[styles.primaryButton, submitting && styles.disabledButton]} accessibilityRole="button">
            {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>Submit for review</Text>}
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
} & Omit<ComponentProps<typeof TextInput>, "value" | "onChangeText">) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholderTextColor={colors.muted} style={[styles.input, props.multiline && styles.multiline]} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
  intro: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginVertical: spacing.md },
  field: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: spacing.xs },
  input: { minHeight: 48, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.md, fontSize: 14 },
  multiline: { minHeight: 110, paddingTop: spacing.md, textAlignVertical: "top" },
  timeRow: { flexDirection: "row", gap: spacing.md },
  timeField: { flex: 1 },
  cityMessage: { marginVertical: spacing.sm },
  cityResult: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cityResultText: { color: colors.text, fontSize: 13 },
  helper: { color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: spacing.md },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.lg },
  chip: { minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: "rgba(212, 175, 55, 0.12)", borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  chipTextSelected: { color: colors.accent },
  priceRow: { flexDirection: "row", gap: spacing.md },
  priceField: { flex: 1 },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 19, marginVertical: spacing.sm },
  primaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: spacing.md, borderRadius: 8, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.background, fontSize: 14, fontWeight: "700" },
  disabledButton: { opacity: 0.65 },
  success: { alignItems: "center", gap: spacing.md, marginTop: spacing.xxl },
  successTitle: { color: colors.text, fontSize: 22, fontWeight: "700" },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
