import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { auth } from "@/src/api";
import { GoldButton, H1, Muted, Body } from "@/src/ui";
import { PasswordInput } from "@/src/PasswordInput";
import { LOGO_URL } from "@/src/assets";
import { useLang } from "@/src/i18n";
import { registerForPush } from "@/src/push";

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useLang();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const normalizePhone = (raw: string) => {
    let p = (raw || "").replace(/[\s().-]/g, "");
    if (p.startsWith("00")) p = "+" + p.slice(2);
    if (!p.startsWith("+")) {
      if (/^3\d{8,9}$/.test(p)) p = "+39" + p;
      else if (p) p = "+" + p;
    }
    return p;
  };

  const submit = async () => {
    setErr("");
    if (!name.trim()) return setErr("Inserisci il tuo nome");
    if (name.trim().length < 2) return setErr("Il nome deve avere almeno 2 caratteri");
    if (!phone || !password) return setErr(t("err_required"));
    if (password.length < 6) return setErr(t("err_min"));
    if (!acceptedTerms) return setErr("Devi accettare i termini e la privacy per continuare");
    setLoading(true);
    try {
      const user = await auth.register(normalizePhone(phone), password, name.trim(), referral.trim() || undefined);
      registerForPush(user.id).catch(() => {});
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Errore in registrazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + spacing.xxl,
            paddingHorizontal: spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <Image source={{ uri: LOGO_URL }} style={{ width: 90, height: 90 }} resizeMode="contain" />
          </View>
          <H1 style={{ textAlign: "center", marginBottom: spacing.sm }}>{t("register_title")}</H1>
          <Muted style={{ textAlign: "center", marginBottom: spacing.xl }}>
            {t("register_subtitle")}
          </Muted>

          <Text style={styles.label}>{t("language")} / Language</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
            <Pressable
              testID="lang-it"
              onPress={() => setLang("it")}
              style={[styles.langChip, lang === "it" && styles.langChipActive]}
            >
              <Text style={lang === "it" ? styles.langChipTxtActive : styles.langChipTxt}>Italiano</Text>
            </Pressable>
            <Pressable
              testID="lang-en"
              onPress={() => setLang("en")}
              style={[styles.langChip, lang === "en" && styles.langChipActive]}
            >
              <Text style={lang === "en" ? styles.langChipTxtActive : styles.langChipTxt}>English</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>{t("name_required")} <Text style={{ color: colors.brandPrimary }}>*</Text></Text>
          <TextInput
            testID="register-name-input"
            value={name}
            onChangeText={setName}
            placeholder={t("name_placeholder")}
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="words"
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>{t("phone")}</Text>
          <TextInput
            testID="register-phone-input"
            value={phone}
            onChangeText={setPhone}
            placeholder="+39 333 1234567"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            autoCapitalize="none"
            style={styles.input}
          />
          <Muted style={styles.helperTxt}>
            Includi il prefisso internazionale +39 · Gli spazi sono facoltativi
          </Muted>

          <Text style={[styles.label, { marginTop: spacing.lg }]}>{t("password_hint")}</Text>
          <PasswordInput
            testID="register-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Crea una password sicura"
            placeholderTextColor={colors.muted}
            inputStyle={styles.input}
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Codice referral (facoltativo)</Text>
          <TextInput
            testID="register-referral-input"
            value={referral}
            onChangeText={setReferral}
            placeholder="Es. MAESTRO-2026"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            style={styles.input}
          />

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Pressable
            testID="accept-terms-toggle"
            onPress={() => setAcceptedTerms((v) => !v)}
            style={styles.termsRow}
          >
            <View style={[styles.termsCheck, acceptedTerms && styles.termsCheckActive]}>
              {acceptedTerms ? <Text style={styles.termsCheckMark}>✓</Text> : null}
            </View>
            <Text style={styles.termsTxt}>
              Ho letto e accetto i{" "}
              <Text
                style={styles.termsLink}
                onPress={(e) => { e.stopPropagation?.(); router.push("/terms"); }}
              >
                Termini di Servizio
              </Text>
              {" "}e la{" "}
              <Text
                style={styles.termsLink}
                onPress={(e) => { e.stopPropagation?.(); router.push("/privacy"); }}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </Pressable>

          <GoldButton
            testID="register-submit-button"
            label={t("register")}
            onPress={submit}
            loading={loading}
            style={{ marginTop: spacing.xl }}
          />

          <Pressable
            testID="go-to-login"
            onPress={() => router.replace("/login")}
            style={{ marginTop: spacing.xl, alignItems: "center" }}
          >
            <Body style={{ color: colors.muted }}>
              {t("have_account")}{" "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{t("login")}</Text>
            </Body>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.onSurfaceTertiary, fontSize: 13, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.onSurface,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  err: { color: colors.brandPrimary, marginTop: spacing.md, textAlign: "center" },
  helperTxt: { marginTop: 6, fontSize: 11, fontStyle: "italic" },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.xl,
    paddingRight: spacing.md,
  },
  termsCheck: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.brandPrimary,
    marginRight: spacing.md,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  termsCheckActive: {
    backgroundColor: colors.brandPrimary,
  },
  termsCheckMark: {
    color: colors.surface,
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 16,
  },
  termsTxt: {
    flex: 1,
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  termsLink: {
    color: colors.brandPrimary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  langChip: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  langChipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  langChipTxt: { color: colors.onSurfaceTertiary, fontSize: 14, fontWeight: "600" },
  langChipTxtActive: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "700" },
});
