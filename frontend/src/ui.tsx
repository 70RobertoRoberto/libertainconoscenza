// Shared components for Conoscenza Aperta
import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { colors, spacing, radius } from "./theme";

export function ScreenBg({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flex: 1, backgroundColor: colors.surface }, style]}>{children}</View>;
}

export function H1({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function GoldButton({
  label,
  onPress,
  disabled,
  loading,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.goldBtn,
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onBrandPrimary} />
      ) : (
        <Text style={styles.goldBtnText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function OutlineButton({
  label,
  onPress,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.outlineBtn, style]}>
      <Text style={styles.outlineBtnText}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, tone = "brand" }: { label: string; tone?: "brand" | "muted" | "success" }) {
  const bg = tone === "brand" ? colors.brandPrimary : tone === "success" ? colors.success : colors.surfaceTertiary;
  const fg = tone === "brand" ? colors.onBrandPrimary : tone === "success" ? colors.onSuccess : colors.onSurfaceTertiary;
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontFamily: "System",
    fontSize: 32,
    fontWeight: "700",
    color: colors.onSurface,
    letterSpacing: 0.2,
  },
  h2: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.onSurface,
  },
  body: {
    fontSize: 15,
    color: colors.onSurfaceSecondary,
    lineHeight: 24,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  goldBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  goldBtnText: {
    color: colors.onBrandPrimary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
