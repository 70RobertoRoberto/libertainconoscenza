import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api, auth } from "@/src/api";
import { GoldButton, Muted, Card } from "@/src/ui";
import { PasswordInput } from "@/src/PasswordInput";

export default function DeleteAccount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!current) return setErr("Inserisci la password attuale per confermare");
    if (!confirmed) return setErr("Spunta la casella di conferma per proseguire");
    setLoading(true);
    try {
      await api("/auth/delete-me", {
        method: "POST",
        body: JSON.stringify({ current_password: current }),
      });
      // Logout & redirect
      await auth.logout();
      router.replace("/login");
    } catch (e: any) {
      setErr(e.message || "Errore durante l'eliminazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xxxl,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={styles.header}>
        <Pressable testID="back-del" onPress={() => router.back()} style={styles.back}>
          <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Elimina il mio account</Text>
        <View style={{ width: 40 }} />
      </View>

      <Card style={{ marginTop: spacing.lg, borderColor: colors.error, borderWidth: 1 }}>
        <Text style={styles.warnTitle}>⚠️  Attenzione: azione irreversibile</Text>
        <Muted style={{ marginTop: spacing.sm, lineHeight: 21 }}>
          Eliminando il tuo account verranno cancellati definitivamente:
        </Muted>
        <View style={{ marginTop: spacing.sm }}>
          {[
            "Il tuo profilo e le tue credenziali",
            "Tutti i preferiti e articoli letti",
            "Tutti i commenti che hai pubblicato",
            "Statistiche personali e certificati",
            "Ordini di abbonamento e referral",
          ].map((it, i) => (
            <View key={i} style={styles.li}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.liTxt}>{it}</Text>
            </View>
          ))}
        </View>
        <Muted style={{ marginTop: spacing.md, lineHeight: 21 }}>
          Un eventuale abbonamento Premium attivo NON verrà rimborsato. Puoi sempre creare un nuovo account in futuro.
        </Muted>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.label}>Conferma con la tua password</Text>
        <PasswordInput
          testID="del-current-password"
          value={current}
          onChangeText={setCurrent}
          placeholder="La tua password attuale"
          placeholderTextColor={colors.muted}
          inputStyle={styles.input}
        />

        <Pressable
          testID="del-confirm-toggle"
          onPress={() => setConfirmed((v) => !v)}
          style={styles.confirmRow}
        >
          <View style={[styles.checkbox, confirmed && styles.checkboxActive]}>
            {confirmed ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.confirmTxt}>
            Confermo di voler eliminare definitivamente il mio account e tutti i miei dati.
          </Text>
        </Pressable>

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable
          testID="del-submit"
          onPress={submit}
          disabled={loading}
          style={[styles.dangerBtn, (!confirmed || !current) && styles.dangerBtnDisabled]}
        >
          <Text style={styles.dangerBtnTxt}>
            {loading ? "Eliminazione in corso…" : "Elimina definitivamente il mio account"}
          </Text>
        </Pressable>

        <GoldButton
          testID="cancel-delete"
          label="Annulla"
          onPress={() => router.back()}
          style={{ marginTop: spacing.md, backgroundColor: colors.surfaceSecondary }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  warnTitle: { color: colors.error, fontSize: 15, fontWeight: "800" },
  li: { flexDirection: "row", alignItems: "flex-start", marginVertical: 3 },
  bullet: { color: colors.brandPrimary, marginRight: spacing.sm, marginTop: 1 },
  liTxt: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  label: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.lg,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: colors.error,
    marginRight: spacing.md, marginTop: 2,
    alignItems: "center", justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.error },
  checkMark: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  confirmTxt: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  err: { color: colors.error, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
  dangerBtn: {
    marginTop: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: "center",
  },
  dangerBtnDisabled: { opacity: 0.5 },
  dangerBtnTxt: { color: "#FFFFFF", fontWeight: "800" },
});
