import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import type { FollowSource } from "../lib/artistMatching";
import { normalizeArtistName, splitLineupNames } from "../lib/artistResolver";
import { followedArtistsStorage } from "../lib/followedArtistsStorage";
import { showAlert } from "../lib/showAlert";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export function isFollowingName(name: string, keys: ReadonlySet<string>): boolean {
  const parts = splitLineupNames(name).map(normalizeArtistName);
  return parts.length > 0 && parts.every((key) => keys.has(key));
}

export function useFollowedArtists() {
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  const reload = useCallback(() => followedArtistsStorage.followedKeys().then((next) => { setKeys(next); setReady(true); }), []);

  useFocusEffect(useCallback(() => {
    let active = true;
    followedArtistsStorage.followedKeys().then((next) => { if (active) { setKeys(next); setReady(true); } })
      .catch(() => { if (active) setReady(false); });
    return () => { active = false; };
  }, []));

  const toggle = useCallback(async (name: string, source: FollowSource = "manual") => {
    try {
      if (isFollowingName(name, keys)) await followedArtistsStorage.unfollow(name);
      else await followedArtistsStorage.follow(name, source);
      await reload();
    } catch {
      showAlert("Could not update artist", "Your followed artists were not changed. Please try again.");
    }
  }, [keys, reload]);

  return { keys, ready, toggle, reload };
}

export function FollowButton({ name, following, onPress, compact = false }: { name: string; following: boolean; onPress: () => void; compact?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, following && styles.following, compact && styles.compact]}
      accessibilityRole="button"
      accessibilityState={{ selected: following }}
      accessibilityLabel={following ? `Unfollow ${name}` : `Follow ${name}`}
    >
      <Text style={[styles.text, following && styles.followingText]}>{following ? "Following" : "Follow"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 88, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primary },
  following: { backgroundColor: "transparent", borderColor: colors.secondary },
  compact: { minWidth: 0, paddingHorizontal: spacing.sm },
  text: { color: colors.background, fontSize: 12, fontWeight: "700" },
  followingText: { color: colors.secondary },
});
