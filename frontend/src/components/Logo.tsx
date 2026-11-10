import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { theme } from "../theme/theme";

type LogoProps = {
  size?: number;
  background?: "dark" | "light";
  style?: StyleProp<ViewStyle>;
};

export default function Logo({ size = 220, background = "dark", style }: LogoProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const responsiveSize = Math.min(size, viewportWidth * 0.78, 320);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(pulse);
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.62 + pulse.value * 0.24,
    transform: [{ scale: 1 + pulse.value * 0.035 }],
  }));
  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.008 }],
  }));
  const glow = theme.glow[background];

  return (
    <View
      style={[
        styles.wrapper,
        { width: responsiveSize, height: responsiveSize, padding: responsiveSize * 0.025 },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.glow,
          {
            width: responsiveSize * 0.92,
            height: responsiveSize * 0.92,
            shadowColor: glow.shadow,
          },
          glowStyle,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={glow.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </Animated.View>

      <Animated.View style={[styles.imageFrame, imageStyle]}>
        <Image
          source={require("../../assets/images/RaveOrbLogo2.png")}
          style={styles.image}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessible
          accessibilityLabel="RaveOrb logo"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  glow: {
    position: "absolute",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  gradient: {
    flex: 1,
    borderRadius: 999,
  },
  imageFrame: {
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
