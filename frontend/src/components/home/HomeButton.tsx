import { Pressable, StyleSheet, Text } from "react-native";
import { spacing } from "../../theme/spacing";
import { theme } from "../../theme/theme";

export function HomeButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed]}>
      <Text style={[styles.text, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, justifyContent: "center", alignItems: "center", borderRadius: theme.controls.button.borderRadius, backgroundColor: theme.controls.button.backgroundColor },
  secondary: { backgroundColor: theme.colors.surface, borderColor: theme.colors.secondary, borderWidth: 1 },
  text: { color: theme.controls.button.textColor, fontSize: 16, fontWeight: "700", textAlign: "center" },
  secondaryText: { color: theme.colors.text },
  pressed: { opacity: theme.pressed.opacity, transform: [{ scale: theme.pressed.scale }] },
});
