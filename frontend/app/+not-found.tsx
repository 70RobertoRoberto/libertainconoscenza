import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "@/src/theme";

/**
 * Fallback screen for stale routes.
 * After deleting content in the Admin panel, sometimes the router still has a
 * reference to the deleted route (e.g. /media/[id]). Instead of crashing with
 * the noisy "RESET action rejected" console error, we quietly bounce the user
 * back to Home.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        router.replace("/(tabs)");
      } catch {
        router.replace("/");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Contenuto non disponibile.{"\n"}Ti riporto alla Home…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  text: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
