import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { calendarLinkStorage } from "../lib/calendarLinkStorage";
import { eventStatusStorage } from "../lib/eventStatusStorage";
import { goBackOrReplace } from "../lib/navigation";
import { showAlert } from "../lib/showAlert";
import { calendarService } from "../services/calendarService";
import { canUpdateCalendar, listTrackedEventChanges, refreshTrackedEvents, updateCalendarForChange, type TrackedEventChanges } from "../services/eventChangesService";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export default function EventChangesScreen() {
  const [items, setItems] = useState<TrackedEventChanges[]>([]);
  const [calendarLinks, setCalendarLinks] = useState<Record<string, string>>({});
  const [updatingCalendar, setUpdatingCalendar] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError("");
    refreshTrackedEvents().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not refresh saved events.");
    }).then(() => Promise.all([listTrackedEventChanges(), calendarLinkStorage.list().catch(() => ({}))])).then(([result, links]) => {
      if (active) {
        setItems(result);
        setCalendarLinks(links);
      }
    }).catch(() => {
      if (active) setError("Could not load saved events.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]));

  return (
    <Screen edges={["top", "left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader title="Your events" onBack={() => goBackOrReplace("/(tabs)")} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : items.length ? items.map(({ id, entry, changes }) => (
        <View key={id} style={styles.card}>
          <Pressable onPress={() => router.push({ pathname: "/event/[id]", params: { id } })} accessibilityRole="button">
            <Text style={styles.title}>{entry.latest?.title ?? entry.snapshot?.title}</Text>
            <Text style={styles.detail}>{entry.status === "going" ? "Going" : "Interested"} · {entry.latest?.date ?? entry.snapshot?.date}</Text>
          </Pressable>
          {changes.map((change) => (
            <View key={change.kind} style={styles.row}>
              <Text style={styles.change}>{change.label}</Text>
              {calendarService.isAvailable() && canUpdateCalendar(change.kind) && calendarLinks[id] ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Update calendar for ${change.label}`}
                  disabled={updatingCalendar === `${id}:${change.kind}`}
                  onPress={() => {
                    setUpdatingCalendar(`${id}:${change.kind}`);
                    void updateCalendarForChange(id, change.kind).then(() => {
                      showAlert("Calendar updated", change.kind === "cancelled"
                        ? "The calendar event is now marked CANCELLED."
                        : "The calendar event was moved to the new time.");
                    }).catch((cause: unknown) => {
                      setError(cause instanceof Error ? cause.message : "Could not update your calendar.");
                      void calendarLinkStorage.list().then(setCalendarLinks).catch(() => {});
                    }).finally(() => setUpdatingCalendar(""));
                  }}
                ><Text style={styles.dismiss}>Update calendar</Text></Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${change.label}`} onPress={() => {
                void eventStatusStorage.dismiss(id, change.kind).then(() => listTrackedEventChanges())
                  .then(setItems).catch(() => setError("Could not dismiss this change."));
              }}><Text style={styles.dismiss}>Dismiss</Text></Pressable>
            </View>
          ))}
        </View>
      )) : <Text style={styles.detail}>No upcoming saved events.</Text>}
      {error ? <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)}><Text style={styles.dismiss}>Retry</Text></Pressable> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  detail: { color: colors.textSecondary, marginTop: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  change: { color: colors.warning, flex: 1 },
  dismiss: { color: colors.secondary, fontWeight: "700", padding: spacing.sm },
  error: { color: colors.error, marginBottom: spacing.md },
});
