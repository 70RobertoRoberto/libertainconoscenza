import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView, Switch, Platform,
} from "react-native";
import { useRouter, useSegments } from "expo-router";
import { colors, spacing, radius } from "@/src/theme";
import { api, auth } from "@/src/api";

/**
 * Global cookie banner shown on first login after registration.
 * Reads user.cookie_consent from /auth/me. If null and user is logged in,
 * displays a non-dismissible banner at the bottom with three actions:
 * - Accetta tutto / Rifiuta tutto / Personalizza.
 *
 * On save, POST /me/cookie-consent and hide.
 */
export default function CookieBanner() {
  const router = useRouter();
  const segments = useSegments();
  const [visible, setVisible] = useState(false);
  const [decided, setDecided] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [analyticsFirst, setAnalyticsFirst] = useState(true);
  const [analyticsThird, setAnalyticsThird] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Skip banner on login/register/onboarding screens — check only when
    // user is authenticated and inside the app.
    if (decided) return;
    const seg = (segments || []).join("/");
    if (
      !seg ||
      seg.startsWith("login") ||
      seg.startsWith("register") ||
      seg.startsWith("forgot") ||
      seg.startsWith("reset") ||
      seg.startsWith("onboarding")
    ) return;
    let cancelled = false;
    (async () => {
      try {
        const has = await auth.hasToken();
        if (!has) return;
        const u: any = await auth.me();
        if (cancelled) return;
        if (u && !u.cookie_consent) setVisible(true);
        else if (u && u.cookie_consent) setDecided(true);
      } catch {
        // Not logged in — skip
      }
    })();
    return () => { cancelled = true; };
  }, [segments, decided]);

  const save = async (payload: {
    analytics_first: boolean;
    analytics_third: boolean;
    marketing: boolean;
  }) => {
    setSaving(true);
    try {
      await api<any>("/me/cookie-consent", {
        method: "POST",
        body: JSON.stringify({ technical: true, ...payload }),
      });
      setVisible(false);
      setCustomOpen(false);
      setDecided(true);
    } catch (e: any) {
      if (Platform.OS === "web" && typeof window !== "undefined") window.alert(`Errore: ${e?.message || "-"}`);
    } finally {
      setSaving(false);
    }
  };

  const acceptAll = () => save({ analytics_first: true, analytics_third: true, marketing: true });
  const rejectAll = () => save({ analytics_first: false, analytics_third: false, marketing: false });
  const saveCustom = () => save({
    analytics_first: analyticsFirst,
    analytics_third: analyticsThird,
    marketing,
  });

  if (!visible) return null;

  return (
    <>
      <View pointerEvents="box-none" style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>🍪  Rispetto della tua privacy</Text>
          <Text style={s.body}>
            {"Utilizziamo cookie tecnici e, previa tua scelta, cookie analitici e di marketing per migliorare la tua esperienza. Puoi accettare tutto, rifiutare tutto (verranno attivati solo i cookie tecnici indispensabili) oppure personalizzare le tue preferenze."}
          </Text>
          <Pressable onPress={() => router.push("/cookies")}>
            <Text style={s.link}>Leggi la Cookie Policy →</Text>
          </Pressable>

          <View style={s.row}>
            <Pressable
              testID="cookie-reject"
              onPress={rejectAll}
              disabled={saving}
              style={[s.btn, s.btnOutline]}
            >
              <Text style={s.btnOutlineTxt}>Rifiuta tutto</Text>
            </Pressable>
            <Pressable
              testID="cookie-custom"
              onPress={() => setCustomOpen(true)}
              disabled={saving}
              style={[s.btn, s.btnOutline]}
            >
              <Text style={s.btnOutlineTxt}>Personalizza</Text>
            </Pressable>
            <Pressable
              testID="cookie-accept"
              onPress={acceptAll}
              disabled={saving}
              style={[s.btn, s.btnPrimary]}
            >
              <Text style={s.btnPrimaryTxt}>Accetta tutto</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Modal visible={customOpen} transparent animationType="slide" onRequestClose={() => setCustomOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
              <Text style={s.title}>Personalizza cookie</Text>
              <Text style={s.body}>{"Scegli quali categorie di cookie autorizzare. La tua scelta è modificabile in qualsiasi momento dal profilo."}</Text>

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
                  <Text style={s.prefBody}>{"Statistiche aggregate anonime che ci aiutano a migliorare l'app."}</Text>
                </View>
                <Switch
                  testID="pref-analytics-first"
                  value={analyticsFirst}
                  onValueChange={setAnalyticsFirst}
                  trackColor={{ true: colors.brandPrimary, false: colors.border }}
                  thumbColor={analyticsFirst ? colors.onBrandPrimary : colors.muted}
                />
              </View>

              <View style={s.pref}>
                <View style={{ flex: 1 }}>
                  <Text style={s.prefTitle}>Analitici di terze parti</Text>
                  <Text style={s.prefBody}>{"Strumenti forniti da provider esterni. Attivali solo se vuoi contribuire a metriche più approfondite."}</Text>
                </View>
                <Switch
                  testID="pref-analytics-third"
                  value={analyticsThird}
                  onValueChange={setAnalyticsThird}
                  trackColor={{ true: colors.brandPrimary, false: colors.border }}
                  thumbColor={analyticsThird ? colors.onBrandPrimary : colors.muted}
                />
              </View>

              <View style={s.pref}>
                <View style={{ flex: 1 }}>
                  <Text style={s.prefTitle}>Profilazione / Marketing</Text>
                  <Text style={s.prefBody}>{"Oggi non attivi. In futuro potranno essere usati solo con il tuo consenso esplicito."}</Text>
                </View>
                <Switch
                  testID="pref-marketing"
                  value={marketing}
                  onValueChange={setMarketing}
                  trackColor={{ true: colors.brandPrimary, false: colors.border }}
                  thumbColor={marketing ? colors.onBrandPrimary : colors.muted}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.lg }}>
                <Pressable onPress={() => setCustomOpen(false)} disabled={saving} style={[s.btn, s.btnOutline]}>
                  <Text style={s.btnOutlineTxt}>Annulla</Text>
                </Pressable>
                <Pressable testID="pref-save" onPress={saveCustom} disabled={saving} style={[s.btn, s.btnPrimary]}>
                  <Text style={s.btnPrimaryTxt}>Salva preferenze</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    padding: spacing.md,
    zIndex: 9999,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "800",
  },
  body: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  link: {
    color: colors.brandPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.md,
    flexWrap: "wrap",
  },
  btn: {
    flexGrow: 1,
    flexBasis: 90,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnPrimaryTxt: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 13 },
  btnOutline: {
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    backgroundColor: "transparent",
  },
  btnOutlineTxt: { color: colors.brandPrimary, fontWeight: "700", fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    maxHeight: "85%",
  },
  pref: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prefTitle: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "700",
  },
  prefBody: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
});
