import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import EventDetailHeader from "../components/EventDetailHeader";
import { EmptyState } from "../components/EmptyState";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { eventStatusStorage, type EventStatus } from "../lib/eventStatusStorage";
import { formatEventDate, formatEventPrice, formatEventSchedule } from "../lib/eventFormatting";
import { nightsStorage } from "../lib/nightsStorage";
import { goBackOrReplace } from "../lib/navigation";
import { showAlert } from "../lib/showAlert";
import { eventsRepository } from "../services/eventsRepository";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { EventEntry } from "../types/event";

const statusOptions: Array<{
  value: EventStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: "interested", label: "Interested", icon: "heart-outline" },
  { value: "going", label: "Going", icon: "calendar-outline" },
  { value: "attended", label: "Attended", icon: "checkmark-circle-outline" },
];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventEntry | null>(null);
  const [status, setStatus] = useState<EventStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [linkedNightId, setLinkedNightId] = useState<string | null>(null);
  const [loadingNight, setLoadingNight] = useState(true);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [nightError, setNightError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;

      if (!id) {
        setEvent(null);
        setEventError(null);
        setLoadingEvent(false);
        setStatus(null);
        setLinkedNightId(null);
        setLoadingStatus(false);
        setLoadingNight(false);
        setStatusError(false);
        setNightError(false);
        return () => {
          isCurrent = false;
        };
      }

      setLoadingEvent(true);
      setEventError(null);
      setLoadingStatus(true);
      setLoadingNight(true);

      Promise.allSettled([
        eventsRepository.getEvent(id),
        eventStatusStorage.get(id),
        nightsStorage.getBySourceEventId(id),
      ]).then(([eventResult, statusResult, linkedNightResult]) => {
        if (!isCurrent) return;

        if (eventResult.status === "fulfilled") {
          setEvent(eventResult.value);
          setEventError(null);
        } else {
          setEvent(null);
          setEventError(eventResult.reason instanceof Error ? eventResult.reason.message : "Could not load this event.");
        }
        setStatus(statusResult.status === "fulfilled" ? statusResult.value : null);
        setLinkedNightId(linkedNightResult.status === "fulfilled" ? linkedNightResult.value?.id ?? null : null);
        setStatusError(statusResult.status === "rejected");
        setNightError(linkedNightResult.status === "rejected");
      }).finally(() => {
        if (isCurrent) {
          setLoadingEvent(false);
          setLoadingStatus(false);
          setLoadingNight(false);
        }
      });

      return () => {
        isCurrent = false;
      };
    }, [id, retryToken]),
  );

  const retryLoading = () => setRetryToken((token) => token + 1);

  if (loadingEvent) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ScreenHeader onBack={() => goBackOrReplace("/(tabs)/events")} />
        <ActivityIndicator color={colors.primary} style={styles.statusLoader} />
      </Screen>
    );
  }

  if (eventError) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ScreenHeader onBack={() => goBackOrReplace("/(tabs)/events")} />
        <EmptyState
          title="Discovery unavailable"
          message={eventError}
          icon="cloud-offline-outline"
          action={(
            <Pressable onPress={retryLoading} style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="Retry loading event">
              <Text style={styles.secondaryButtonText}>Retry</Text>
            </Pressable>
          )}
        />
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ScreenHeader onBack={() => goBackOrReplace("/(tabs)/events")} />
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.error} />
          <Text style={styles.notFoundTitle}>Event not found</Text>
          <Text style={styles.notFoundText}>This event may no longer be available.</Text>
          <Pressable style={styles.secondaryButton} onPress={() => goBackOrReplace("/(tabs)/events")} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const venueName = event.venueName || "Venue to be announced";
  const location = `${venueName} · ${event.city}, ${event.countryCode}`;
  const formattedDate = formatEventSchedule(event);

  const openNightForm = () => {
    router.push({
      pathname: "/night/new",
      params: {
        sourceEventId: event.id,
        eventName: event.title,
        date: event.date,
        venueName,
        city: event.city,
        artists: event.artists.join("|"),
      },
    });
  };

  const openLinkedNight = () => {
    if (linkedNightId) {
      router.push({ pathname: "/night/[id]", params: { id: linkedNightId } });
    } else {
      openNightForm();
    }
  };

  const selectStatus = async (nextStatus: EventStatus) => {
    const updatedStatus = status === nextStatus ? null : nextStatus;
    try {
      await eventStatusStorage.set(event.id, updatedStatus);
      setStatus(updatedStatus);
    } catch {
      showAlert("Could not update event", "Your selection was not saved. Please try again.");
    }
  };

  return (
    <Screen edges={["left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader onBack={() => goBackOrReplace("/(tabs)/events")} />
      <EventDetailHeader title={event.title} date={formattedDate} location={location} type={event.type} />

      <View style={styles.statusPanel}>
        <Text style={styles.sectionTitle}>Your plan</Text>
        <Text style={styles.statusDescription}>Save this event to your RaveOrb journey.</Text>
        {loadingStatus ? (
          <ActivityIndicator color={colors.primary} style={styles.statusLoader} />
        ) : statusError ? (
          <Pressable onPress={retryLoading} style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="Retry loading event status">
            <Text style={styles.secondaryButtonText}>Event status unavailable. Retry</Text>
          </Pressable>
        ) : (
          <View style={styles.statusRow}>
            {statusOptions.map((option) => {
              const selected = status === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => selectStatus(option.value)}
                  style={({ pressed }) => [styles.statusButton, selected && styles.statusButtonSelected, pressed && styles.statusButtonPressed]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  accessibilityLabel={selected ? `Remove ${option.label} status` : `Mark event ${option.label}`}
                >
                  <Ionicons name={option.icon} size={20} color={selected ? colors.background : colors.secondary} />
                  <Text style={[styles.statusButtonText, selected && styles.statusButtonTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {status === "attended" ? (
          loadingNight ? (
            <ActivityIndicator color={colors.primary} style={styles.statusLoader} />
          ) : nightError ? (
            <Pressable onPress={retryLoading} style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="Retry loading linked night">
              <Text style={styles.secondaryButtonText}>Journal unavailable. Retry</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              onPress={openLinkedNight}
              accessibilityRole="button"
              accessibilityLabel={linkedNightId ? "View in My Nights" : "Add to My Nights"}
            >
              <Ionicons name={linkedNightId ? "book" : "book-outline"} size={19} color={colors.background} />
              <Text style={styles.primaryButtonText}>{linkedNightId ? "View in My Nights" : "Add to My Nights"}</Text>
            </Pressable>
          )
        ) : null}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>At a glance</Text>
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Date</Text>
            <Text style={styles.statValue}>{formatEventDate(event.date)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Tickets</Text>
            <Text style={styles.statValue}>{formatEventPrice(event)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Status</Text>
            <Text style={styles.statValue}>{(event.status ?? "scheduled").replace("-", " ")}</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Genres</Text>
        <View style={styles.tagRow}>
          {event.genres.map((genre) => (
            <View key={genre} style={styles.tag}>
              <Text style={styles.tagText}>{genre}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>About this event</Text>
        <Text style={styles.notes}>{event.description}</Text>
        <Text style={styles.sectionTitle}>Artist lineup</Text>
        <View style={styles.tagRow}>
          {event.artists.map((artist) => (
            <View key={artist} style={styles.tag}>
              <Text style={styles.tagText}>{artist}</Text>
            </View>
          ))}
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={18} color={colors.secondary} />
          <Text style={styles.detailText}>{location}</Text>
        </View>
        {event.address ? (
          <View style={styles.detailRow}>
            <Ionicons name="navigate-outline" size={18} color={colors.secondary} />
            <Text style={styles.detailText}>{event.address}</Text>
          </View>
        ) : null}
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color={colors.secondary} />
          <Text style={styles.detailText}>{event.startTime} to {event.endTime} {event.timezone}</Text>
        </View>
        {event.ageRestriction ? (
          <View style={styles.detailRow}>
            <Ionicons name="id-card-outline" size={18} color={colors.secondary} />
            <Text style={styles.detailText}>{event.ageRestriction}</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  statusButtonPressed: {
    opacity: 0.75,
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
  primaryButtonPressed: {
    opacity: 0.78,
  },
  secondaryButton: {
    minHeight: 44,
    justifyContent: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
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
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
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
    letterSpacing: 0.6,
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
