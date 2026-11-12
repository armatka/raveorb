import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../components/EmptyState";
import { ArtistLinks } from "../components/ArtistLinks";
import { FriendLinks } from "../components/FriendLinks";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { nightsStorage } from "../lib/nightsStorage";
import { formatCurrency } from "../lib/formatCurrency";
import { goBackOrReplace } from "../lib/navigation";
import { showAlert } from "../lib/showAlert";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import type { Night } from "../types/Night";

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
}

export default function NightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [night, setNight] = useState<Night | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      setLoading(true);
      setError(false);
      nightsStorage.get(id)
        .then((item) => {
          if (isCurrent) setNight(item);
        })
        .catch(() => {
          if (isCurrent) setError(true);
        })
        .finally(() => {
          if (isCurrent) setLoading(false);
        });
      return () => { isCurrent = false; };
    }, [id, retryToken]),
  );

  const confirmDelete = () => {
    const deleteNight = () => {
      nightsStorage.remove(id)
        .then(() => router.replace("/(tabs)/nights"))
        .catch(() => showAlert("Could not delete", "Please try again."));
    };
    if (Platform.OS === "web") {
      if (globalThis.confirm("Delete this night? This journal entry will be permanently removed from this device.")) deleteNight();
      return;
    }
    Alert.alert("Delete this night?", "This journal entry will be permanently removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: deleteNight,
      },
    ]);
  };

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }
  if (error || !night) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ScreenHeader onBack={() => goBackOrReplace("/(tabs)/nights")} />
        <EmptyState title={error ? "Journal unavailable" : "Night not found"} message={error ? "This entry could not be loaded. Try again." : "This entry may have been deleted."} icon="alert-circle-outline" action={error ? <Pressable onPress={() => setRetryToken((token) => token + 1)} style={styles.retryButton} accessibilityRole="button" accessibilityLabel="Retry loading night"><Text style={styles.retryText}>Retry</Text></Pressable> : undefined} />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader
        onBack={() => goBackOrReplace("/(tabs)/nights")}
        actions={[
          { icon: "pencil-outline", label: "Edit", onPress: () => router.push({ pathname: "/night/[id]/edit", params: { id } }) },
          { icon: "trash-outline", label: "Delete", onPress: confirmDelete, destructive: true },
        ]}
      />

      <View style={styles.hero}>
        <Text style={styles.date}>{formatDate(night.date)}</Text>
        <Text style={styles.title}>{night.eventName}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={15} color={colors.secondary} />
          <Text style={styles.location}>{night.venueName} · {night.city}</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>RATING</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={15} color={colors.primary} />
            <Text style={styles.summaryValue}>{night.rating ? `${night.rating}/5` : "—"}</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>COST</Text>
          <Text style={styles.summaryValue}>{formatCurrency(night.cost, night.currency)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PHOTOS</Text>
          <Text style={styles.summaryValue}>{night.photos.length}</Text>
        </View>
      </View>

      {night.artistsSeen.length > 0 ? <View style={styles.section}><Text style={styles.sectionLabel}>ARTISTS</Text><ArtistLinks names={night.artistsSeen} /></View> : null}
      {night.friends.length > 0 ? <View style={styles.section}><Text style={styles.sectionLabel}>WITH</Text><FriendLinks names={night.friends} /></View> : null}
      {night.favoriteMoment ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FAVORITE MOMENT</Text>
          <Text style={styles.favoriteMoment}>{night.favoriteMoment}</Text>
        </View>
      ) : null}
      {night.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTES</Text>
          <Text style={styles.bodyText}>{night.notes}</Text>
        </View>
      ) : null}
      {night.photos.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PHOTOS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {night.photos.map((uri, index) => (
              <Image key={`${uri}-${index}`} source={{ uri }} contentFit="contain" style={styles.photo} accessibilityLabel={`Night photo ${index + 1}`} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <Text style={styles.updated}>Updated {new Date(night.updatedAt).toLocaleDateString()}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  retryButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: 8, backgroundColor: colors.primary },
  retryText: { color: colors.background, fontWeight: "700" },
  content: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  hero: {
    marginBottom: spacing.xl,
  },
  date: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 39,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  location: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  summaryDivider: {
    height: 34,
    width: 1,
    backgroundColor: colors.border,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: spacing.md,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tagText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  favoriteMoment: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "500",
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
  photoRow: {
    gap: spacing.sm,
  },
  photo: {
    width: 220,
    height: 160,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  updated: {
    color: colors.muted,
    fontSize: 11,
    marginTop: spacing.sm,
  },
});
