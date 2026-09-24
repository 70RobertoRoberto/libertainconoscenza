import React, { useEffect, useState } from "react";
import { View, Image, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { auth } from "@/src/api";
import { colors } from "@/src/theme";
import { LOGO_URL } from "@/src/assets";
import { registerForPush } from "@/src/push";
import { storage } from "@/src/utils/storage";

const ONBOARDING_KEY = "has_seen_onboarding";

type State = "loading" | "onboarding" | "auth" | "app";

export default function Index() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    (async () => {
      // If user already has a valid token, go straight to app (skip onboarding).
      if (await auth.hasToken()) {
        try {
          const user = await auth.me();
          registerForPush(user.id).catch(() => {});
          setState("app");
          return;
        } catch {
          await auth.logout();
          // fall through to check onboarding
        }
      }
      // No token: decide between onboarding (first launch) and auth screens.
      const seen = await storage.getItem<boolean>(ONBOARDING_KEY, false);
      setState(seen ? "auth" : "onboarding");
    })();
  }, []);

  if (state === "onboarding") return <Redirect href="/onboarding" />;
  if (state === "auth") return <Redirect href="/login" />;
  if (state === "app") return <Redirect href="/(tabs)" />;

  return (
    <View style={styles.container}>
      <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 180, height: 180 },
});
