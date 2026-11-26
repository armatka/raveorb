import { router } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { homeContent } from "../../constants/homeContent";
import { spacing } from "../../theme/spacing";
import { HomePanel } from "./HomePanel";

export function HomePanelGrid({ alertCount = 0 }: { alertCount?: number }) {
  const { width, fontScale } = useWindowDimensions();
  const twoColumns = width / fontScale >= 340;

  return (
    <View style={[styles.grid, !twoColumns && styles.singleColumn]}>
      {homeContent.panels.map((panel) => {
        const badge = panel.key === "artist-alerts" && alertCount > 0 ? `${alertCount} new` : undefined;
        const onPress = panel.route ? () => router.push(panel.route) : undefined;
        return (
          <HomePanel
            key={panel.key}
            title={panel.title}
            subtitle={panel.subtitle}
            icon={panel.icon}
            accent={panel.accent}
            onPress={onPress}
            testID={panel.testID}
            singleColumn={!twoColumns}
            comingSoon={"comingSoon" in panel && panel.comingSoon}
            badge={badge}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: spacing.md,
  },
  singleColumn: { flexDirection: "column" },
});
