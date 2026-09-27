import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api, auth } from "@/src/api";

export default function EditNameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u: any = await auth.me();
        // Prefer explicit first/last; fallback to splitting the legacy `name`
        if (u?.first_name || u?.last_name) {
          setFirstName(u.first_name || "");
          setLastName(u.last_name || "");
        } else if (u?.name) {
          const parts = String(u.name).trim().split(/\s+/);
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" ") || "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    const f = firstName.trim();
    const l = lastName.trim();
    if (f.length < 2) {
      const m = "Il nome deve avere almeno 2 caratteri";
      if (Platform.OS === "web") window.alert(m); else Alert.alert("Errore", m);
      return;
    }
    if (l.length < 2) {
      const m = "Il cognome deve avere almeno 2 caratteri";
      if (Platform.OS === "web") window.alert(m); else Alert.alert("Errore", m);
      return;
    }
    setSaving(true);
    try {
      await api("/me/name", {
        method: "POST",
        body: JSON.stringify({ first_name: f, last_name: l }),
      });
      if (Platform.OS === "web") window.alert("Nome aggiornato");
      else Alert.alert("Fatto", "Nome aggiornato");
      router.back();
    } catch (e: any) {
      if (Platform.OS === "web") window.alert(e?.message || "-");
      else Alert.alert("Errore", e?.message || "-");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xxxl,
      }}
    >
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} hitSlop={10}>
          <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={s.headerTitle}>Nome e cognome</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={s.intro}>
          Aggiorna il tuo nome e cognome. Il nome completo apparirà negli attestati e nelle ricevute d&apos;acquisto.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <Text style={s.label}>Nome</Text>
            <TextInput
              testID="edit-first-name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Mario"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              style={s.input}
              maxLength={80}
            />

            <Text style={[s.label, { marginTop: spacing.lg }]}>Cognome</Text>
            <TextInput
              testID="edit-last-name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Rossi"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              style={s.input}
              maxLength={80}
            />

            <Pressable onPress={save} disabled={saving} style={s.saveBtn} testID="save-name">
              {saving ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <Text style={s.saveTxt}>Salva</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  intro: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  label: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
  },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 },
});
