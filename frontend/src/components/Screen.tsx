import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors } from "../theme/colors";

type ScreenProps = {
  children: ReactNode;
  edges?: Edge[];
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
};

export function Screen({
  children,
  edges = ["top", "bottom"],
  scrollable = false,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  keyboardShouldPersistTaps,
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.root, style]}>
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
        >
          {children}
        </ScrollView>
      ) : children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
});
