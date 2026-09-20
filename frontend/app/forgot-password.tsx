import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { GoldButton, Muted, Card } from "@/src/ui";

const CONTACT_EMAIL = "info@scienzebiofisiche.it";

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
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
    if (!phone.trim()) return setErr("Inserisci il numero di telefono");
    setLoading(true);
    try {
      await api<any>("/auth/password-reset-request", {
        method: "POST",
        body: JSON.stringify({
          phone: normalizePhone(phone),
          email: email.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      setOk(true);
    } catch (e: any) {
      setErr(e.message || "Errore invio richiesta");
    } finally {
      setLoading(false);
    }
  };

  if (ok) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.replace("/login")} style={styles.back}>
            <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Password dimenticata</Text>
          <View style={{ width: 40 }} />
        </View>
        <Card style={{ marginTop: spacing.xxl }}>
          <Text style={styles.successTitle}>✅  Richiesta inviata</Text>
          <Muted style={{ marginTop: spacing.md, lineHeight: 22 }}>
            Se il numero è registrato riceverai istruzioni sulla nuova password via WhatsApp o email.
            Solitamente rispondiamo entro poche ore.
          </Muted>
          <Muted style={{ marginTop: spacing.md, lineHeight: 22 }}>
            Per assistenza immediata puoi scrivere a{" "}
            <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{CONTACT_EMAIL}</Text>.
          </Muted>
          <GoldButton
            testID="back-to-login"
            label="Torna al login"
            onPress={() => router.replace("/login")}
            style={{ marginTop: spacing.xl }}
          />
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxxl,
          paddingHorizontal: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable testID="back-fp" onPress={() => router.back()} style={styles.back}>
            <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Password dimenticata</Text>
          <View style={{ width: 40 }} />
        </View>

        <Muted style={{ marginTop: spacing.md, lineHeight: 22 }}>
          Inserisci il numero di telefono con cui ti sei registrato. Ti ricontatteremo
          via WhatsApp o email con una password temporanea. Al primo accesso potrai
          cambiarla dal Profilo.
        </Muted>

        <Text style={[styles.label, { marginTop: spacing.xl }]}>
          Numero di telefono <Text style={{ color: colors.brandPrimary }}>*</Text>
        </Text>
        <TextInput
          testID="fp-phone-input"
          value={phone}
          onChangeText={setPhone}
          placeholder="+39 333 1234567"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          autoCapitalize="none"
          style={styles.input}
        />
        <Muted style={styles.helperTxt}>Con o senza prefisso — normalizzeremo noi</Muted>

        <Text style={[styles.label, { marginTop: spacing.xl }]}>Email (facoltativa)</Text>
        <TextInput
          testID="fp-email-input"
          value={email}
          onChangeText={setEmail}
          placeholder="La tua email per riceverci"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: spacing.xl }]}>Nota (facoltativa)</Text>
        <TextInput
          testID="fp-note-input"
          value={note}
          onChangeText={setNote}
          placeholder="Es. preferisco essere contattato al mattino"
          placeholderTextColor={colors.muted}
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          multiline
        />

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <GoldButton
          testID="fp-submit"
          label={loading ? "Invio…" : "Invia richiesta"}
          onPress={submit}
          loading={loading}
          style={{ marginTop: spacing.xl }}
        />

        <Muted style={{ textAlign: "center", marginTop: spacing.xl, fontSize: 12 }}>
          Preferisci scriverci direttamente? {CONTACT_EMAIL}
        </Muted>
      </ScrollView>
    </KeyboardAvoidingView>
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
  label: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helperTxt: { marginTop: 6, fontSize: 11, fontStyle: "italic" },
  err: { color: colors.brandPrimary, marginTop: spacing.md, textAlign: "center" },
  successTitle: { color: colors.brandPrimary, fontSize: 18, fontWeight: "800" },
});
