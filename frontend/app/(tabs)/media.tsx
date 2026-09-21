import React from "react";
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
import { useLang } from "@/src/i18n";
import {
  MEDITATION_CATEGORIES,
  MEDITATION_HERO_IMAGE,
  MEDITATION_ABOUT_TEXT,
} from "@/src/meditationCategories";

export default function Media() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLang();

  // Fetch category counts (how many meditations per category)
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["meditation-categories"],
    queryFn: () => api<{ items: { name: string; slug: string; count: number }[] }>("/meditation-categories"),
  });
  const counts: Record<string, number> = React.useMemo(() => {
    const m: Record<string, number> = {};
    (data?.items || []).forEach((c) => (m[c.name] = c.count));
    return m;
  }, [data]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xxxl,
      }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
    >
      {/* Title */}
      <Text style={styles.title}>{t("meditations")}</Text>

      {/* Hero image */}
      <View style={styles.heroWrap}>
        <Image source={{ uri: MEDITATION_HERO_IMAGE }} style={styles.hero} resizeMode="cover" />
        <View style={styles.heroFade} />
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

      {/* About meditation */}
      <View style={styles.aboutBox}>
        <Text style={styles.aboutTitle}>Cos&apos;è la meditazione</Text>
        <Text style={styles.aboutBody}>{MEDITATION_ABOUT_TEXT}</Text>
      </View>
    </ScrollView>
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
  heroWrap: {
    marginTop: spacing.md,
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
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  sectionTitle: {
    color: colors.brandPrimary,
    letterSpacing: 3,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
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
    marginTop: spacing.xl,
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
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  aboutBody: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
  },
});
