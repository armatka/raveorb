import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { artistId } from "../lib/artistResolver";
import { lineupArtistNames } from "../lib/artistMatching";
import { FollowButton } from "./FollowButton";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export function openArtist(name: string) {
  const id = artistId(name);
  if (id) router.push({ pathname: "/artist/[id]", params: { id } });
}

type FollowProps = { followedKeys: ReadonlySet<string>; onToggleFollow: (name: string) => void };

export function ArtistLinks({ names, compact = false, follow }: { names: string[]; compact?: boolean; follow?: FollowProps }) {
  if (follow) {
    // Split "A b2b B" entries so each artist gets its own link and Follow button.
    return (
      <View style={styles.row}>
        {lineupArtistNames(names).map(({ name, key }) => (
          <View key={key} style={styles.followItem}>
            <Pressable onPress={() => openArtist(name)} style={[styles.link, compact && styles.compact]} accessibilityRole="link" accessibilityLabel={`View artist ${name}`}>
              <Text style={styles.text}>{name}</Text>
            </Pressable>
            <FollowButton name={name} compact following={follow.followedKeys.has(key)} onPress={() => follow.onToggleFollow(name)} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {names.filter((name) => artistId(name)).map((name, index) => (
        <Pressable key={`${name}-${index}`} onPress={() => openArtist(name)} style={[styles.link, compact && styles.compact]} accessibilityRole="link" accessibilityLabel={`View artist ${name}`}>
          <Text style={styles.text}>{name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1, borderRadius: 8, maxWidth: "100%" },
  compact: { backgroundColor: "transparent" },
  followItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs, maxWidth: "100%" },
  text: { color: colors.secondary, fontSize: 12, fontWeight: "600" },
});