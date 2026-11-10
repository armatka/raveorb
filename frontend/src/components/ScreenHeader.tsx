import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export type ScreenHeaderAction = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type ScreenHeaderProps = {
  title?: string;
  onBack?: () => void;
  actions?: ScreenHeaderAction[];
};

export function ScreenHeader({ title, onBack, actions = [] }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeHeader, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
        ) : null}

        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : <View style={styles.spacer} />}

        {actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.button,
                  action.destructive && styles.destructiveButton,
                  pressed && (action.destructive ? styles.destructivePressed : styles.pressed),
                ]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Ionicons
                  name={action.icon}
                  size={19}
                  color={action.destructive ? colors.error : colors.secondary}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeHeader: {
    width: "100%",
    backgroundColor: colors.background,
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  button: {
    width: 48,
    height: 48,
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 21,
    fontWeight: "700",
    marginLeft: spacing.md,
  },
  spacer: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginLeft: spacing.md,
  },
  destructiveButton: {
    borderColor: "rgba(232, 120, 120, 0.3)",
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
    opacity: 0.78,
  },
  destructivePressed: {
    backgroundColor: "rgba(232, 120, 120, 0.16)",
    opacity: 0.78,
  },
});
