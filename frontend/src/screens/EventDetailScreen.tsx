import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import EventDetailHeader from "../components/EventDetailHeader";
import { mockEvents, mockVenues } from "../data/mockData";
import {
  eventStatusStorage,
  type EventStatus,
} from "../lib/eventStatusStorage";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

const statusOptions: Array<{
  value: EventStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    value: "interested",
    label: "Interested",
    icon: "heart-outline",
  },
  {
    value: "going",
    label: "Going",
    icon: "calendar-outline",
  },
  {
    value: "attended",
    label: "Attended",
    icon: "checkmark-circle-outline",
  },
];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [status, setStatus] = useState<EventStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const event = mockEvents.find((item) => item.id === id);
  const venue = event
    ? mockVenues.find((item) => item.id === event.venueId)
    : undefined;

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;

      if (!id) {
        setLoadingStatus(false);
        return () => {
          isCurrent = false;
        };
      }

      setLoadingStatus(true);

      eventStatusStorage
        .get(id)
        .then((savedStatus) => {
          if (isCurrent) {
            setStatus(savedStatus);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setStatus(null);
          }
        })
        .finally(() => {
          if (isCurrent) {
            setLoadingStatus(false);
          }
        });

      return () => {
        isCurrent = false;
      };
    }, [id]),
  );

  if (!event) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <Ionicons
            name="alert-circle-outline"
            size={42}
            color={colors.error}
          />
          <Text style={styles.notFoundTitle}>Event not found</Text>
          <Text style={styles.notFoundText}>
            This event may no longer be available.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const venueName = venue?.name ?? "Venue to be announced";
  const location = `${venueName} · ${event.city}`;
  const formattedDate = `${event.date} · ${event.startTime}`;

  const selectStatus = async (nextStatus: EventStatus) => {
    try {
      await eventStatusStorage.set(event.id, nextStatus);
      setStatus(nextStatus);

      if (nextStatus === "attended") {
        Alert.alert(
          "Add this experience to My Nights?",
          "RaveOrb can prefill your journal entry with the event details.",
          [
            {
              text: "Not now",
              style: "cancel",
            },
            {
              text: "Add to My Nights",
              onPress: openNightForm,
            },
          ],
        );
      }
    } catch {
      Alert.alert(
        "Could not update event",
        "Your selection was not saved. Please try again.",
      );
    }
  };

  const openNightForm = () => {
    router.push({
      pathname: "/night/new",
      params: {
        eventName: event.title,
        date: event.date,
        venueName,
        city: event.city,
        artists: event.artists.join("|"),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <EventDetailHeader
          title={event.title}
          date={formattedDate}
          location={location}
          type={event.type}
        />

        <View style={styles.statusPanel}>
          <Text style={styles.sectionTitle}>Your plan</Text>
          <Text style={styles.statusDescription}>
            Save this event to your RaveOrb journey.
          </Text>

          {loadingStatus ? (
            <ActivityIndicator
              color={colors.primary}
              style={styles.statusLoader}
            />
          ) : (
            <View style={styles.statusRow}>
              {statusOptions.map((option) => {
                const selected = status === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => selectStatus(option.value)}
                    style={[
                      styles.statusButton,
                      selected && styles.statusButtonSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={selected ? colors.background : colors.secondary}
                    />
                    <Text
                      style={[
                        styles.statusButtonText,
                        selected && styles.statusButtonTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {status === "attended" ? (
            <Pressable style={styles.primaryButton} onPress={openNightForm}>
              <Ionicons
                name="book-outline"
                size={19}
                color={colors.background}
              />
              <Text style={styles.primaryButtonText}>Add to My Nights</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Vibe</Text>
              <Text style={styles.statValue}>{event.vibeScore}/100</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Spend</Text>
              <Text style={styles.statValue}>${event.spend}</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{event.durationHours}h</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Artist lineup</Text>
          <View style={styles.tagRow}>
            {event.artists.map((artist) => (
              <View key={artist} style={styles.tag}>
                <Text style={styles.tagText}>{artist}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Event notes</Text>
          <Text style={styles.notes}>{event.notes}</Text>

          <View style={styles.detailRow}>
            <Ionicons
              name="location-outline"
              size={18}
              color={colors.secondary}
            />
            <Text style={styles.detailText}>{location}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.secondary}
            />
            <Text style={styles.detailText}>
              {event.startTime} to {event.endTime}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  statusPanel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  statusLoader: {
    marginVertical: spacing.lg,
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statusButton: {
    flex: 1,
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  statusButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusButtonText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  statusButtonTextSelected: {
    color: colors.background,
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  secondaryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  notes: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  detailText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  notFoundTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginTop: spacing.md,
  },
  notFoundText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.sm,
  },
});
