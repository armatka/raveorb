import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { homeContent } from "../../constants/homeContent";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { theme } from "../../theme/theme";

type Pillar = (typeof homeContent.pillars)[number];

export function PillarCard({ pillar, wide }: { pillar: Pillar; wide: boolean }) {
  const content = (
    <>
      <Ionicons name={pillar.icon} size={26} color={colors.secondary} />
      <Text style={styles.title}>{pillar.title}</Text>
      <Text style={styles.body}>{pillar.body}</Text>
      {!pillar.route ? <Text style={styles.comingSoon}>{homeContent.comingSoon}</Text> : null}
    </>
  );
  const cardStyle = [styles.card, wide && styles.wide];
  if (!pillar.route) return <View style={cardStyle}>{content}</View>;
  const route = pillar.route;
  return <Pressable style={cardStyle} accessibilityRole="button" accessibilityLabel={pillar.title} onPress={() => router.push(route)}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: theme.borderRadius.md },
  wide: { flexBasis: "48%", flexGrow: 1 },
  title: { color: colors.text, fontSize: 19, fontWeight: "700" },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  comingSoon: { color: colors.secondary, fontSize: 14, fontWeight: "600" },
});
