import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { auth } from "@/src/api";
import { GoldButton, OutlineButton, Muted, Card, Badge } from "@/src/ui";
import { LOGO_URL } from "@/src/assets";
import { useLang } from "@/src/i18n";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useLang();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    auth.me().then(setUser).catch(() => {});
  }, []);

  const isPremium = user?.subscription?.status === "premium";

  const logout = async () => {
    await auth.logout();
    router.replace("/login");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.xl,
        paddingBottom: insets.bottom + spacing.xxxl,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
        <Image source={{ uri: LOGO_URL }} style={{ width: 90, height: 90 }} resizeMode="contain" />
        <Text style={styles.name}>{user?.name || t("seeker")}</Text>
        <Muted style={{ marginTop: 4 }}>{user?.phone}</Muted>
        <View style={{ marginTop: spacing.md, flexDirection: "row", gap: spacing.sm }}>
          {isPremium ? (
            <Badge label={t("premium")} tone="brand" />
          ) : (
            <Badge label={t("free")} tone="muted" />
          )}
          {user?.is_admin ? <Badge label={t("admin")} tone="success" /> : null}
        </View>
      </View>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>{t("language")}</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <Pressable testID="prof-lang-it" onPress={() => setLang("it")} style={[langStyles.chip, lang === "it" && langStyles.active]}>
            <Text style={lang === "it" ? langStyles.txtA : langStyles.txt}>Italiano</Text>
          </Pressable>
          <Pressable testID="prof-lang-en" onPress={() => setLang("en")} style={[langStyles.chip, lang === "en" && langStyles.active]}>
            <Text style={lang === "en" ? langStyles.txtA : langStyles.txt}>English</Text>
          </Pressable>
        </View>
      </Card>

      {!isPremium && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.upgradeTitle}>{t("unlock_advanced")}</Text>
          <Muted style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            {t("unlock_desc")}
          </Muted>
          <GoldButton
            testID="upgrade-cta"
            label={t("see_plans")}
            onPress={() => router.push("/paywall")}
          />
        </Card>
      )}

      {user?.is_admin && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>{t("admin")}</Text>
          <View style={{ height: spacing.md }} />
          <GoldButton testID="go-admin" label={t("admin_panel")} onPress={() => router.push("/admin")} />
        </Card>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <OutlineButton testID="logout-btn" label={t("logout")} onPress={logout} />
      </View>
    </ScrollView>
  );
}

const langStyles = StyleSheet.create({
  chip: {
    flex: 1, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  active: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  txt: { color: colors.onSurfaceTertiary, fontWeight: "600" },
  txtA: { color: colors.onBrandPrimary, fontWeight: "700" },
});

const styles = StyleSheet.create({
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "700", marginTop: spacing.md },
  upgradeTitle: { color: colors.brandPrimary, fontSize: 18, fontWeight: "700" },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
});
