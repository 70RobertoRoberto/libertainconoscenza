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

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!phone || !password) return setErr(t("err_creds"));
    setLoading(true);
    try {
      await auth.login(phone.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Errore di accesso");
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
            paddingTop: insets.top + spacing.xxxl,
            paddingHorizontal: spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
            <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
          </View>
          <H1 style={{ textAlign: "center", marginBottom: spacing.sm }}>{t("login_title")}</H1>
          <Muted style={{ textAlign: "center", marginBottom: spacing.xxl }}>
            {t("login_subtitle")}
          </Muted>

          <Text style={styles.label}>{t("phone")}</Text>
          <TextInput
            testID="login-phone-input"
            value={phone}
            onChangeText={setPhone}
            placeholder="+39 333 1234567"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>{t("password")}</Text>
          <TextInput
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="La tua password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
          />

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <GoldButton
            testID="login-submit-button"
            label={t("login")}
            onPress={submit}
            loading={loading}
            style={{ marginTop: spacing.xl }}
          />

          <Pressable
            testID="go-to-register"
            onPress={() => router.push("/register")}
            style={{ marginTop: spacing.xl, alignItems: "center" }}
          >
            <Body style={{ color: colors.muted }}>
              {t("no_account")}{" "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{t("register")}</Text>
            </Body>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { width: 120, height: 120 },
  label: {
    color: colors.onSurfaceTertiary,
    fontSize: 13,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
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
  err: {
    color: colors.brandPrimary,
    marginTop: spacing.md,
    fontSize: 14,
    textAlign: "center",
  },
});
