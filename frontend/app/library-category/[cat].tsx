import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE } from "@/src/assets";
import { Muted } from "@/src/ui";
import { useLang, catLabel } from "@/src/i18n";

export default function LibraryCategory() {
  const { cat: catParam } = useLocalSearchParams<{ cat: string }>();
  const cat = String(catParam || "");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useLang();

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["library-cat", cat, lang],
    queryFn: () =>
      api<{ items: any[] }>(
        `/articles?category=${encodeURIComponent(cat)}&lang=${lang}`
      ),
    enabled: !!cat,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const items = data?.items || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Hero */}
      <View style={{ height: 200 + insets.top }}>
        <Image
          source={{ uri: CATEGORY_IMAGES[cat] || DEFAULT_IMAGE }}
          style={StyleSheet.absoluteFillObject as any}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["rgba(10,15,13,0.35)", "rgba(10,15,13,0.95)"]}
          style={StyleSheet.absoluteFillObject as any}
        />
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.back, { top: insets.top + spacing.sm }]}
        >
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700", marginTop: -2 }}>‹</Text>
        </Pressable>
        <View style={[styles.heroText, { paddingBottom: spacing.lg }]}>
          <Text style={styles.heroLabel}>
            {(lang === "it" ? "Categoria" : "Category").toUpperCase()}
          </Text>
          <Text style={styles.heroTitle}>{catLabel(cat, lang)}</Text>
          <Muted style={{ marginTop: 4 }}>
            {items.length}{" "}
            {lang === "it"
              ? items.length === 1
                ? "articolo"
                : "articoli"
              : items.length === 1
              ? "article"
              : "articles"}
          </Muted>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.md,
          paddingTop: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.brandPrimary}
          />
        }
        ListEmptyComponent={
          !isFetching ? (
            <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
              <Text style={{ fontSize: 30, marginBottom: 8 }}>📖</Text>
              <Muted>
                {lang === "it"
                  ? "Nessun articolo in questa categoria ancora."
                  : "No articles in this category yet."}
              </Muted>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`cat-article-${item.id}`}
            onPress={() => router.push(`/article/${item.id}`)}
            style={styles.card}
          >
            <Image
              source={{
                uri:
                  item.image_url ||
                  CATEGORY_IMAGES[item.category] ||
                  DEFAULT_IMAGE,
              }}
              style={styles.cardImg}
            />
            <LinearGradient
              colors={["transparent", "rgba(10,15,13,0.95)"]}
              style={StyleSheet.absoluteFillObject as any}
            />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} numberOfLines={3}>
                {item.title}
              </Text>
            </View>
            {item.is_premium ? (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumTxt}>
                  {t("premium").toUpperCase()}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    position: "absolute",
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
  },
  heroLabel: {
    color: colors.brandPrimary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: colors.onSurface,
    fontSize: 26,
    fontWeight: "800",
    marginTop: 4,
  },
  card: {
    flex: 1,
    height: 220,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
  },
  cardImg: { position: "absolute", width: "100%", height: "100%" },
  cardText: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  premiumBadge: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  premiumTxt: {
    color: colors.onBrandPrimary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
