import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { artistId } from "../lib/artistResolver";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export function openArtist(name: string) {
  const id = artistId(name);
  if (id) router.push({ pathname: "/artist/[id]", params: { id } });
}

export function ArtistLinks({ names, compact = false }: { names: string[]; compact?: boolean }) {
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
  text: { color: colors.secondary, fontSize: 12, fontWeight: "600" },
});