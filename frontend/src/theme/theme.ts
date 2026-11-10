import { colors } from "./colors";

export const theme = {
  colors,
  gradients: {
    background: [colors.background, colors.backgroundElevated] as const,
    gold: [colors.primary, colors.secondary] as const,
    goldHighlight: [colors.secondary, colors.accent] as const,
    surface: [colors.surface, colors.surfaceAlt] as const,
  },
  glow: {
    dark: {
      colors: ["rgba(212, 175, 55, 0.16)", "rgba(240, 195, 106, 0.08)", "rgba(240, 195, 106, 0)"] as const,
      shadow: colors.primary,
    },
    light: {
      colors: ["rgba(212, 175, 55, 0.09)", "rgba(240, 195, 106, 0.04)", "rgba(240, 195, 106, 0)"] as const,
      shadow: "#A88622",
    },
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  controls: {
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      textColor: colors.text,
      placeholderColor: colors.muted,
    },
    button: {
      backgroundColor: colors.primary,
      textColor: colors.background,
      borderRadius: 10,
    },
    selected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      textColor: colors.background,
    },
  },
  elevation: {
    subtle: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 3,
    },
  },
} as const;
