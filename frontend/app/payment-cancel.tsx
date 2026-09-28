import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";

export default function PaymentCancelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Text style={s.emoji}>🙏</Text>
      <Text style={s.title}>Pagamento non completato</Text>
      <Text style={s.subtle}>
        Hai annullato la procedura di pagamento. Nessun addebito è stato effettuato sulla tua carta.
      </Text>
      <Text style={s.subtle}>
        Se hai avuto un problema durante il pagamento, puoi riprovare quando vuoi dal tuo profilo.
      </Text>
      <Pressable onPress={() => router.replace("/paywall" as any)} style={s.btn}>
        <Text style={s.btnTxt}>Riprova il pagamento</Text>
      </Pressable>
      <Pressable onPress={() => router.replace("/" as any)} style={[s.btn, s.btnGhost]}>
        <Text style={[s.btnTxt, s.btnGhostTxt]}>Torna alla home</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  emoji: { fontSize: 64, marginBottom: spacing.md },
  title: {
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtle: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  btn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radius.md,
    marginTop: spacing.md,
    minWidth: 240,
    alignItems: "center",
  },
  btnTxt: {
    color: colors.onBrandPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  btnGhostTxt: {
    color: colors.brandPrimary,
  },
});
