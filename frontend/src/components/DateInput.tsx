import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatCalendarDate, parseCalendarDate } from "../lib/calendarDate";
import { showAlert } from "../lib/showAlert";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { theme } from "../theme/theme";

type DateInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function DateInput({ label, value, onChange }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseCalendarDate(value) ?? new Date());
  const parsed = parseCalendarDate(value);
  const displayValue = parsed
    ? new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(parsed)
    : value || "Select a date";

  const openPicker = () => {
    setDraft(parseCalendarDate(value) ?? new Date());
    setOpen(true);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openPicker} style={styles.input} accessibilityRole="button" accessibilityLabel={`${label.replace(" *", " (required)")}, ${displayValue}`} accessibilityHint="Choose a date">
        <Text style={styles.value}>{displayValue}</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.secondary} />
      </Pressable>
      {open && Platform.OS === "android" ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="calendar"
          onValueChange={(_event, date) => { setOpen(false); onChange(formatCalendarDate(date)); }}
          onDismiss={() => setOpen(false)}
          onError={() => { setOpen(false); showAlert("Could not open calendar", "Please try again."); }}
        />
      ) : null}
      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <SafeAreaView style={styles.overlay}>
            <View style={styles.sheet} accessibilityViewIsModal>
              <View style={styles.toolbar}>
                <Pressable onPress={() => setOpen(false)} style={styles.action} accessibilityRole="button" accessibilityLabel="Cancel date selection">
                  <Text style={styles.actionText}>Cancel</Text>
                </Pressable>
                <Text style={styles.title}>Choose date</Text>
                <Pressable onPress={() => { onChange(formatCalendarDate(draft)); setOpen(false); }} style={styles.action} accessibilityRole="button" accessibilityLabel="Confirm date selection">
                  <Text style={styles.actionText}>Done</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.picker}>
                <DateTimePicker value={draft} mode="date" display="inline" themeVariant="dark" accentColor={colors.primary} onValueChange={(_event, date) => setDraft(date)} />
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: spacing.xs },
  input: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: theme.controls.input.backgroundColor, borderWidth: 1, borderColor: theme.controls.input.borderColor, borderRadius: theme.controls.input.borderRadius },
  value: { flex: 1, color: theme.controls.input.textColor, fontSize: 14 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.65)" },
  sheet: { maxHeight: "90%", backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border },
  toolbar: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  action: { minWidth: 64, minHeight: 44, alignItems: "center", justifyContent: "center" },
  actionText: { color: colors.secondary, fontSize: 14, fontWeight: "700" },
  picker: { alignItems: "center", padding: spacing.md },
});