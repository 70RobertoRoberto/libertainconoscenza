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
import { LOGO_URL } from "@/src/assets";
import { useLang } from "@/src/i18n";

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useLang();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!phone || !password) return setErr(t("err_required"));
    if (password.length < 6) return setErr(t("err_min"));
    setLoading(true);
    try {
      await auth.register(phone.trim(), password, name.trim() || undefined);
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

          <Text style={styles.label}>{t("name_optional")}</Text>
          <TextInput
            testID="register-name-input"
            value={name}
            onChangeText={setName}
            placeholder="Come vuoi essere chiamato"
            placeholderTextColor={colors.muted}
            style={styles.input}
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

          <Text style={[styles.label, { marginTop: spacing.lg }]}>{t("password_hint")}</Text>
          <TextInput
            testID="register-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Crea una password sicura"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
          />

          {err ? <Text style={styles.err}>{err}</Text> : null}

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
