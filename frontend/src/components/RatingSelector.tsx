import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type RatingSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  label?: string;
};

export function RatingSelector({ value, onChange, label = "Your rating" }: RatingSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = rating <= value;
          return (
            <Pressable
              key={rating}
              onPress={() => onChange(rating === value ? 0 : rating)}
              accessibilityRole="radio"
              accessibilityState={{ checked: rating === value }}
              aria-checked={rating === value}
              accessibilityLabel={`${rating} out of 5`}
              style={styles.starButton}
            >
              <Ionicons name={selected ? "star" : "star-outline"} size={28} color={selected ? colors.primary : colors.titanium} />
            </Pressable>
          );
        })}
        <Text style={styles.value}>{value ? `${value}/5` : "Not rated"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  starButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    color: colors.muted,
    fontSize: 12,
    marginLeft: spacing.xs,
  },
});
