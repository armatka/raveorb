import { StyleSheet, Text, View } from "react-native";

import { EventListItem } from "../../components/EventListItem";
import { Screen } from "../../components/Screen";
import { mockEvents } from "../../data/mockData";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function EventsScreen() {
  return (
    <Screen edges={["top", "left", "right"]} scrollable style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Event journal</Text>

      <View style={styles.list}>
        {mockEvents.map((event) => (
          <EventListItem key={event.id} event={event} />
        ))}
      </View>
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
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.lg,
  },
  list: {},
});
