import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { openArtist } from "../components/ArtistLinks";
import { FollowButton } from "../components/FollowButton";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { getFollowSuggestions, type FollowedArtist, type FollowSuggestion } from "../lib/artistMatching";
import { formatEventDate } from "../lib/eventFormatting";
import { followedArtistsStorage } from "../lib/followedArtistsStorage";
import { goBackOrReplace } from "../lib/navigation";
import { nightsStorage } from "../lib/nightsStorage";
import { showAlert } from "../lib/showAlert";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export default function FollowingScreen() {
  const [artists, setArtists] = useState<FollowedArtist[]>([]);
  const [suggestions, setSuggestions] = useState<FollowSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    const [followed, nights] = await Promise.allSettled([followedArtistsStorage.list(), nightsStorage.list()]);
    if (followed.status === "rejected") throw new Error("Followed artists could not be loaded.");
    setArtists([...followed.value].reverse());
    setSuggestions(nights.status === "fulfilled" ? getFollowSuggestions(nights.value, new Set(followed.value.map((artist) => artist.normalizedName))) : []);
    setError(nights.status === "rejected" ? "Suggestions are unavailable because your Nights could not be loaded." : "");
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    load().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load artists."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, retry]));

  const change = async (action: () => Promise<void>) => {
    try {
      await action();
      await load();
    } catch {
      showAlert("Could not update artist", "Your followed artists were not changed. Please try again.");
    }
  };

  return (
    <Screen edges={["left", "right", "bottom"]} scrollable contentContainerStyle={styles.content}>
      <ScreenHeader title="Following" onBack={() => goBackOrReplace("/my-raveorb")} />
      {error ? (
        <View style={styles.message}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => setRetry((value) => value + 1)} accessibilityRole="button"><Text style={styles.link}>Try again</Text></Pressable>
        </View>
      ) : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : (
        <>
          <Text style={styles.section}>ARTISTS YOU FOLLOW</Text>
          {artists.length ? artists.map((artist) => (
            <View key={artist.normalizedName} style={styles.row}>
              <Pressable style={styles.rowText} onPress={() => openArtist(artist.name)} accessibilityRole="link" accessibilityLabel={`View artist ${artist.name}`}>
                <Text style={styles.name}>{artist.name}</Text>
                <Text style={styles.meta}>Since {formatEventDate(artist.followedAt.slice(0, 10))}</Text>
              </Pressable>
              <Pressable onPress={() => { void change(() => followedArtistsStorage.unfollow(artist.name)); }} style={styles.unfollow} accessibilityRole="button" accessibilityLabel={`Unfollow ${artist.name}`}>
                <Text style={styles.link}>Unfollow</Text>
              </Pressable>
            </View>
          )) : <Text style={styles.meta}>Follow artists from their page or an event lineup to hear when they play near you.</Text>}

          <Text style={styles.section}>ARTISTS YOU MIGHT FOLLOW</Text>
          {suggestions.length ? suggestions.map((suggestion) => (
            <View key={suggestion.normalizedName} style={styles.row}>
              <Pressable style={styles.rowText} onPress={() => openArtist(suggestion.name)} accessibilityRole="link" accessibilityLabel={`View artist ${suggestion.name}`}>
                <Text style={styles.name}>{suggestion.name}</Text>
                <Text style={styles.meta}>{suggestion.reason}</Text>
              </Pressable>
              <FollowButton name={suggestion.name} following={false} onPress={() => { void change(() => followedArtistsStorage.follow(suggestion.name, "suggested")); }} />
            </View>
          )) : <Text style={styles.meta}>Suggestions appear for artists you have seen at two or more Nights, or at a Night you rated 4 or higher.</Text>}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  loader: { marginTop: spacing.xxl },
  section: { color: colors.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, minWidth: 0, paddingVertical: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  meta: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  unfollow: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  link: { color: colors.secondary, fontWeight: "700" },
  message: { gap: spacing.xs, marginTop: spacing.md },
  error: { color: colors.error },
});
