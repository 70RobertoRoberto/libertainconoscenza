import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { GoldButton, Muted, Card } from "@/src/ui";

type Plan = { key: string; months: number; price_eur: number; label: string };

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState("12m");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<{ plans: Record<string, any> }>("/plans").then((r) => {
      const arr = Object.entries(r.plans).map(([k, v]: any) => ({ key: k, ...v }));
      setPlans(arr);
    });
  }, []);

  const submit = async () => {
    setLoading(true);
    setMsg("");
    try {
      const r = await api<any>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: selected }),
      });
      setMsg(r.message || "Ordine registrato. Attendi l'attivazione.");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{
        paddingTop: insets.top + spacing.xl,
        paddingBottom: 140 + insets.bottom,
        paddingHorizontal: spacing.xl,
      }}>
        <Pressable testID="close-paywall" onPress={() => router.back()} style={styles.close}>
          <Text style={{ color: colors.onSurface, fontSize: 20 }}>✕</Text>
        </Pressable>
        <Text style={styles.h}>Sblocca la Conoscenza Avanzata</Text>
        <Muted style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Accesso completo a corsi, meditazioni e contenuti premium.
        </Muted>

        {["Corsi guidati con Maestri", "Meditazioni esclusive audio", "Articoli approfonditi", "Nessuna interruzione", "Accesso multi-dispositivo"].map((b) => (
          <View key={b} style={styles.benefit}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.benefitTxt}>{b}</Text>
          </View>
        ))}

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {plans.map((p) => {
            const active = p.key === selected;
            const best = p.key === "12m";
            return (
              <Pressable
                key={p.key}
                testID={`plan-${p.key}`}
                onPress={() => setSelected(p.key)}
                style={[styles.plan, active && styles.planActive]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={styles.planLbl}>{p.label}</Text>
                    {best ? (
                      <View style={styles.best}>
                        <Text style={styles.bestTxt}>MIGLIOR VALORE</Text>
                      </View>
                    ) : null}
                  </View>
                  <Muted style={{ marginTop: 4 }}>
                    {p.months === 12 ? "solo €75/mese" : `€${(p.price_eur / p.months).toFixed(0)}/mese`}
                  </Muted>
                </View>
                <Text style={styles.price}>€{p.price_eur}</Text>
              </Pressable>
            );
          })}
        </View>

        {msg ? (
          <Card style={{ marginTop: spacing.xl, borderColor: colors.brandPrimary }}>
            <Text style={{ color: colors.brandPrimary, fontWeight: "600" }}>{msg}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <GoldButton
          testID="checkout-btn"
          label={loading ? "Attendere…" : "Continua con l'abbonamento"}
          onPress={submit}
          loading={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  close: { alignSelf: "flex-end", padding: spacing.sm },
  h: { color: colors.onSurface, fontSize: 28, fontWeight: "700", marginTop: spacing.md },
  benefit: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: spacing.md },
  check: {
    color: colors.brandPrimary,
    fontSize: 16,
    fontWeight: "800",
    width: 24,
  },
  benefitTxt: { color: colors.onSurfaceSecondary, fontSize: 15, flex: 1 },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  planActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  planLbl: { color: colors.onSurface, fontSize: 17, fontWeight: "700" },
  price: { color: colors.brandPrimary, fontSize: 22, fontWeight: "800" },
  best: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  bestTxt: { color: colors.onBrandPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
});
