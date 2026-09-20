import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { GoldButton, Muted, Card } from "@/src/ui";

export default function ChangePassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  const submit = async () => {
    setMsg("");
    setOk(false);
    if (!current || !next) return setMsg("Compila tutti i campi");
    if (next.length < 6) return setMsg("La nuova password deve essere di almeno 6 caratteri");
    if (next !== confirm) return setMsg("Le due password non coincidono");
    setLoading(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setOk(true);
      setMsg("✅ Password aggiornata con successo");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e: any) {
      setMsg(e.message || "Errore nel cambio password");
    } finally {
      setLoading(false);
    }
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
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.xl }}>
        <Pressable testID="back-cp" onPress={() => router.back()} style={styles.back}>
          <Text style={{ color: colors.onSurface, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Cambia password</Text>
      </View>

      <Muted style={{ marginBottom: spacing.xl }}>
        Per la tua sicurezza, inserisci la password attuale e la nuova password che vorrai usare al prossimo accesso.
      </Muted>

      <Card>
        <Text style={styles.label}>Password attuale</Text>
        <TextInput
          testID="current-password"
          value={current}
          onChangeText={setCurrent}
          placeholder="Password attuale"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          autoCapitalize="none"
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Nuova password</Text>
        <TextInput
          testID="new-password"
          value={next}
          onChangeText={setNext}
          placeholder="Almeno 6 caratteri"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          autoCapitalize="none"
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Conferma nuova password</Text>
        <TextInput
          testID="confirm-password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Ripeti la nuova password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          autoCapitalize="none"
        />

        {msg ? (
          <Text
            style={{
              marginTop: spacing.md,
              color: ok ? colors.brandPrimary : colors.error,
              fontWeight: "600",
            }}
          >
            {msg}
          </Text>
        ) : null}

        <GoldButton
          testID="submit-cp"
          label={loading ? "Aggiornamento…" : "Aggiorna password"}
          onPress={submit}
          loading={loading}
          style={{ marginTop: spacing.xl }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "700" },
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
});
