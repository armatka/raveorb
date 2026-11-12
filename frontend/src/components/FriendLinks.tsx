import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { normalizeFriendName } from "../lib/friendHistory";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export function openFriend(name: string) {
  if (normalizeFriendName(name)) router.push({ pathname: "/friend/[name]", params: { name: name.trim() } });
}

export function FriendLinks({ names, compact = false }: { names: string[]; compact?: boolean }) {
  const seen = new Set<string>();
  const unique = names.filter((name) => {
    const key = normalizeFriendName(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <View style={styles.row}>
      {unique.map((name) => (
        <Pressable key={normalizeFriendName(name)} onPress={() => openFriend(name)} style={[styles.link, compact && styles.compact]} accessibilityRole="link" accessibilityLabel={`View shared history with ${name.trim()}`}>
          <Text style={styles.text}>{name.trim()}</Text>
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