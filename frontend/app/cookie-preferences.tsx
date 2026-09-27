import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api, auth } from "@/src/api";

type Consent = {
  technical: boolean;
  analytics_first: boolean;
  analytics_third: boolean;
  marketing: boolean;
  decided_at?: string;
};

export default function CookiePreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [c, setC] = useState<Consent>({ technical: true, analytics_first: true, analytics_third: false, marketing: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u: any = await auth.me();
        if (u?.cookie_consent) setC({ ...c, ...u.cookie_consent });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api<any>("/me/cookie-consent", {
        method: "POST",
        body: JSON.stringify({
          technical: true,
          analytics_first: c.analytics_first,
          analytics_third: c.analytics_third,
          marketing: c.marketing,
        }),
      });
      if (Platform.OS === "web") window.alert("Preferenze salvate");
      else Alert.alert("Preferenze salvate");
      router.back();
    } catch (e: any) {
      if (Platform.OS === "web") window.alert(`Errore: ${e?.message || "-"}`);
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
        <Text style={s.headerTitle}>Preferenze cookie</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={s.intro}>
          {"Gestisci quali categorie di cookie desideri autorizzare. La modifica ha effetto immediato."}
        </Text>

        <View style={s.pref}>
          <View style={{ flex: 1 }}>
            <Text style={s.prefTitle}>Cookie tecnici</Text>
            <Text style={s.prefBody}>{"Indispensabili per il funzionamento dell'app (login, preferenze). Sempre attivi."}</Text>
          </View>
          <Switch value={true} disabled trackColor={{ true: colors.brandPrimary, false: colors.border }} thumbColor={colors.onBrandPrimary} />
        </View>

        <View style={s.pref}>
          <View style={{ flex: 1 }}>
            <Text style={s.prefTitle}>Analitici (prima parte, IP anonimizzato)</Text>
            <Text style={s.prefBody}>{"Statistiche aggregate anonime per migliorare l'app."}</Text>
          </View>
          <Switch
            value={c.analytics_first}
            onValueChange={(v) => setC({ ...c, analytics_first: v })}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            thumbColor={c.analytics_first ? colors.onBrandPrimary : colors.muted}
          />
        </View>

        <View style={s.pref}>
          <View style={{ flex: 1 }}>
            <Text style={s.prefTitle}>Analitici di terze parti</Text>
            <Text style={s.prefBody}>{"Strumenti forniti da provider esterni."}</Text>
          </View>
          <Switch
            value={c.analytics_third}
            onValueChange={(v) => setC({ ...c, analytics_third: v })}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            thumbColor={c.analytics_third ? colors.onBrandPrimary : colors.muted}
          />
        </View>

        <View style={s.pref}>
          <View style={{ flex: 1 }}>
            <Text style={s.prefTitle}>Profilazione / Marketing</Text>
            <Text style={s.prefBody}>{"Oggi non attivi. In futuro solo con il tuo consenso esplicito."}</Text>
          </View>
          <Switch
            value={c.marketing}
            onValueChange={(v) => setC({ ...c, marketing: v })}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            thumbColor={c.marketing ? colors.onBrandPrimary : colors.muted}
          />
        </View>

        <Pressable onPress={save} disabled={saving} style={s.saveBtn}>
          <Text style={s.saveTxt}>{saving ? "Salvataggio…" : "Salva preferenze"}</Text>
        </Pressable>

        {c.decided_at ? (
          <Text style={s.meta}>Ultimo aggiornamento: {new Date(c.decided_at).toLocaleString("it-IT")}</Text>
        ) : null}
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
  intro: {
    color: colors.onSurfaceSecondary,
    fontSize: 14, lineHeight: 21, marginBottom: spacing.md,
  },
  pref: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prefTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  prefBody: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  saveTxt: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 },
  meta: {
    color: colors.muted, fontSize: 11, marginTop: spacing.md, textAlign: "center", fontStyle: "italic",
  },
});
