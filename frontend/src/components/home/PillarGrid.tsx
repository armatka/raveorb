import { StyleSheet, useWindowDimensions, View } from "react-native";
import { homeContent } from "../../constants/homeContent";
import { spacing } from "../../theme/spacing";
import { PillarCard } from "./PillarCard";

export function PillarGrid() {
  const { width, fontScale } = useWindowDimensions();
  const wide = width / fontScale >= 600;
  return (
    <View style={[styles.grid, wide && styles.wide]}>
      {homeContent.pillars.map((pillar) => <PillarCard key={pillar.key} pillar={pillar} wide={wide} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md },
  wide: { flexDirection: "row", flexWrap: "wrap" },
});
