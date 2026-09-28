import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api, auth } from "@/src/api";
import { GoldButton, Muted, Card } from "@/src/ui";

type Plan = { key: string; months: number; days: number; price_eur: number; label: string };
type Sub = { status?: string; days_remaining?: number | null; active?: boolean };

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponInfo, setCouponInfo] = useState<{ code: string; percent_off: number } | null>(null);
  const [couponErr, setCouponErr] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    api<{ plans: Record<string, any> }>("/plans")
      .then((r) => {
        const list = Object.entries(r.plans).map(([k, v]: any) => ({ key: k, ...v }));
        setPlan(list[0] || null);
      })
      .catch(() => {});
    auth.me().then((u: any) => {
      setSub(u?.subscription);
      if (u?.email) setEmail(u.email);
    }).catch(() => {});
  }, []);

  const submit = async () => {
    if (!plan) return;
    if (!email.trim() || !email.includes("@") || !email.split("@")[1]?.includes(".")) {
      setMsg("⚠️ Inserisci un'email valida per ricevere la ricevuta d'acquisto");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      // Step 1 — create pending order on our backend
      const r = await api<any>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan: plan.key,
          coupon_code: couponInfo?.code,
          email: email.trim().toLowerCase(),
        }),
      });
      // Step 2 — obtain Stripe Checkout Session URL
      const stripeRes = await api<any>(
        `/payments/stripe/checkout/subscription?order_id=${encodeURIComponent(r.order_id)}`,
        { method: "POST" },
      );
      // Step 3 — redirect user to Stripe hosted checkout
      const WebBrowser = await import("expo-web-browser");
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.location.href = stripeRes.url;
        }
      } else {
        await WebBrowser.openBrowserAsync(stripeRes.url, { showTitle: true, enableBarCollapsing: true });
      }
      setMsg("Ti stiamo reindirizzando a Stripe per completare il pagamento in sicurezza…");
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
        body: JSON.stringify({ code: coupon.trim(), plan: plan?.key }),
      });
      setCouponInfo({ code: r.code, percent_off: r.percent_off });
    } catch (e: any) {
      setCouponInfo(null);
      setCouponErr(e.message);
    }
  };

  const discounted = plan && couponInfo
    ? Math.round(plan.price_eur * (100 - couponInfo.percent_off) / 100)
    : plan?.price_eur ?? 0;
  const showTrialBanner = sub?.status === "trial" && (sub?.days_remaining ?? 0) > 0;
  const trialDays = sub?.days_remaining ?? 0;

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

        {showTrialBanner ? (
          <View style={styles.trialBox}>
            <Text style={styles.trialTitle}>🎁 Prova gratuita attiva</Text>
            <Text style={styles.trialBody}>
              Ti restano <Text style={{ fontWeight: "800" }}>{trialDays} {trialDays === 1 ? "giorno" : "giorni"}</Text> di accesso completo.
              {" "}{"Sottoscrivi ora l'abbonamento per continuare senza interruzioni."}
            </Text>
          </View>
        ) : null}

        {["Corsi guidati con Maestri", "Meditazioni esclusive audio", "Articoli approfonditi", "Nessuna interruzione", "Accesso multi-dispositivo"].map((b) => (
          <View key={b} style={styles.benefit}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.benefitTxt}>{b}</Text>
          </View>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{"🔒  Pagamento sicuro con Stripe"}</Text>
          <Text style={styles.infoBody}>
            {"Il pagamento avviene tramite Stripe, uno dei sistemi più sicuri al mondo. Puoi pagare con Visa, Mastercard, American Express e carte prepagate. Attivazione istantanea al termine della transazione, ricevi la ricevuta via email."}
          </Text>
        </View>

        {plan ? (
          <View style={styles.planCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={styles.planLbl}>Abbonamento Annuale</Text>
                <View style={styles.best}>
                  <Text style={styles.bestTxt}>MIGLIOR VALORE</Text>
                </View>
              </View>
              <Muted style={{ marginTop: 4 }}>Accesso completo per 12 mesi · 1€/mese</Muted>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {couponInfo ? (
                <Text style={styles.oldPrice}>€{plan.price_eur}</Text>
              ) : null}
              <Text style={styles.price}>€{discounted}</Text>
              <Muted style={{ fontSize: 11 }}>/anno</Muted>
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xl }}>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, marginBottom: spacing.sm }}>
            Email per ricevuta d&apos;acquisto <Text style={{ color: colors.brandPrimary }}>*</Text>
          </Text>
          <TextInput
            testID="paywall-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="mario.rossi@email.it"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.coupon}
          />
        </View>

        <View style={{ marginTop: spacing.md }}>
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
          label={loading ? "Reindirizzamento…" : "Paga in sicurezza · Stripe"}
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
  planCard: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
  },
  planLbl: { color: colors.onSurface, fontSize: 17, fontWeight: "700" },
  price: { color: colors.brandPrimary, fontSize: 32, fontWeight: "800" },
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
  trialBox: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    marginBottom: spacing.md,
  },
  trialTitle: { color: colors.brandPrimary, fontWeight: "800", fontSize: 15 },
  trialBody: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 6, lineHeight: 19 },
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
