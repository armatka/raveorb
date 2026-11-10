import { StyleSheet, Text, View } from "react-native";

import { parseCalendarDate } from "../lib/calendarDate";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { theme } from "../theme/theme";

type DateInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function DateInput({ label, value, onChange }: DateInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <input
        type="date"
        aria-label={label.replace(" *", " (required)")}
        value={parseCalendarDate(value) ? value : ""}
        onClick={(event) => {
          try { event.currentTarget.showPicker?.(); } catch { event.currentTarget.focus(); }
        }}
        onChange={(event) => { if (parseCalendarDate(event.currentTarget.value)) onChange(event.currentTarget.value); }}
        style={{ width: "100%", minHeight: 48, boxSizing: "border-box", padding: `0 ${spacing.md}px`, color: theme.controls.input.textColor, backgroundColor: theme.controls.input.backgroundColor, border: `1px solid ${theme.controls.input.borderColor}`, borderRadius: theme.controls.input.borderRadius, colorScheme: "dark", fontSize: 14 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: spacing.xs },
});