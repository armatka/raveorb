import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entry detail</Text>
      <Text style={styles.subtitle}>Entry ID: {id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: spacing.sm,
  },
});
