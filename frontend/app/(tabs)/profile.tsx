import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Share, Linking, Switch, Platform, Alert, TextInput } from "react-native";
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
  const [enrollCount, setEnrollCount] = useState<number>(0);
  const [certCount, setCertCount] = useState<number>(0);
  const [marketing, setMarketing] = useState<boolean>(false);
  const [savingMarketing, setSavingMarketing] = useState(false);

  useEffect(() => {
    auth.me().then((u: any) => {
      setUser(u);
      setMarketing(!!u?.marketing_consent);
    }).catch(() => {});
    api<any>("/referrals/me").then(setRef).catch(() => {});
    api<any>("/me/stats").then(setStats).catch(() => {});
    api<any>("/me/enrollments").then((r) => setEnrollCount(r?.items?.length || 0)).catch(() => {});
    api<any>("/me/certificates").then((r) => setCertCount(r?.items?.length || 0)).catch(() => {});
  }, []);

  const toggleMarketing = async (v: boolean) => {
    setSavingMarketing(true);
    const prev = marketing;
    setMarketing(v);
    try {
      await api<any>("/me/marketing-consent", {
        method: "POST",
        body: JSON.stringify({ consent: v }),
      });
    } catch (e: any) {
      setMarketing(prev);
      if (Platform.OS === "web") window.alert(`Errore: ${e?.message || "-"}`);
      else Alert.alert("Errore", e?.message || "-");
    } finally {
      setSavingMarketing(false);
    }
  };

  const sub = user?.subscription || {};
  const isPremium = sub.status === "premium";
  const isTrial = sub.status === "trial" && (sub.days_remaining ?? 0) > 0;

  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  useEffect(() => {
    if (user?.email) setEmailDraft(user.email);
  }, [user?.email]);

  const saveEmail = async () => {
    const e = (emailDraft || "").trim().toLowerCase();
    if (!e || !e.includes("@") || !e.split("@")[1]?.includes(".")) {
      if (Platform.OS === "web") window.alert("Email non valida");
      else Alert.alert("Errore", "Email non valida");
      return;
    }
    setSavingEmail(true);
    try {
      await api("/me/email", { method: "POST", body: JSON.stringify({ email: e }) });
      const u: any = await auth.me();
      setUser(u);
      if (Platform.OS === "web") window.alert("Email salvata");
      else Alert.alert("Fatto", "Email salvata");
    } catch (er: any) {
      if (Platform.OS === "web") window.alert(er?.message || "-");
      else Alert.alert("Errore", er?.message || "-");
    } finally {
      setSavingEmail(false);
    }
  };

  const shareReferral = async () => {
    if (!ref?.code) return;
    const message = `Ti invito a scoprire Libertà in Conoscenza 🌿\n\nUsa il mio codice per iscriverti: ${ref.code}\n\n— Libertà in Conoscenza, sapienza per crescere`;
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
          ) : isTrial ? (
            <Badge label={`Prova · ${sub.days_remaining}g`} tone="brand" />
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
          <Text style={styles.upgradeTitle}>
            {isTrial ? `⏳ Prova gratuita: ${sub.days_remaining} ${sub.days_remaining === 1 ? "giorno" : "giorni"} rimasti` : t("unlock_advanced")}
          </Text>
          <Muted style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            {isTrial
              ? "Sottoscrivi ora l'abbonamento annuale a 12€ per continuare senza interruzioni."
              : t("unlock_desc")}
          </Muted>
          <GoldButton
            testID="upgrade-cta"
            label={isTrial ? "Abbonati a 12€/anno" : t("see_plans")}
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
        <Text style={styles.sectionTitle}>🎓  I miei Corsi</Text>
        <View style={{ height: spacing.md }} />
        <OutlineButton
          testID="go-my-courses"
          label={`Corsi seguiti${enrollCount ? ` (${enrollCount})` : ""}`}
          onPress={() => router.push("/my-courses")}
        />
        <View style={{ height: spacing.sm }} />
        <OutlineButton
          testID="go-my-certificates"
          label={`Certificati${certCount ? ` (${certCount})` : ""}`}
          onPress={() => router.push("/my-certificates")}
        />
      </Card>

      {isPremium && sub?.expires_at ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.sectionTitle}>👑  Abbonamento Premium</Text>
          <Muted style={{ marginTop: spacing.sm }}>
            {`Scadenza: ${new Date(sub.expires_at).toLocaleDateString("it-IT", { day:"2-digit", month:"long", year:"numeric" })}`}
            {typeof sub.days_remaining === "number" ? ` · ${sub.days_remaining} giorni rimanenti` : ""}
          </Muted>
          <Muted style={{ marginTop: 4, fontSize: 12 }}>
            {sub.auto_renew
              ? "Rinnovo automatico ATTIVO — verrà rinnovato a 12€/anno."
              : "Rinnovo automatico DISATTIVATO — l'accesso terminerà alla scadenza."}
          </Muted>
          <View style={{ height: spacing.md }} />
          <OutlineButton
            testID={sub.auto_renew ? "cancel-renewal" : "reactivate-renewal"}
            label={sub.auto_renew ? "Disdici rinnovo automatico" : "Riattiva rinnovo automatico"}
            onPress={async () => {
              const endpoint = sub.auto_renew ? "/me/subscription/cancel-renewal" : "/me/subscription/reactivate-renewal";
              const confirmMsg = sub.auto_renew
                ? "Confermi la disdetta del rinnovo? Manterrai l'accesso fino alla scadenza."
                : "Confermi la riattivazione del rinnovo automatico?";
              const proceed = Platform.OS === "web"
                ? window.confirm(confirmMsg)
                : await new Promise<boolean>((res) =>
                    Alert.alert(sub.auto_renew ? "Disdici rinnovo" : "Riattiva rinnovo", confirmMsg, [
                      { text: "Annulla", style: "cancel", onPress: () => res(false) },
                      { text: "Conferma", onPress: () => res(true) },
                    ]));
              if (!proceed) return;
              try {
                const r: any = await api(endpoint, { method: "POST" });
                if (Platform.OS === "web") window.alert(r?.message || "Fatto");
                else Alert.alert("Fatto", r?.message || "-");
                const u: any = await auth.me();
                setUser(u);
              } catch (e: any) {
                if (Platform.OS === "web") window.alert(e?.message || "-");
                else Alert.alert("Errore", e?.message || "-");
              }
            }}
          />
        </Card>
      ) : null}

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>🎵  Le mie playlist</Text>
        <View style={{ height: spacing.md }} />
        <OutlineButton
          testID="go-playlists"
          label="Apri playlist"
          onPress={() => router.push("/playlists")}
        />
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>ℹ️  Il nostro progetto</Text>
        <View style={{ height: spacing.md }} />
        <OutlineButton
          testID="go-about"
          label="Chi Siamo"
          onPress={() => router.push("/about")}
        />
        <View style={{ height: spacing.sm }} />
        <OutlineButton
          testID="go-terms"
          label="Termini di Servizio"
          onPress={() => router.push("/terms")}
        />
        <View style={{ height: spacing.sm }} />
        <OutlineButton
          testID="go-privacy"
          label="Privacy Policy"
          onPress={() => router.push("/privacy")}
        />
        <View style={{ height: spacing.sm }} />
        <OutlineButton
          testID="go-cookies"
          label="Cookie Policy"
          onPress={() => router.push("/cookies")}
        />
        <View style={{ height: spacing.sm }} />
        <OutlineButton
          testID="go-disclaimer"
          label="Disclaimer"
          onPress={() => router.push("/disclaimer")}
        />
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>🔐  Privacy e cookie</Text>
        <View style={{ height: spacing.md }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "700" }}>Comunicazioni promozionali</Text>
            <Muted style={{ fontSize: 12, marginTop: 2 }}>
              Ricevi via email novità sui corsi e iniziative. Puoi revocare in qualsiasi momento.
            </Muted>
          </View>
          <Switch
            testID="toggle-marketing"
            value={marketing}
            onValueChange={toggleMarketing}
            disabled={savingMarketing}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            thumbColor={marketing ? colors.onBrandPrimary : colors.muted}
          />
        </View>
        <View style={{ height: spacing.md }} />
        <OutlineButton
          testID="review-cookies"
          label="Rivedi consenso cookie"
          onPress={() => router.push("/cookie-preferences")}
        />
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.sectionTitle}>📧  Email</Text>
          {user?.email ? (
            user.email_verified ? (
              <View style={styles.badgeOk}>
                <Text style={styles.badgeOkTxt}>✓ Verificata</Text>
              </View>
            ) : (
              <View style={styles.badgeWarn}>
                <Text style={styles.badgeWarnTxt}>Da verificare</Text>
              </View>
            )
          ) : null}
        </View>
        <Muted style={{ marginTop: spacing.sm, fontSize: 12 }}>
          Riceverai qui ricevute d&apos;acquisto, risposte all&apos;assistenza e certificati.
          {user?.email && !user.email_verified ? " Puoi continuare a usare l'app senza attendere: la verifica arriva quando clicchi sul link." : ""}
        </Muted>
        <View style={{ height: spacing.md }} />
        <TextInput
          testID="profile-email-input"
          value={emailDraft}
          onChangeText={setEmailDraft}
          placeholder="mario.rossi@email.it"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.emailInput}
        />
        <View style={{ height: spacing.sm }} />
        <OutlineButton
          testID="save-email"
          label={savingEmail ? "Salvataggio…" : (user?.email ? "Aggiorna email" : "Salva email")}
          onPress={saveEmail}
        />
        {user?.email && !user.email_verified ? (
          <>
            <View style={{ height: spacing.sm }} />
            <OutlineButton
              testID="resend-verification"
              label="Rinvia link di verifica"
              onPress={async () => {
                try {
                  const r: any = await api("/me/email/resend-verification", { method: "POST" });
                  if (Platform.OS === "web") window.alert(r?.message || "Email inviata");
                  else Alert.alert("Fatto", r?.message || "Email inviata");
                } catch (er: any) {
                  if (Platform.OS === "web") window.alert(er?.message || "-");
                  else Alert.alert("Errore", er?.message || "-");
                }
              }}
            />
          </>
        ) : null}
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>💬  Assistenza</Text>
        <View style={{ height: spacing.md }} />
        <OutlineButton
          testID="go-help"
          label="Apri richiesta di assistenza"
          onPress={() => router.push("/help")}
        />
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>🔐  Sicurezza</Text>
        {user?.last_login_at ? (
          <Muted style={{ marginTop: spacing.sm, fontSize: 12 }}>
            {`Ultimo accesso: ${new Date(user.last_login_at).toLocaleString("it-IT")} · ${user?.last_login_device || "Dispositivo sconosciuto"}`}
          </Muted>
        ) : null}
        <View style={{ height: spacing.md }} />
        <OutlineButton
          testID="go-login-history"
          label="Vedi accessi recenti"
          onPress={() => router.push("/login-history")}
        />
        <View style={{ height: spacing.sm }} />
        <OutlineButton
          testID="go-change-password"
          label="Cambia password"
          onPress={() => router.push("/change-password")}
        />
        <View style={{ height: spacing.sm }} />
        <OutlineButton
          testID="go-delete-account"
          label="Elimina il mio account"
          onPress={() => router.push("/delete-account")}
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
  emailInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
  },
  badgeOk: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "#22c55e22",
  },
  badgeOkTxt: { color: "#22c55e", fontSize: 10, fontWeight: "800" },
  badgeWarn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  badgeWarnTxt: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" },
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
