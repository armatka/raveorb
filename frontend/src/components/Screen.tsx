import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
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
  keyboardShouldPersistTaps = "handled",
}: ScreenProps) {
  if (!scrollable) {
    return (
      <SafeAreaView edges={edges} style={[styles.root, style]}>
        {children}
      </SafeAreaView>
    );
  }

  // iOS: automaticallyAdjustKeyboardInsets pads the scroll content by the
  // keyboard overlap (safe-area aware) and keeps the focused field visible.
  // Android: the app is edge-to-edge, so the window no longer resizes for the
  // keyboard; a padding KeyboardAvoidingView shrinks the scroll area instead.
  // Headers are rendered inside the scroll content (native header is hidden),
  // so no extra keyboardVerticalOffset is needed.
  const scroll = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
    >
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.root, style]}>
      {Platform.OS === "android" ? (
        <KeyboardAvoidingView behavior="padding" style={styles.scroll}>
          {scroll}
        </KeyboardAvoidingView>
      ) : scroll}
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
