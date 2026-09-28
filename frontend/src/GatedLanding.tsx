/**
 * GatedLanding — Landing page pubblica per contenuti condivisi via link
 * a utenti non ancora registrati/loggati.
 *
 * Mostra: immagine + titolo + descrizione + tipo/categoria + prezzo (se corso Premium)
 * e i CTA "Registrati gratis" / "Accedi" che portano allo screen di auth.
 *
 * Il contenuto reale (audio, video, corpo articolo, capitoli corso) resta
 * protetto sul backend: questa view usa SOLO gli endpoint pubblici
 * `/api/public/{type}/{id}` che non ritornano payload consumabile.
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

type ContentType = "meditation" | "course" | "article";

type PublicPreview = {
  id: string;
  type: ContentType;
  title: string;
  cover_url: string;
  short_description: string;
  category?: string;
  duration_sec?: number;
  kind?: string;
  is_premium?: boolean;
  price_eur?: number;
  topics_count?: number;
  author?: string;
  is_active?: boolean;
};

type Props = {
  contentType: ContentType;
  contentId: string;
};

const TYPE_LABEL: Record<ContentType, string> = {
  meditation: "Meditazione guidata",
  course: "Corso",
  article: "Articolo",
};

const TYPE_ICON: Record<ContentType, string> = {
  meditation: "🧘",
  course: "🎓",
  article: "📖",
};

function fmtDuration(sec?: number): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}min` : `${h}h`;
}

export default function GatedLanding({ contentType, contentId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PublicPreview | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<PublicPreview>(`/public/${contentType}/${contentId}`);
        if (!cancelled) setData(r);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Contenuto non disponibile");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentType, contentId]);

  if (error) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <Text style={s.errEmoji}>🌱</Text>
        <Text style={s.errTitle}>Contenuto non trovato</Text>
        <Text style={s.subtle}>{error}</Text>
        <Pressable onPress={() => router.replace("/" as any)} style={s.btn}>
          <Text style={s.btnTxt}>Torna alla home</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  const duration = fmtDuration(data.duration_sec);
  const label = TYPE_LABEL[data.type] || TYPE_LABEL[contentType];
  const icon = TYPE_ICON[data.type] || TYPE_ICON[contentType];
  const showPrice = data.is_premium && (data.price_eur || 0) > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40 }}
    >
      {data.cover_url ? (
        <Image source={{ uri: data.cover_url }} style={s.hero} resizeMode="cover" />
      ) : (
        <View style={[s.hero, { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary }]}>
          <Text style={{ fontSize: 72 }}>{icon}</Text>
        </View>
      )}

      <View style={s.content}>
        <View style={s.pillRow}>
          <View style={s.pill}>
            <Text style={s.pillTxt}>
              {icon}  {label}
            </Text>
          </View>
          {data.category ? (
            <View style={s.pill}>
              <Text style={s.pillTxt}>{data.category}</Text>
            </View>
          ) : null}
          {duration ? (
            <View style={s.pill}>
              <Text style={s.pillTxt}>⏱ {duration}</Text>
            </View>
          ) : null}
        </View>

        <Text style={s.title}>{data.title}</Text>

        {data.author ? <Text style={s.author}>di {data.author}</Text> : null}

        {data.short_description ? (
          <Text style={s.desc}>{data.short_description}</Text>
        ) : null}

        {data.type === "course" && (data.topics_count || 0) > 0 ? (
          <Text style={s.metaLine}>📚  {data.topics_count} moduli inclusi</Text>
        ) : null}

        {showPrice ? (
          <View style={s.priceBox}>
            <Text style={s.priceLabel}>Prezzo del corso</Text>
            <Text style={s.priceValue}>{data.price_eur} €</Text>
          </View>
        ) : null}

        <View style={s.divider} />

        {/* Marketing card */}
        <View style={s.gateCard}>
          <Text style={s.gateEmoji}>🌿</Text>
          <Text style={s.gateTitle}>
            Entra in Libertà in Conoscenza
          </Text>
          <Text style={s.gateSub}>
            {data.type === "meditation" &&
              "Per ascoltare questa meditazione per intero, accedi al tuo cammino personale."}
            {data.type === "course" && !data.is_premium &&
              "Per seguire questo corso, iscriviti gratuitamente al percorso di consapevolezza."}
            {data.type === "course" && data.is_premium &&
              "Per accedere a questo corso Premium, iscriviti e sblocca il tuo percorso."}
            {data.type === "article" &&
              "Per leggere l'articolo completo, entra nella biblioteca di Libertà in Conoscenza."}
          </Text>

          <View style={s.benefits}>
            <Text style={s.benefitLine}>✓  100+ meditazioni guidate</Text>
            <Text style={s.benefitLine}>✓  Corsi con docenti esperti</Text>
            <Text style={s.benefitLine}>✓  Biblioteca sempre aggiornata</Text>
            <Text style={s.benefitLine}>✓  15 giorni di prova gratuita</Text>
            <Text style={s.benefitLine}>✓  Solo 12 €/anno, disdici quando vuoi</Text>
          </View>

          <Pressable
            onPress={() =>
              router.replace({
                pathname: "/register" as any,
                params: { redirect: `/${contentType === "meditation" ? "media" : contentType}/${contentId}` },
              })
            }
            style={s.ctaPrimary}
          >
            <Text style={s.ctaPrimaryTxt}>Registrati gratis</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.replace({
                pathname: "/login" as any,
                params: { redirect: `/${contentType === "meditation" ? "media" : contentType}/${contentId}` },
              })
            }
            style={s.ctaGhost}
          >
            <Text style={s.ctaGhostTxt}>Ho già un account · Accedi</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  hero: {
    width: "100%",
    height: 260,
    backgroundColor: colors.surfaceSecondary,
  },
  content: {
    padding: spacing.xl,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.md,
  },
  pill: {
    backgroundColor: colors.brandTertiary,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pillTxt: {
    color: colors.brandPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    color: colors.onSurface,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
    marginBottom: 4,
  },
  author: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: spacing.md,
  },
  desc: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  metaLine: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  priceBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
  },
  priceValue: {
    color: colors.brandPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.xl,
  },
  gateCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    alignItems: "center",
  },
  gateEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  gateTitle: {
    color: colors.brandPrimary,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  gateSub: {
    color: colors.onSurface,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  benefits: {
    alignSelf: "stretch",
    marginBottom: spacing.lg,
    gap: 6,
  },
  benefitLine: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
  },
  ctaPrimary: {
    alignSelf: "stretch",
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  ctaPrimaryTxt: {
    color: colors.onBrandPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  ctaGhost: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  ctaGhostTxt: {
    color: colors.brandPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  btn: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  btnTxt: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
  },
  subtle: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  errEmoji: { fontSize: 60 },
  errTitle: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
});
