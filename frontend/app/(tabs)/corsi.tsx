import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

type Area = { id: string; name: string; slug: string };
type Course = {
  id: string;
  title: string;
  cover_url: string;
  description_html: string;
  kind: "base" | "premium";
  price: number;
  area_id: string | null;
  area_name: string | null;
  is_active: boolean;
  promo: { active: boolean; price_promo?: number | null; ends_at?: string | null };
  topic_count: number;
  has_quiz: boolean;
};

/**
 * Vetrina Corsi lato utente:
 *  - hero + descrizione introduttiva
 *  - chip filtro per Aree Tematiche
 *  - "Promozione" in cima (corsi con promo attiva)
 *  - "Corsi Attivi" (griglia) — 👑 per Premium, "Gratuito" per Base
 *  - "Prossimi Arrivi" (bozze) — teaser
 */
export default function CorsiScreen() {
  const router = useRouter();
  const [areaId, setAreaId] = useState<string | null>(null);

  const { data: areasData } = useQuery({
    queryKey: ["u-areas"],
    queryFn: () => api<{ items: Area[] }>("/course-areas"),
  });
  const areas = areasData?.items || [];

  const { data: coursesData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["u-courses", areaId],
    queryFn: () =>
      api<{ items: Course[] }>(areaId ? `/courses?area_id=${encodeURIComponent(areaId)}` : "/courses"),
  });
  const courses = useMemo(() => coursesData?.items || [], [coursesData]);

  const { data: upcomingData } = useQuery({
    queryKey: ["u-upcoming"],
    queryFn: () => api<{ items: Course[] }>("/courses/upcoming"),
  });
  const upcoming = upcomingData?.items || [];

  const promo = useMemo(() => courses.filter((c) => c.promo?.active), [courses]);
  const regular = useMemo(() => courses.filter((c) => !c.promo?.active), [courses]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Corsi</Text>
          <Text style={styles.title}>Percorsi formativi</Text>
          <Text style={styles.subtitle}>
            Contenuti strutturati in argomenti, con quiz finale e certificato di completamento.
            I corsi Base sono inclusi nell&apos;abbonamento annuale; i corsi 👑 Premium si acquistano
            singolarmente.
          </Text>
        </View>

        {/* Area filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="Tutte" active={!areaId} onPress={() => setAreaId(null)} />
          {areas.map((a) => (
            <Chip key={a.id} label={a.name} active={areaId === a.id} onPress={() => setAreaId(a.id)} />
          ))}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Promozione */}
            {promo.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>🔥  Promozione</Text>
                {promo.map((c) => (
                  <CourseCard key={c.id} course={c} onPress={() => router.push(`/course/${c.id}` as any)} large />
                ))}
              </>
            ) : null}

            {/* Corsi attivi */}
            <Text style={styles.sectionTitle}>Corsi disponibili</Text>
            {regular.length === 0 ? (
              <Text style={styles.empty}>Nessun corso attivo in questa area.</Text>
            ) : (
              regular.map((c) => (
                <CourseCard key={c.id} course={c} onPress={() => router.push(`/course/${c.id}` as any)} />
              ))
            )}

            {/* Prossimi arrivi */}
            {upcoming.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Prossimi arrivi</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }}
                >
                  {upcoming.map((c) => (
                    <View key={c.id} style={styles.upcomingCard}>
                      {c.cover_url ? <Image source={{ uri: c.cover_url }} style={styles.upcomingCover} /> : null}
                      <View style={styles.upcomingBadge}>
                        <Text style={styles.upcomingBadgeTxt}>In arrivo</Text>
                      </View>
                      <Text style={styles.upcomingTitle} numberOfLines={2}>
                        {c.kind === "premium" ? "👑  " : ""}{c.title}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
    </Pressable>
  );
}

function CourseCard({ course, onPress, large }: { course: Course; onPress: () => void; large?: boolean }) {
  const isPromo = course.promo?.active;
  const promoPrice = course.promo?.price_promo;
  return (
    <Pressable
      onPress={onPress}
      testID={`course-${course.id}`}
      style={[styles.card, large && styles.cardLarge]}
    >
      {course.cover_url ? (
        <Image source={{ uri: course.cover_url }} style={[styles.cover, large && styles.coverLarge]} />
      ) : (
        <View style={[styles.cover, large && styles.coverLarge, { backgroundColor: colors.surfaceSecondary }]} />
      )}
      {course.kind === "premium" ? (
        <View style={styles.crown}>
          <Text style={styles.crownTxt}>👑</Text>
        </View>
      ) : null}
      {isPromo ? (
        <View style={styles.promoBadge}>
          <Text style={styles.promoBadgeTxt}>PROMO</Text>
        </View>
      ) : null}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{course.title}</Text>
        <View style={styles.cardMeta}>
          {course.area_name ? (
            <View style={styles.tag}>
              <Text style={styles.tagTxt}>{course.area_name}</Text>
            </View>
          ) : null}
          {course.topic_count > 0 ? (
            <Text style={styles.metaSm}>{course.topic_count} argomenti</Text>
          ) : null}
          {course.has_quiz ? <Text style={styles.metaSm}>· Quiz + certificato</Text> : null}
        </View>
        <View style={styles.priceRow}>
          {course.kind === "premium" ? (
            isPromo && typeof promoPrice === "number" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.priceStrike}>{course.price.toFixed(2)} €</Text>
                <Text style={styles.pricePromo}>{promoPrice.toFixed(2)} €</Text>
              </View>
            ) : (
              <Text style={styles.price}>{course.price.toFixed(2)} €</Text>
            )
          ) : (
            <Text style={styles.priceFree}>Gratuito — incluso nell&apos;abbonamento</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  eyebrow: {
    color: colors.brandPrimary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800", marginTop: 6 },
  subtitle: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, marginTop: 6 },
  chipRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTxt: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  chipTxtActive: { color: colors.onBrandPrimary, fontWeight: "800" },
  sectionTitle: {
    color: colors.brandPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLarge: { borderColor: colors.brandPrimary, borderWidth: 1.5 },
  cover: { width: "100%", height: 160, backgroundColor: colors.surfaceSecondary },
  coverLarge: { height: 200 },
  crown: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  crownTxt: { fontSize: 16 },
  promoBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  promoBadgeTxt: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  cardBody: { padding: spacing.md },
  cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", lineHeight: 22 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  tag: {
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagTxt: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "700" },
  metaSm: { color: colors.muted, fontSize: 12 },
  priceRow: { marginTop: 10 },
  price: { color: colors.brandPrimary, fontSize: 18, fontWeight: "800" },
  priceStrike: { color: colors.muted, fontSize: 14, textDecorationLine: "line-through" },
  pricePromo: { color: colors.brandPrimary, fontSize: 20, fontWeight: "800" },
  priceFree: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  empty: { color: colors.muted, textAlign: "center", padding: spacing.xl, fontStyle: "italic" },
  upcomingCard: {
    width: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.85,
  },
  upcomingCover: { width: 180, height: 110, backgroundColor: colors.surfaceSecondary },
  upcomingBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  upcomingBadgeTxt: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  upcomingTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "700", padding: 10, lineHeight: 18 },
});
