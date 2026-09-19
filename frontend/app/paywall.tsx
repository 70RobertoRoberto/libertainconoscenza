import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { GoldButton, Muted, Card } from "@/src/ui";

type Plan = { key: string; months: number; days: number; price_eur: number; label: string };

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState("12m");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponInfo, setCouponInfo] = useState<{ code: string; percent_off: number } | null>(null);
  const [couponErr, setCouponErr] = useState("");

  useEffect(() => {
    api<{ plans: Record<string, any> }>("/plans").then((r) => {
      const ORDER = ["24h", "1w", "3m", "6m", "12m"];
      const arr = Object.entries(r.plans)
        .map(([k, v]: any) => ({ key: k, ...v }))
        .sort((a, b) => {
          const ia = ORDER.indexOf(a.key);
          const ib = ORDER.indexOf(b.key);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
      setPlans(arr);
    });
  }, []);

  const submit = async () => {
    setLoading(true);
    setMsg("");
    try {
      const r = await api<any>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: selected, coupon_code: couponInfo?.code }),
      });
      setMsg(
        r.message ||
          "✅ Richiesta inviata!\n\nLa tua richiesta di abbonamento è stata registrata.\nSarai contattato al più presto per completare il pagamento e attivare l'accesso Premium.",
      );
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const applyCoupon = async () => {
    setCouponErr("");
    if (!coupon.trim()) return;
    try {
      const r = await api<any>("/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code: coupon.trim() }),
      });
      setCouponInfo({ code: r.code, percent_off: r.percent_off });
    } catch (e: any) {
      setCouponInfo(null);
      setCouponErr(e.message);
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

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{"ℹ️  Come funziona l'attivazione"}</Text>
          <Text style={styles.infoBody}>
            Scegli il piano e invia la richiesta. Ti contatteremo per completare il pagamento
            (bonifico, contanti o accordo diretto) e attiveremo il tuo accesso Premium entro poche ore.
          </Text>
        </View>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {plans.map((p) => {
            const active = p.key === selected;
            const best = p.key === "12m";
            const discounted = couponInfo ? Math.round(p.price_eur * (100 - couponInfo.percent_off) / 100) : p.price_eur;
            // Compact caption per plan (avoid weird "€10/mese" for a 24h trial)
            let caption = "";
            if (p.key === "24h") caption = "accesso di 24 ore";
            else if (p.key === "1w") caption = "accesso di 7 giorni";
            else if (p.key === "12m") caption = "solo €75/mese";
            else if (p.months && p.months > 0) caption = `€${(p.price_eur / p.months).toFixed(0)}/mese`;
            else caption = `${p.days || ""} giorni`;
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
                  <Muted style={{ marginTop: 4 }}>{caption}</Muted>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {couponInfo ? (
                    <Text style={styles.oldPrice}>€{p.price_eur}</Text>
                  ) : null}
                  <Text style={styles.price}>€{discounted}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, marginBottom: spacing.sm }}>
            Hai un codice sconto?
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              testID="coupon-input"
              value={coupon}
              onChangeText={setCoupon}
              placeholder="CODICE"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={styles.coupon}
            />
            <Pressable testID="apply-coupon" onPress={applyCoupon} style={styles.applyBtn}>
              <Text style={styles.applyTxt}>Applica</Text>
            </Pressable>
          </View>
          {couponInfo ? (
            <Text style={{ color: colors.brandPrimary, marginTop: spacing.sm }}>
              ✓ Codice {couponInfo.code} applicato: -{couponInfo.percent_off}%
            </Text>
          ) : couponErr ? (
            <Text style={{ color: colors.error, marginTop: spacing.sm }}>{couponErr}</Text>
          ) : null}
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
          label={loading ? "Invio in corso…" : "Richiedi attivazione"}
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
  oldPrice: {
    color: colors.muted,
    fontSize: 13,
    textDecorationLine: "line-through",
  },
  coupon: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  applyBtn: {
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    justifyContent: "center",
  },
  applyTxt: { color: colors.brandPrimary, fontWeight: "700" },
  infoBox: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  infoTitle: { color: colors.brandPrimary, fontWeight: "700", fontSize: 14 },
  infoBody: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 6, lineHeight: 19 },
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
