import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../components/EmptyState";
import { nightsStorage } from "../lib/nightsStorage";
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
    }, [id]),
  );

  const confirmDelete = () => {
    Alert.alert("Delete this night?", "This journal entry will be permanently removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          nightsStorage.remove(id)
            .then(() => router.replace("/(tabs)/nights"))
            .catch(() => Alert.alert("Could not delete", "Please try again."));
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (error || !night) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <EmptyState title={error ? "Journal unavailable" : "Night not found"} message={error ? "This entry could not be loaded. Try again." : "This entry may have been deleted."} icon="alert-circle-outline" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.actions}>
          <Pressable onPress={() => router.push({ pathname: "/night/[id]/edit", params: { id } })} accessibilityRole="button" accessibilityLabel="Edit night" style={styles.iconButton}>
            <Ionicons name="create-outline" size={19} color={colors.text} />
          </Pressable>
          <Pressable onPress={confirmDelete} accessibilityRole="button" accessibilityLabel="Delete night" style={[styles.iconButton, styles.deleteButton]}>
            <Ionicons name="trash-outline" size={19} color={colors.error} />
          </Pressable>
        </View>
      </View>

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
          <Text style={styles.summaryValue}>{new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(night.cost)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PHOTOS</Text>
          <Text style={styles.summaryValue}>{night.photos.length}</Text>
        </View>
      </View>

      {night.artistsSeen.length > 0 ? <DetailSection title="Artists" values={night.artistsSeen} /> : null}
      {night.friends.length > 0 ? <DetailSection title="With" values={night.friends} /> : null}
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
    </ScrollView>
  );
}

type DetailSectionProps = {
  title: string;
  values: string[];
};

function DetailSection({ title, values }: DetailSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
      <View style={styles.tagRow}>
        {values.map((value) => (
          <View key={value} style={styles.tag}>
            <Text style={styles.tagText}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  deleteButton: {
    borderColor: "rgba(232, 120, 120, 0.3)",
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
