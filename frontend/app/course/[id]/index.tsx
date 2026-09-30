import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable, TextInput,
  ActivityIndicator, RefreshControl, Alert, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api, auth } from "@/src/api";
import { RichViewer } from "@/src/RichEditor";
import GatedLanding from "@/src/GatedLanding";
import ShareButton from "@/src/ShareButton";
import FabMenu from "@/src/FabMenu";

type CourseDetail = {
  course: {
    id: string; title: string; cover_url: string; description_html: string;
    kind: "base" | "premium"; price: number; area_name: string | null;
    topic_count: number; has_quiz: boolean;
    promo: { active: boolean; price_promo?: number | null };
  };
  preview?: boolean;
  topics_summary: { id: string; title: string; kind: string; order: number }[];
  enrolled: boolean;
  enrollment?: {
    quiz_passed: boolean;
    quiz_attempts: number;
    certificate_id: string | null;
  };
};

const KIND_LABELS: Record<string, string> = {
  presentazione: "Presentazione",
  apertura: "Apertura",
  modulo: "Modulo",
  laboratorio: "Laboratorio",
  sintesi: "Sintesi",
  ponte: "Ponte",
  bibliografia: "Bibliografia",
};

function toast(t: string, m?: string) {
  const text = m ? `${t}\n\n${m}` : t;
  if (Platform.OS === "web") { if (typeof window !== "undefined") window.alert(text); return; }
  Alert.alert(t, m);
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [authChecked, setAuthChecked] = useState<null | boolean>(null);
  useEffect(() => {
    auth.hasToken().then((yes) => setAuthChecked(yes));
  }, []);

  const { data, refetch, isFetching, isLoading } = useQuery({
    queryKey: ["u-course", id],
    queryFn: () => api<CourseDetail>(`/courses/${id}`),
    enabled: !!id && authChecked === true,
    refetchOnMount: "always",
  });

  const [coupon, setCoupon] = useState("");
  const [couponInfo, setCouponInfo] = useState<{ code: string; percent_off: number } | null>(null);
  const [couponErr, setCouponErr] = useState("");
  const [applying, setApplying] = useState(false);
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const [purchaseEmail, setPurchaseEmail] = useState("");

  const applyCoupon = async () => {
    setCouponErr("");
    if (!coupon.trim()) return;
    setApplying(true);
    try {
      const r = await api<any>("/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code: coupon.trim(), course_id: id }),
      });
      setCouponInfo({ code: r.code, percent_off: r.percent_off });
    } catch (e: any) {
      setCouponInfo(null);
      setCouponErr(e?.message || "Codice non valido");
    } finally {
      setApplying(false);
    }
  };

  const enroll = async () => {
    try {
      await api(`/courses/${id}/enroll`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["u-course", id] });
      qc.invalidateQueries({ queryKey: ["u-enrollments"] });
      router.push(`/course/${id}/read` as any);
    } catch (e: any) {
      toast("Impossibile iscriversi", e?.message || "Riprova.");
    }
  };

  // Guest visitor → gated landing (marketing preview, no content leak)
  if (authChecked === false && id) {
    return <GatedLanding contentType="course" contentId={id as string} />;
  }

  if (isLoading || !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  const { course, topics_summary, enrolled, enrollment, preview } = data;
  const isPremium = course.kind === "premium";
  const isPromo = course.promo?.active;
  const basePrice = isPromo && typeof course.promo?.price_promo === "number"
    ? course.promo.price_promo!
    : course.price;
  const discountedPrice = couponInfo
    ? Math.round(basePrice * (100 - couponInfo.percent_off) / 100 * 100) / 100
    : basePrice;
  const showPrice = discountedPrice.toFixed(2);

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
    >
      {/* Hero */}
      <View style={styles.heroWrap}>
        {course.cover_url ? <Image source={{ uri: course.cover_url }} style={styles.hero} /> : null}
        <View style={styles.heroFade} />
        <Pressable
          onPress={() => router.back()}
          style={[styles.back, { top: insets.top + 8 }]}
          hitSlop={10}
        >
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <View style={{ position: "absolute", right: 12, top: insets.top + 8 }}>
          <ShareButton
            contentType="course"
            contentId={id as string}
            title={course.title}
            size="sm"
          />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>{isPremium ? "👑  " : ""}{course.title}</Text>
          {course.area_name ? <Text style={styles.heroArea}>{course.area_name}</Text> : null}
        </View>
      </View>

      {/* Meta */}
      <View style={styles.metaBar}>
        {isPremium ? (
          isPromo && typeof course.promo?.price_promo === "number" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.strike}>{course.price.toFixed(2)} €</Text>
              <Text style={styles.priceBig}>{showPrice} €</Text>
              <View style={styles.promoTag}><Text style={styles.promoTagTxt}>PROMO</Text></View>
            </View>
          ) : (
            <Text style={styles.priceBig}>{course.price.toFixed(2)} €</Text>
          )
        ) : (
          <Text style={styles.free}>💚  Gratuito — incluso nell&apos;abbonamento</Text>
        )}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
          <Text style={styles.metaSm}>{course.topic_count} argomenti</Text>
          {course.has_quiz ? <Text style={styles.metaSm}>· Quiz + certificato</Text> : null}
        </View>
      </View>

      {/* Description */}
      {course.description_html ? (
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <Text style={styles.sectionTitle}>Descrizione</Text>
          <View style={{ height: 280, marginTop: 6 }}>
            <RichViewer html={course.description_html} />
          </View>
        </View>
      ) : null}

      {/* Topics summary */}
      <Text style={styles.sectionTitle}>Programma del corso</Text>
      {topics_summary.length === 0 ? (
        <Text style={styles.empty}>In allestimento.</Text>
      ) : (
        topics_summary.map((t, i) => (
          <View key={t.id} style={styles.topicRow}>
            <View style={styles.topicNum}><Text style={styles.topicNumTxt}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.topicTitle} numberOfLines={2}>{t.title}</Text>
              <Text style={styles.topicKind}>{KIND_LABELS[t.kind] || t.kind}</Text>
            </View>
            {!enrolled ? <Text style={styles.locked}>🔒</Text> : null}
          </View>
        ))
      )}

      {/* Sticky CTA */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        {preview ? (
          <View style={styles.previewBanner}>
            <Text style={styles.previewTitle}>🕒  Corso in preparazione</Text>
            <Text style={styles.previewBody}>
              {"Questo corso non è ancora disponibile: sarà presto attivato. Torna a trovarci!"}
              {isPremium && (course.price || 0) > 0 ? ` Quando sarà attivo potrai acquistarlo a € ${showPrice}.` : ""}
            </Text>
          </View>
        ) : !enrolled && isPremium ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginBottom: 6 }}>
              Hai un codice sconto?
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                testID="course-coupon-input"
                value={coupon}
                onChangeText={setCoupon}
                placeholder="CODICE"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                style={styles.couponInput}
              />
              <Pressable
                testID="course-coupon-apply"
                onPress={applyCoupon}
                disabled={applying}
                style={styles.couponBtn}
              >
                <Text style={styles.couponBtnTxt}>{applying ? "…" : "Applica"}</Text>
              </Pressable>
            </View>
            {couponInfo ? (
              <Text style={{ color: colors.brandPrimary, marginTop: 6, fontSize: 12 }}>
                ✓ Codice {couponInfo.code} applicato: -{couponInfo.percent_off}%
              </Text>
            ) : couponErr ? (
              <Text style={{ color: colors.error, marginTop: 6, fontSize: 12 }}>{couponErr}</Text>
            ) : null}
          </View>
        ) : null}
        {preview ? null : enrolled ? (
          <Pressable onPress={() => router.push(`/course/${id}/read` as any)} style={styles.ctaBtn}>
            <Text style={styles.ctaTxt}>
              {enrollment?.quiz_passed ? "Rivedi il corso ›" : "Continua il corso ›"}
            </Text>
          </Pressable>
        ) : isPremium ? (
          <>
            <View style={{ marginBottom: spacing.sm }}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginBottom: 6 }}>
                Email per ricevuta d&apos;acquisto <Text style={{ color: colors.brandPrimary }}>*</Text>
              </Text>
              <TextInput
                testID="course-purchase-email"
                value={purchaseEmail}
                onChangeText={setPurchaseEmail}
                placeholder="mario.rossi@email.it"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.couponInput}
              />
            </View>
            <Pressable
              testID="withdrawal-consent"
              onPress={() => setWithdrawalConsent((v) => !v)}
              style={styles.consentRow}
            >
              <View style={[styles.checkbox, withdrawalConsent && styles.checkboxOn]}>
                {withdrawalConsent ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.consentTxt}>
                {"Acconsento all'erogazione immediata del corso digitale e dichiaro di essere consapevole che, con l'inizio della fruizione del contenuto, perdo il diritto di recesso ai sensi dell'art. 59, comma 1, lett. o) del Codice del Consumo (D.Lgs. 206/2005). "}
                <Text
                  onPress={() => router.push("/terms")}
                  style={styles.consentLink}
                >
                  Leggi i termini
                </Text>
              </Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (!withdrawalConsent) {
                  toast(
                    "Consenso richiesto",
                    "Per procedere devi accettare la clausola sul recesso.",
                  );
                  return;
                }
                if (!purchaseEmail.trim() || !purchaseEmail.includes("@")) {
                  toast("Email richiesta", "Inserisci un'email valida per la ricevuta.");
                  return;
                }
                try {
                  const res = await api<any>("/payments/stripe/checkout/course", {
                    method: "POST",
                    body: JSON.stringify({
                      course_id: id,
                      coupon_code: couponInfo?.code,
                      email: purchaseEmail.trim().toLowerCase(),
                    }),
                  });
                  const WebBrowser = await import("expo-web-browser");
                  if (Platform.OS === "web") {
                    if (typeof window !== "undefined") window.location.href = res.url;
                  } else {
                    await WebBrowser.openBrowserAsync(res.url, { showTitle: true });
                  }
                } catch (e: any) {
                  toast("Errore pagamento", e?.message || "Riprova più tardi");
                }
              }}
              style={[styles.ctaBtn, styles.ctaPremium, !withdrawalConsent && styles.ctaDisabled]}
            >
              <Text style={styles.ctaTxt}>👑  Acquista — {showPrice} €</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={enroll} style={styles.ctaBtn}>
            <Text style={styles.ctaTxt}>Inizia il corso</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
    <FabMenu />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  heroWrap: { height: 260, backgroundColor: colors.surfaceSecondary },
  hero: { width: "100%", height: "100%", position: "absolute" },
  heroFade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  back: {
    position: "absolute", left: spacing.xl, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
  },
  backTxt: { color: "#fff", fontSize: 22, fontWeight: "600" },
  heroText: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: spacing.xl },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 28, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  heroArea: { color: colors.brandTertiary, fontSize: 12, marginTop: 6, letterSpacing: 1, fontWeight: "700" },
  metaBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  priceBig: { color: colors.brandPrimary, fontSize: 22, fontWeight: "800" },
  strike: { color: colors.muted, fontSize: 15, textDecorationLine: "line-through" },
  free: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
  promoTag: { backgroundColor: colors.brandPrimary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  promoTagTxt: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "800" },
  metaSm: { color: colors.muted, fontSize: 12 },
  sectionTitle: {
    color: colors.brandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 2,
    textTransform: "uppercase", paddingHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: 4,
  },
  empty: { color: colors.muted, fontStyle: "italic", padding: spacing.xl },
  topicRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  topicNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  topicNumTxt: { color: colors.onBrandPrimary, fontWeight: "800" },
  topicTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  topicKind: { color: colors.muted, fontSize: 11, marginTop: 2 },
  locked: { fontSize: 18 },
  cta: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, gap: 8,
  },
  ctaBtn: {
    backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
  },
  ctaPremium: {},
  ctaTxt: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  couponInput: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  couponBtn: {
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  couponBtnTxt: { color: colors.brandPrimary, fontWeight: "700", fontSize: 13 },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: spacing.sm,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: colors.brandPrimary },
  checkboxTick: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "800" },
  consentTxt: {
    flex: 1,
    color: colors.onSurfaceSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  consentLink: {
    color: colors.brandPrimary,
    fontWeight: "700",
  },
  ctaDisabled: { opacity: 0.45 },
  previewBanner: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  previewTitle: {
    color: colors.brandPrimary,
    fontWeight: "800",
    fontSize: 15,
  },
  previewBody: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
