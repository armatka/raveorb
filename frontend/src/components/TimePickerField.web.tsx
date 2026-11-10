import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { displayClockTime, formatClockTime, parseClockTime } from "../lib/clockTime";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { theme } from "../theme/theme";
import type { TimePickerFieldProps } from "./TimePickerField";

export function TimePickerField({ label, value, onChange }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseClockTime(value) ?? new Date());
  const displayValue = displayClockTime(value) || "Select a time";

  const openPicker = () => {
    setDraft(parseClockTime(value) ?? new Date());
    setOpen(true);
  };

  const setPart = (part: "hours" | "minutes", value: number) => {
    setDraft((current) => {
      const next = new Date(current);
      if (part === "hours") next.setHours(value);
      else next.setMinutes(value);
      return next;
    });
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openPicker} style={styles.input} accessibilityRole="button" accessibilityLabel={`${label.replace(" *", " (required)")}, ${displayValue}`} accessibilityHint="Choose a time">
        <Text style={styles.value}>{displayValue}</Text>
        <Ionicons name="time-outline" size={20} color={colors.secondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.title}>Choose time</Text>
            <View style={styles.selectRow}>
              <select aria-label={`${label} hour`} value={draft.getHours()} onChange={(event) => setPart("hours", Number(event.currentTarget.value))} style={selectStyle}>
                {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{displayClockTime(`${String(hour).padStart(2, "0")}:00`)}</option>)}
              </select>
              <select aria-label={`${label} minute`} value={draft.getMinutes()} onChange={(event) => setPart("minutes", Number(event.currentTarget.value))} style={selectStyle}>
                {Array.from({ length: 60 }, (_, minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}
              </select>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => setOpen(false)} style={styles.action} accessibilityRole="button" accessibilityLabel={`Cancel ${label} selection`}><Text style={styles.actionText}>Cancel</Text></Pressable>
              <Pressable onPress={() => { onChange(formatClockTime(draft)); setOpen(false); }} style={styles.action} accessibilityRole="button" accessibilityLabel={`Confirm ${label} selection`}><Text style={styles.actionText}>Done</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const selectStyle = { flex: 1, minWidth: 0, minHeight: 48, padding: `0 ${spacing.md}px`, color: colors.text, backgroundColor: colors.surfaceAlt, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 14, colorScheme: "dark" } as const;

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: spacing.xs },
  input: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: theme.controls.input.backgroundColor, borderWidth: 1, borderColor: theme.controls.input.borderColor, borderRadius: theme.controls.input.borderRadius },
  value: { flex: 1, color: theme.controls.input.textColor, fontSize: 14 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: "rgba(0, 0, 0, 0.65)" },
  sheet: { width: "100%", maxWidth: 360, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.md },
  selectRow: { flexDirection: "row", gap: spacing.sm },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.md },
  action: { minWidth: 64, minHeight: 44, alignItems: "center", justifyContent: "center" },
  actionText: { color: colors.secondary, fontSize: 14, fontWeight: "700" },
});