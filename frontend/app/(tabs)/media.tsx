import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { Muted } from "@/src/ui";
import { useLang } from "@/src/i18n";
import {
  MEDITATION_CATEGORIES,
  MEDITATION_HERO_IMAGE,
  MEDITATION_HERO_TITLE,
  MEDITATION_ABOUT_TEXT,
} from "@/src/meditationCategories";

type Mode = "meditation" | "video";

export default function Media() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("meditation");

  // Category counts (meditations per category)
  const { data: catData, refetch: refetchCats, isFetching: fetchingCats } = useQuery({
    queryKey: ["meditation-categories"],
    queryFn: () =>
      api<{ items: { name: string; slug: string; count: number }[] }>(
        "/meditation-categories"
      ),
    enabled: mode === "meditation",
  });
  const counts: Record<string, number> = React.useMemo(() => {
    const m: Record<string, number> = {};
    (catData?.items || []).forEach((c) => (m[c.name] = c.count));
    return m;
  }, [catData]);

  // Video list (only fetched when video mode is active)
  const { data: videoData, refetch: refetchVideos, isFetching: fetchingVideos } = useQuery({
    queryKey: ["videos"],
    queryFn: () => api<{ items: any[] }>("/media?kind=video"),
    enabled: mode === "video",
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xxxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={mode === "meditation" ? fetchingCats : fetchingVideos}
          onRefresh={mode === "meditation" ? refetchCats : refetchVideos}
          tintColor={colors.brandPrimary}
        />
      }
    >
      {/* Title */}
      <Text style={styles.title}>{mode === "meditation" ? "Meditazioni" : "Video"}</Text>

      {/* Mode toggle */}
      <View style={styles.toggleRow}>
        <Pressable
          testID="mode-meditation"
          onPress={() => setMode("meditation")}
          style={[styles.togglePill, mode === "meditation" && styles.togglePillActive]}
        >
          <Text style={mode === "meditation" ? styles.togglePillActiveTxt : styles.togglePillTxt}>
            🧘 Meditazioni
          </Text>
        </Pressable>
        <Pressable
          testID="mode-video"
          onPress={() => setMode("video")}
          style={[styles.togglePill, mode === "video" && styles.togglePillActive]}
        >
          <Text style={mode === "video" ? styles.togglePillActiveTxt : styles.togglePillTxt}>
            📺 Video
          </Text>
        </Pressable>
      </View>

      {mode === "meditation" ? (
        <MeditationContent counts={counts} router={router} />
      ) : (
        <VideoContent items={videoData?.items || []} router={router} t={t} />
      )}
    </ScrollView>
  );
}

/* ─────────── Meditation content ─────────── */
function MeditationContent({
  counts,
  router,
}: {
  counts: Record<string, number>;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      {/* Hero image */}
      <View style={styles.heroWrap}>
        <Image source={{ uri: MEDITATION_HERO_IMAGE }} style={styles.hero} resizeMode="cover" />
        <View style={styles.heroFade} />
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>{MEDITATION_HERO_TITLE}</Text>
        </View>
      </View>

      {/* Category grid */}
      <Text style={styles.sectionTitle}>Categorie</Text>
      <View style={styles.grid}>
        {MEDITATION_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.slug}
            testID={`med-cat-${cat.slug}`}
            onPress={() => router.push(`/meditation-category/${cat.slug}` as any)}
            style={styles.card}
          >
            <Image source={{ uri: cat.image }} style={styles.cardImg} resizeMode="cover" />
            <View style={styles.cardOverlay} />
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle} numberOfLines={3}>{cat.name}</Text>
              <Text style={styles.cardCount}>
                {counts[cat.name] > 0 ? `${counts[cat.name]} meditazioni` : "Nessuna meditazione"}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* About meditation - long structured text */}
      <View style={styles.aboutBox}>
        <Text style={styles.aboutTitle}>Cos&apos;è la meditazione</Text>
        {MEDITATION_ABOUT_TEXT.split("\n\n").map((p, idx) => {
          const isNote = p.trim().startsWith("NOTA:");
          return isNote ? (
            <View key={idx} style={styles.noteBox}>
              <Text style={styles.noteTxt}>{p}</Text>
            </View>
          ) : (
            <Text key={idx} style={styles.aboutParagraph}>{p}</Text>
          );
        })}
      </View>
    </>
  );
}

/* ─────────── Video content ─────────── */
function VideoContent({
  items,
  router,
  t,
}: {
  items: any[];
  router: ReturnType<typeof useRouter>;
  t: (k: string) => string;
}) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyEmoji}>📺</Text>
        <Text style={styles.emptyTitle}>Nessun video ancora</Text>
        <Muted style={{ textAlign: "center", marginTop: 6 }}>
          Sto per pubblicare nuovi contenuti. Torna a trovarci fra qualche giorno.
        </Muted>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          testID={`vid-item-${item.id}`}
          onPress={() => router.push(`/media/${item.id}` as any)}
          style={styles.videoRow}
        >
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.videoThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.videoThumb, { alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ fontSize: 30 }}>📺</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
            {item.description ? (
              <Muted style={{ fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                {item.description}
              </Muted>
            ) : null}
            {item.duration_sec ? (
              <Muted style={{ fontSize: 11, marginTop: 4 }}>
                {`${Math.round(item.duration_sec / 60)} ${t("minutes")}`}
              </Muted>
            ) : null}
          </View>
          {item.is_premium ? (
            <View style={styles.pBadge}>
              <Text style={styles.pTxt}>PRE</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const CARD_MARGIN = spacing.md;

const styles = StyleSheet.create({
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "700",
    paddingHorizontal: spacing.xl,
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  togglePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  togglePillActive: {
    backgroundColor: colors.brandPrimary + "22",
    borderColor: colors.brandPrimary,
  },
  togglePillTxt: { color: colors.onSurfaceSecondary, fontWeight: "600", fontSize: 13 },
  togglePillActiveTxt: { color: colors.brandPrimary, fontWeight: "800", fontSize: 13 },

  heroWrap: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    overflow: "hidden",
    height: 180,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.brandPrimary + "30",
  },
  hero: { width: "100%", height: "100%" },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  heroTextWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 6,
  },
  sectionTitle: {
    color: colors.brandPrimary,
    letterSpacing: 3,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.xl - CARD_MARGIN / 2,
  },
  card: {
    width: "50%",
    aspectRatio: 1,
    padding: CARD_MARGIN / 2,
  },
  cardImg: {
    ...StyleSheet.absoluteFillObject,
    margin: CARD_MARGIN / 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    margin: CARD_MARGIN / 2,
    borderRadius: radius.md,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: colors.brandPrimary + "40",
  },
  cardTextWrap: {
    ...StyleSheet.absoluteFillObject,
    margin: CARD_MARGIN / 2,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: "flex-end",
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  cardCount: {
    color: colors.brandPrimary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: 0.3,
  },
  aboutBox: {
    marginTop: spacing.md, // reduced from xl
    marginHorizontal: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandPrimary,
  },
  aboutTitle: {
    color: colors.brandPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  aboutParagraph: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  noteBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary + "15",
    borderLeftWidth: 3,
    borderLeftColor: colors.brandPrimary,
  },
  noteTxt: {
    color: colors.onSurface,
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
  },
  emptyBox: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    padding: spacing.xxl,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  videoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  videoThumb: {
    width: 120,
    height: 68,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  pBadge: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pTxt: { color: colors.onBrandPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
});
