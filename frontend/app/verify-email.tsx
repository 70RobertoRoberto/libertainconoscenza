import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = (params.token as string) || "";

  const [state, setState] = useState<"loading" | "ok" | "already" | "fail">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setState("fail");
      setMessage("Link non valido: token mancante.");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/verify-email?token=${encodeURIComponent(token)}`);
        const data = await r.json();
        setMessage(data?.message || "");
        if (data?.ok) setState(data.already ? "already" : "ok");
        else setState("fail");
      } catch {
        setState("fail");
        setMessage("Errore di connessione. Riprova più tardi.");
      }
    })();
  }, [token]);

  return (
    <View style={[s.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={s.card}>
        {state === "loading" ? (
          <>
            <ActivityIndicator color={colors.brandPrimary} size="large" />
            <Text style={s.title}>Verifica in corso…</Text>
            <Text style={s.body}>Attendi un istante.</Text>
          </>
        ) : state === "ok" ? (
          <>
            <Text style={s.icon}>✅</Text>
            <Text style={s.title}>Email verificata!</Text>
            <Text style={s.body}>
              Perfetto. Da questo momento tutte le comunicazioni importanti (ricevute, risposte dell&apos;assistenza, certificati) ti arriveranno al tuo indirizzo confermato.
            </Text>
          </>
        ) : state === "already" ? (
          <>
            <Text style={s.icon}>👍</Text>
            <Text style={s.title}>Email già verificata</Text>
            <Text style={s.body}>Il tuo indirizzo risulta già confermato. Puoi tornare nell&apos;app.</Text>
          </>
        ) : (
          <>
            <Text style={s.icon}>⚠️</Text>
            <Text style={s.title}>Verifica non riuscita</Text>
            <Text style={s.body}>{message || "Il link non è valido o è scaduto. Torna nell'app e chiedi un nuovo invio dalla sezione Profilo → Email."}</Text>
          </>
        )}

        <Pressable
          testID="go-app"
          onPress={() => router.replace("/(tabs)")}
          style={s.cta}
        >
          <Text style={s.ctaTxt}>Torna nell&apos;app</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    justifyContent: "flex-start",
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    padding: spacing.xxl,
    alignItems: "center",
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
  },
  icon: { fontSize: 42, marginBottom: spacing.md },
  title: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "800",
    marginTop: spacing.md,
    textAlign: "center",
  },
  body: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.md,
    textAlign: "center",
  },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  ctaTxt: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 },
});
