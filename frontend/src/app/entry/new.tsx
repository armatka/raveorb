import { useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "../../components/Screen";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { theme } from "../../theme/theme";

const eventTypes = ["festival", "rave", "concert", "club"] as const;

type EventType = (typeof eventTypes)[number];

type FormState = {
  title: string;
  type: EventType;
  city: string;
  date: string;
  startTime: string;
  endTime: string;
  artists: string;
  spend: string;
  vibeScore: string;
  durationHours: string;
  notes: string;
};

const initialState: FormState = {
  title: "",
  type: "rave",
  city: "",
  date: "",
  startTime: "22:00",
  endTime: "03:00",
  artists: "",
  spend: "",
  vibeScore: "",
  durationHours: "",
  notes: "",
};

export default function NewEntryScreen() {
  const [form, setForm] = useState<FormState>(initialState);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.city.trim() || !form.date) {
      Alert.alert("Missing fields", "Title, city, and date are required.");
      return;
    }

    Alert.alert("Night saved", `${form.title} was added to your journal.`);
    router.back();
  };

  return (
    <Screen scrollable contentContainerStyle={styles.content}>
      <Text style={styles.title}>Log a new night</Text>

      <TextInput
        style={styles.input}
        value={form.title}
        onChangeText={(value) => updateField("title", value)}
        placeholder="Event title"
        placeholderTextColor={colors.muted}
      />

      <View style={styles.typeRow}>
        {eventTypes.map((type) => (
          <Pressable
            key={type}
            onPress={() => updateField("type", type)}
            style={[styles.typeButton, form.type === type && styles.typeButtonActive]}
          >
            <Text style={[styles.typeText, form.type === type && styles.typeTextActive]}>{type}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        value={form.city}
        onChangeText={(value) => updateField("city", value)}
        placeholder="City"
        placeholderTextColor={colors.muted}
      />

      <View style={styles.twoColumnRow}>
        <TextInput
          style={[styles.input, styles.halfInput]}
          value={form.date}
          onChangeText={(value) => updateField("date", value)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={[styles.input, styles.halfInput]}
          value={form.vibeScore}
          onChangeText={(value) => updateField("vibeScore", value)}
          placeholder="Vibe 0-100"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.twoColumnRow}>
        <TextInput
          style={[styles.input, styles.halfInput]}
          value={form.startTime}
          onChangeText={(value) => updateField("startTime", value)}
          placeholder="Start"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={[styles.input, styles.halfInput]}
          value={form.endTime}
          onChangeText={(value) => updateField("endTime", value)}
          placeholder="End"
          placeholderTextColor={colors.muted}
        />
      </View>

      <View style={styles.twoColumnRow}>
        <TextInput
          style={[styles.input, styles.halfInput]}
          value={form.spend}
          onChangeText={(value) => updateField("spend", value)}
          placeholder="Spend"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, styles.halfInput]}
          value={form.durationHours}
          onChangeText={(value) => updateField("durationHours", value)}
          placeholder="Hours"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />
      </View>

      <TextInput
        style={styles.input}
        value={form.artists}
        onChangeText={(value) => updateField("artists", value)}
        placeholder="Artists (comma separated)"
        placeholderTextColor={colors.muted}
      />

      <TextInput
        style={[styles.input, styles.notesInput]}
        value={form.notes}
        onChangeText={(value) => updateField("notes", value)}
        placeholder="Notes"
        placeholderTextColor={colors.muted}
        multiline
      />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save night</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: theme.controls.input.backgroundColor,
    color: theme.controls.input.textColor,
    borderRadius: theme.controls.input.borderRadius,
    borderWidth: 1,
    borderColor: theme.controls.input.borderColor,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  twoColumnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInput: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.md,
  },
  typeButton: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeButtonActive: {
    backgroundColor: theme.controls.selected.backgroundColor,
    borderColor: theme.controls.selected.borderColor,
  },
  typeText: {
    color: colors.textSecondary,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  typeTextActive: {
    color: theme.controls.selected.textColor,
  },
  notesInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: theme.controls.button.backgroundColor,
    borderRadius: theme.controls.button.borderRadius,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  saveButtonText: {
    color: theme.controls.button.textColor,
    fontWeight: "800",
    fontSize: 16,
  },
});
