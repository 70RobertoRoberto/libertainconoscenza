import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE } from "@/src/assets";
import { Muted } from "@/src/ui";
import { useLang, catLabel } from "@/src/i18n";

// The 12 displayed categories in priority order.
const DISPLAY_CATEGORIES = [
  "Coscienza",
  "Fisica quantistica",
  "Spirituale",
  "Meditazione",
  "Somatognostica",
  "Tradizioni Esoteriche",
  "Guarigione Energetica",
  "Discipline orientali",
  "Medicina Integrata",
  "Naturopatia",
  "Psicologia",
  "Nutrizione",
];

type CategoryCount = { name: string; count: number };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Unused = CategoryCount;

export default function Library() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useLang();

  // Article counts per category (lightweight endpoint)
  const { data: countsData } = useQuery({
    queryKey: ["library-counts"],
    queryFn: () => api<{ counts: Record<string, number>; total: number }>("/articles/counts"),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Latest 5 articles across all categories
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["library-index", lang],
    queryFn: () => api<{ items: any[] }>(`/articles?lang=${lang}&limit=5`),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const items = React.useMemo(() => data?.items || [], [data]);
  const counts = countsData?.counts || {};
  const totalArticles = countsData?.total || 0;

  // Latest 5 articles (already limited server-side, sorted by created_at desc)
  const latest = items;

  const openCategory = (cat: string) => {
    router.push({ pathname: "/library-category/[cat]", params: { cat } } as any);
  };

  const screenW = Dimensions.get("window").width;
  const gutter = spacing.md;
  const paddingH = spacing.lg;
  const columns = screenW >= 700 ? 4 : 3;
  const cardW = (screenW - paddingH * 2 - gutter * (columns - 1)) / columns;
  const cardH = cardW * 1.15;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={refetch}
          tintColor={colors.brandPrimary}
        />
      }
    >
      <View style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg }}>
        <Text style={styles.title}>{t("library_title")}</Text>
        <Muted style={{ paddingHorizontal: spacing.xl, marginTop: 4 }}>
          {totalArticles > 0
            ? `${totalArticles} ${lang === "it" ? "articoli disponibili" : "articles available"}`
            : ""}
        </Muted>
      </View>

      {/* ─── Ultimi articoli ─── */}
      {latest.length > 0 ? (
        <View style={{ marginBottom: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: paddingH,
              marginBottom: spacing.sm,
            }}
          >
            <Text style={styles.sectionTitle}>
              {lang === "it" ? "Ultimi articoli" : "Latest articles"}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: paddingH, gap: spacing.md }}
          >
            {latest.map((a) => (
              <Pressable
                key={a.id}
                testID={`latest-${a.id}`}
                onPress={() => router.push(`/article/${a.id}`)}
                style={[styles.latestCard, { width: 220 }]}
              >
                <Image
                  source={{
                    uri:
                      a.image_url ||
                      CATEGORY_IMAGES[a.category] ||
                      DEFAULT_IMAGE,
                  }}
                  style={styles.latestImg}
                />
                <LinearGradient
                  colors={["transparent", "rgba(10,15,13,0.95)"]}
                  style={StyleSheet.absoluteFillObject as any}
                />
                <View style={styles.latestText}>
                  <Text style={styles.latestCat}>
                    {catLabel(a.category, lang).toUpperCase()}
                  </Text>
                  <Text style={styles.latestTitle} numberOfLines={3}>
                    {a.title}
                  </Text>
                </View>
                {a.is_premium ? (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumTxt}>
                      {t("premium").toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ─── Griglia categorie ─── */}
      <View
        style={{
          paddingHorizontal: paddingH,
          marginBottom: spacing.md,
        }}
      >
        <Text style={styles.sectionTitle}>
          {lang === "it" ? "Categorie" : "Categories"}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          paddingHorizontal: paddingH,
          gap: gutter,
        }}
      >
        {DISPLAY_CATEGORIES.map((c) => {
          const count = counts[c] || 0;
          return (
            <Pressable
              key={c}
              testID={`cat-card-${c}`}
              onPress={() => openCategory(c)}
              style={[styles.catCard, { width: cardW, height: cardH }]}
            >
              <Image
                source={{
                  uri: CATEGORY_IMAGES[c] || DEFAULT_IMAGE,
                }}
                style={styles.catImg}
              />
              <LinearGradient
                colors={["rgba(10,15,13,0.15)", "rgba(10,15,13,0.90)"]}
                style={StyleSheet.absoluteFillObject as any}
              />
              <View style={styles.catText}>
                <Text style={styles.catCountBadge}>
                  {count} {lang === "it" ? "art." : "art."}
                </Text>
                <Text style={styles.catName} numberOfLines={2}>
                  {catLabel(c, lang)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {totalArticles === 0 && !isFetching ? (
        <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
          <Muted>{t("no_content")}</Muted>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "700",
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "700",
  },
  latestCard: {
    height: 130,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
  },
  latestImg: { position: "absolute", width: "100%", height: "100%" },
  latestText: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
  },
  latestCat: {
    color: colors.brandPrimary,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  latestTitle: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  catCard: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
  },
  catImg: { position: "absolute", width: "100%", height: "100%" },
  catText: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
  },
  catCountBadge: {
    color: colors.brandPrimary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  catName: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  premiumBadge: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  premiumTxt: {
    color: colors.onBrandPrimary,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
