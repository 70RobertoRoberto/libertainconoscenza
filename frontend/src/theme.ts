// Design tokens for Conoscenza Aperta (dark, editorial, golden)
// Filled from /app/design_guidelines.json

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0A0F0D",
  onSurface: "#F0F0EA",
  surfaceSecondary: "#151E1A",
  onSurfaceSecondary: "#E0E0D5",
  surfaceTertiary: "#1B2621",
  onSurfaceTertiary: "#C5C5B5",
  surfaceInverse: "#F0F0EA",
  onSurfaceInverse: "#0A0F0D",
  muted: "#88948E",

  brand: "#C5A059",
  onBrand: "#0A0F0D",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#0A0F0D",
  brandSecondary: "#B38B4D",
  onBrandSecondary: "#F0F0EA",
  brandTertiary: "#2C2B22",
  onBrandTertiary: "#D4AF37",

  success: "#2D5D42",
  onSuccess: "#E3F0E8",
  warning: "#8A6722",
  onWarning: "#F5EBCE",
  error: "#7A2D2D",
  onError: "#F2E1E1",
  info: "#2D485D",
  onInfo: "#E1EDF5",

  border: "#222D28",
  borderStrong: "#3A4740",
  divider: "#1F2925",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const font = {
  display: "Cormorant Garamond",
  displayBold: "Cormorant Garamond",
  text: "System",
};

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Force dark
setColorScheme?.(defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  return { scheme: "dark", colors: themes.dark };
}

export const colors = themes.dark;

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
