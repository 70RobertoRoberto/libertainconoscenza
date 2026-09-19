import React, { useEffect, useState } from "react";
import { View, Image, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { auth } from "@/src/api";
import { colors } from "@/src/theme";
import { LOGO_URL } from "@/src/assets";

export default function Index() {
  const [state, setState] = useState<"loading" | "auth" | "app">("loading");

  useEffect(() => {
    (async () => {
      if (!(await auth.hasToken())) return setState("auth");
      try {
        await auth.me();
        setState("app");
      } catch {
        await auth.logout();
        setState("auth");
      }
    })();
  }, []);

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
