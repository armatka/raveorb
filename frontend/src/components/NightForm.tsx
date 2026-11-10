import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { RatingSelector } from "./RatingSelector";
import type { Night, NightInput } from "../types/Night";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { theme } from "../theme/theme";
import { persistNightPhotos } from "../lib/nightsStorage";

type NightFormProps = {
  heading: string;
  submitLabel: string;
  initialNight?: Night;
  initialValues?: Partial<NightInput>;
  onSave: (input: NightInput) => Promise<void>;
};

type FormValues = {
  date: string;
  eventName: string;
  venueName: string;
  city: string;
  artistsSeen: string;
  friends: string;
  rating: number;
  cost: string;
  notes: string;
  favoriteMoment: string;
  photos: string[];
};

const today = new Date().toISOString().slice(0, 10);

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function getInitialValues(
  night?: Night,
  initialValues?: Partial<NightInput>,
): FormValues {
  return {
    date: night?.date ?? initialValues?.date ?? today,
    eventName: night?.eventName ?? initialValues?.eventName ?? "",
    venueName: night?.venueName ?? initialValues?.venueName ?? "",
    city: night?.city ?? initialValues?.city ?? "",
    artistsSeen:
      night?.artistsSeen.join(", ")
      ?? initialValues?.artistsSeen?.join(", ")
      ?? "",
    friends:
      night?.friends.join(", ")
      ?? initialValues?.friends?.join(", ")
      ?? "",
    rating: night?.rating ?? initialValues?.rating ?? 0,
    cost: night
      ? String(night.cost)
      : initialValues?.cost !== undefined
        ? String(initialValues.cost)
        : "",
    notes: night?.notes ?? initialValues?.notes ?? "",
    favoriteMoment:
      night?.favoriteMoment
      ?? initialValues?.favoriteMoment
      ?? "",
    photos: night?.photos ?? initialValues?.photos ?? [],
  };
}

export function NightForm({
  heading,
  submitLabel,
  initialNight,
  initialValues,
  onSave,
}: NightFormProps) {
  const [values, setValues] = useState<FormValues>(
    () => getInitialValues(initialNight, initialValues),
  );
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const pickPhotos = async () => {
    try {
      const remaining = 12 - values.photos.length;
      if (remaining <= 0) {
        Alert.alert("Photo limit reached", "A night can include up to 12 photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.9,
      });
      if (!result.canceled) {
        const selected = result.assets.map((asset) => asset.uri);
        update("photos", [...new Set([...values.photos, ...selected])].slice(0, 12));
      }
    } catch {
      Alert.alert("Could not open photos", "Please try selecting your photos again.");
    }
  };

  const handleSave = async () => {
    const eventName = values.eventName.trim();
    const venueName = values.venueName.trim();
    const city = values.city.trim();
    const dateParts = values.date.split("-").map(Number);
    const parsedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const cost = values.cost.trim() ? Number(values.cost) : 0;

    if (!eventName || !venueName || !city || !/^\d{4}-\d{2}-\d{2}$/.test(values.date)
      || Number.isNaN(parsedDate.getTime())
      || parsedDate.getFullYear() !== dateParts[0]
      || parsedDate.getMonth() !== dateParts[1] - 1
      || parsedDate.getDate() !== dateParts[2]) {
      Alert.alert("Complete the required fields", "Add an event, venue, city, and date in YYYY-MM-DD format.");
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      Alert.alert("Check the cost", "Cost must be a positive number or zero.");
      return;
    }

    const input: NightInput = {
      date: values.date,
      eventName,
      venueName,
      city,
      artistsSeen: splitList(values.artistsSeen),
      friends: splitList(values.friends),
      rating: values.rating,
      cost,
      notes: values.notes.trim(),
      favoriteMoment: values.favoriteMoment.trim(),
      photos: values.photos,
    };

    setSaving(true);
    try {
      input.photos = await persistNightPhotos(input.photos);
      await onSave(input);
    } catch {
      Alert.alert("Could not save night", "Your changes were not saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.heading}>{heading}</Text>
      </View>

      <Text style={styles.sectionLabel}>THE NIGHT</Text>
      <Field label="Event name *" value={values.eventName} onChangeText={(text) => update("eventName", text)} placeholder="e.g. Afterglow" />
      <Field label="Date *" value={values.date} onChangeText={(text) => update("date", text)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      <Field label="Venue *" value={values.venueName} onChangeText={(text) => update("venueName", text)} placeholder="Venue name" />
      <Field label="City *" value={values.city} onChangeText={(text) => update("city", text)} placeholder="City" />

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionLabel}>THE PEOPLE</Text>
      <Field label="Artists seen" value={values.artistsSeen} onChangeText={(text) => update("artistsSeen", text)} placeholder="Separate names with commas" />
      <Field label="Friends" value={values.friends} onChangeText={(text) => update("friends", text)} placeholder="Separate names with commas" />

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionLabel}>THE DETAILS</Text>
      <RatingSelector value={values.rating} onChange={(rating) => update("rating", rating)} />
      <Field label="Total cost" value={values.cost} onChangeText={(text) => update("cost", text)} placeholder="0.00" keyboardType="decimal-pad" prefix="$" />
      <Field label="Favorite moment" value={values.favoriteMoment} onChangeText={(text) => update("favoriteMoment", text)} placeholder="The moment you want to remember" multiline />
      <Field label="Notes" value={values.notes} onChangeText={(text) => update("notes", text)} placeholder="Set, atmosphere, anything worth remembering" multiline />
      <View style={styles.photoSection}>
        <View style={styles.photoHeader}>
          <View>
            <Text style={styles.fieldLabel}>Photos</Text>
            <Text style={styles.photoCount}>{values.photos.length} of 12 added</Text>
          </View>
          <Pressable onPress={pickPhotos} style={styles.photoButton} accessibilityRole="button" accessibilityLabel="Choose photos">
            <Ionicons name="image-outline" size={17} color={colors.secondary} />
            <Text style={styles.photoButtonText}>Choose</Text>
          </Pressable>
        </View>
        {values.photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoList}>
            {values.photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.photoWrap}>
                <Image source={{ uri }} contentFit="cover" style={styles.photoPreview} accessibilityLabel={`Selected photo ${index + 1}`} />
                <Pressable
                  onPress={() => update("photos", values.photos.filter((_, photoIndex) => photoIndex !== index))}
                  style={styles.removePhoto}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                >
                  <Ionicons name="close" size={14} color={colors.text} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <Pressable onPress={handleSave} disabled={saving} style={[styles.submitButton, saving && styles.disabled]} accessibilityRole="button">
        <Text style={styles.submitText}>{saving ? "Saving..." : submitLabel}</Text>
        {!saving ? <Ionicons name="arrow-forward" size={18} color={colors.background} /> : null}
      </Pressable>
    </ScrollView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "decimal-pad" | "numbers-and-punctuation";
  multiline?: boolean;
  prefix?: string;
};

function Field({ label, value, onChangeText, placeholder, keyboardType = "default", multiline, prefix }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.multilineWrap]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.controls.input.placeholderColor}
          keyboardType={keyboardType}
          multiline={multiline}
          style={[styles.input, multiline && styles.multilineInput, prefix ? styles.prefixedInput : null]}
          autoCapitalize={keyboardType === "decimal-pad" || keyboardType === "numbers-and-punctuation" ? "none" : "sentences"}
        />
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
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.md,
  },
  heading: {
    flex: 1,
    color: colors.text,
    fontSize: 25,
    fontWeight: "700",
  },
  sectionLabel: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    backgroundColor: theme.controls.input.backgroundColor,
    borderWidth: 1,
    borderColor: theme.controls.input.borderColor,
    borderRadius: theme.controls.input.borderRadius,
  },
  multilineWrap: {
    alignItems: "flex-start",
  },
  prefix: {
    color: colors.secondary,
    fontSize: 15,
    paddingLeft: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 46,
    color: theme.controls.input.textColor,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  prefixedInput: {
    paddingLeft: spacing.xs,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  photoSection: {
    marginBottom: spacing.md,
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  photoCount: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  photoButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photoButtonText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
  photoList: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  photoWrap: {
    width: 92,
    height: 92,
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  removePhoto: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(5, 5, 5, 0.82)",
  },
  submitButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: theme.controls.button.backgroundColor,
    borderRadius: theme.controls.button.borderRadius,
    marginTop: spacing.md,
  },
  disabled: {
    opacity: 0.6,
  },
  submitText: {
    color: theme.controls.button.textColor,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
