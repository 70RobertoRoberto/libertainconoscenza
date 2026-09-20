import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Share, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api, auth } from "@/src/api";
import { GoldButton, OutlineButton, Muted, Card, Badge } from "@/src/ui";
import { LOGO_URL } from "@/src/assets";
import { useLang } from "@/src/i18n";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useLang();
  const [user, setUser] = useState<any>(null);
  const [ref, setRef] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    auth.me().then(setUser).catch(() => {});
    api<any>("/referrals/me").then(setRef).catch(() => {});
    api<any>("/me/stats").then(setStats).catch(() => {});
  }, []);

  const isPremium = user?.subscription?.status === "premium";

  const shareReferral = async () => {
    if (!ref?.code) return;
    const message = `Ti invito a scoprire Conoscenza Aperta 🌿\n\nUsa il mio codice per iscriverti: ${ref.code}\n\n— Conoscenza Aperta, sapienza per crescere`;
    try {
      await Share.share({ message });
    } catch {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
    }
  };

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

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>♥  {t("favorites")}</Text>
        <View style={{ height: spacing.md }} />
        <OutlineButton testID="go-favorites" label={t("favorites_see")} onPress={() => router.push("/favorites")} />
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>ℹ️  Il nostro progetto</Text>
        <View style={{ height: spacing.md }} />
        <OutlineButton
          testID="go-about"
          label="Chi Siamo"
          onPress={() => router.push("/about")}
        />
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>🔐  Sicurezza</Text>
        <View style={{ height: spacing.md }} />
        <OutlineButton
          testID="go-change-password"
          label="Cambia password"
          onPress={() => router.push("/change-password")}
        />
      </Card>

      {stats && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>{t("my_path")}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.articles_read}</Text>
              <Text style={styles.statLbl}>{t("articles_read")}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.minutes_meditated}</Text>
              <Text style={styles.statLbl}>{t("min_meditated")}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.current_streak}</Text>
              <Text style={styles.statLbl}>{t("streak_days")}</Text>
            </View>
          </View>
          {stats.badges?.length ? (
            <View style={{ marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {stats.badges.map((b: any) => (
                <View key={b.key} style={styles.badge}>
                  <Text style={{ fontSize: 14 }}>{b.icon}</Text>
                  <Text style={styles.badgeTxt}>{b.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Muted style={{ marginTop: spacing.md, fontSize: 12 }}>
              {t("keep_exploring")}
            </Muted>
          )}
        </Card>
      )}

      {ref?.code && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>{t("invite")}</Text>
          <Muted style={{ marginTop: spacing.sm }}>
            {t("invite_desc")}
          </Muted>
          <View style={styles.refCodeBox}>
            <Text testID="referral-code" style={styles.refCode}>{ref.code}</Text>
            <Text style={styles.refCount}>{ref.count} {t("invited")}</Text>
          </View>
          <GoldButton testID="share-referral" label={t("share_code")} onPress={shareReferral} style={{ marginTop: spacing.md }} />
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

const _refStyles = StyleSheet.create({});
// merge referral styles into styles

const styles = StyleSheet.create({
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "700", marginTop: spacing.md },
  upgradeTitle: { color: colors.brandPrimary, fontSize: 18, fontWeight: "700" },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  refCodeBox: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refCode: { color: colors.brandPrimary, fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  refCount: { color: colors.onSurfaceTertiary, fontSize: 13 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  statVal: { color: colors.brandPrimary, fontSize: 24, fontWeight: "800" },
  statLbl: { color: colors.muted, fontSize: 11, marginTop: 2, textAlign: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  badgeTxt: { color: colors.brandPrimary, fontSize: 11, fontWeight: "700" },
});
