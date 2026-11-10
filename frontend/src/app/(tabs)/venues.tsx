import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../components/Screen";
import { mockVenues } from "../../data/mockData";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function VenuesScreen() {
  return (
    <Screen edges={["top", "left", "right"]} scrollable style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Favorite venues</Text>

      {mockVenues.map((venue) => (
        <View key={venue.id} style={styles.card}>
          <Text style={styles.name}>{venue.name}</Text>
          <Text style={styles.meta}>{venue.city}</Text>
          <Text style={styles.meta}>{venue.type}</Text>
          <Text style={styles.meta}>{venue.visits} visits</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 2,
  },
});
