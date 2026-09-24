import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  RefreshControl,
  FlatList,
  TextInput,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE, LOGO_URL } from "@/src/assets";
import { Muted } from "@/src/ui";
import { useLang, catLabel } from "@/src/i18n";

type Article = {
  id: string;
  title: string;
  summary: string;
  category: string;
  image_url?: string;
  is_premium: boolean;
  views: number;
};

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [aboutDismissed, setAboutDismissed] = useState(true); // start true so it doesn't flash
  const { t, lang } = useLang();

  useEffect(() => {
    (async () => {
      try {
        let stored: string | null = null;
        if (Platform.OS === "web") {
          stored = typeof window !== "undefined" ? window.localStorage.getItem("ca_about_dismissed") : null;
        } else {
          stored = await SecureStore.getItemAsync("ca_about_dismissed");
        }
        setAboutDismissed(stored === "1");
      } catch {
        setAboutDismissed(false);
      }
    })();
  }, []);

  const dismissAbout = async () => {
    setAboutDismissed(true);
    try {
      if (Platform.OS === "web") {
        window.localStorage.setItem("ca_about_dismissed", "1");
      } else {
        await SecureStore.setItemAsync("ca_about_dismissed", "1");
      }
    } catch {}
  };

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["home-articles", lang],
    queryFn: () => api<{ items: Article[] }>(`/articles?limit=20&lang=${lang}`),
  });

  const { data: searchRes } = useQuery({
    queryKey: ["search", q, lang],
    queryFn: () => api<any>(`/search?q=${encodeURIComponent(q)}&lang=${lang}`),
    enabled: q.trim().length >= 2,
  });

  const items = data?.items || [];
  const hero = items[0];
  const rest = items.slice(1);
  const searching = q.trim().length >= 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        keyExtractor={(x) => x.id}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.xxxl,
        }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Image source={{ uri: LOGO_URL }} style={styles.logoSmall} />
                <View>
                  <Text style={styles.brandTitle}>Libertà in Conoscenza</Text>
                  <Muted style={{ fontSize: 11 }}>{t("tagline")}</Muted>
                </View>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <TextInput
                testID="home-search"
                value={q}
                onChangeText={setQ}
                placeholder={t("search_placeholder")}
                placeholderTextColor={colors.muted}
                style={styles.search}
                returnKeyType="search"
              />
              {q ? (
                <Pressable testID="clear-search" onPress={() => setQ("")} style={styles.clearBtn}>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              ) : null}
            </View>

            {!aboutDismissed && !searching ? (
              <Pressable
                testID="about-welcome-banner"
                onPress={() => router.push("/about")}
                style={styles.aboutBanner}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.aboutBannerTitle}>✨  Benvenuto in Libertà in Conoscenza</Text>
                  <Text style={styles.aboutBannerBody}>
                    Scopri il progetto, gli ideatori e la nostra visione del Ben Essere →
                  </Text>
                </View>
                <Pressable
                  testID="dismiss-about-banner"
                  onPress={(e) => { e.stopPropagation?.(); dismissAbout(); }}
                  hitSlop={12}
                  style={styles.aboutClose}
                >
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </Pressable>
            ) : null}

            {searching ? (
              <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
                <Text style={styles.section}>{t("results_for")} "{q}"</Text>
                {(searchRes?.articles || []).map((a: any) => (
                  <Pressable key={a.id} testID={`search-article-${a.id}`} onPress={() => router.push(`/article/${a.id}`)} style={styles.row}>
                    <Image source={{ uri: a.image_url || CATEGORY_IMAGES[a.category] || DEFAULT_IMAGE }} style={styles.rowImg} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={styles.rowCat}>{catLabel(a.category, lang).toUpperCase()}</Text>
                      <Text style={styles.rowTitle} numberOfLines={2}>{a.title}</Text>
                    </View>
                  </Pressable>
                ))}
                {(searchRes?.media || []).map((m: any) => (
                  <Pressable key={m.id} testID={`search-media-${m.id}`} onPress={() => router.push(`/media/${m.id}`)} style={styles.row}>
                    <Image source={{ uri: m.thumbnail_url || CATEGORY_IMAGES[m.category] || DEFAULT_IMAGE }} style={styles.rowImg} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={styles.rowCat}>{m.kind === "meditation" ? t("meditations").toUpperCase() : t("videos").toUpperCase()}</Text>
                      <Text style={styles.rowTitle} numberOfLines={2}>{m.title}</Text>
                    </View>
                  </Pressable>
                ))}
                {!(searchRes?.articles?.length || searchRes?.media?.length) && (
                  <Muted style={{ marginTop: spacing.md }}>{t("no_results")}</Muted>
                )}
              </View>
            ) : (
              <>
                {hero && (
                  <Pressable
                    testID={`article-hero-${hero.id}`}
                    onPress={() => router.push(`/article/${hero.id}`)}
                    style={styles.heroWrap}
                  >
                    <Image
                      source={{ uri: hero.image_url || CATEGORY_IMAGES[hero.category] || DEFAULT_IMAGE }}
                      style={styles.heroImg}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(10,15,13,0.95)"]}
                      style={styles.heroGrad}
                    />
                    <View style={styles.heroText}>
                      <Text style={styles.heroCat}>{catLabel(hero.category, lang).toUpperCase()}</Text>
                      <Text style={styles.heroTitle} numberOfLines={3}>
                        {hero.title}
                      </Text>
                    </View>
                  </Pressable>
                )}
                <Text style={styles.section}>{t("latest_articles")}</Text>
              </>
            )}
          </View>
        }
        data={searching ? [] : rest}
        renderItem={({ item }) => (
          <Pressable
            testID={`article-row-${item.id}`}
            onPress={() => router.push(`/article/${item.id}`)}
            style={styles.row}
          >
            <Image
              source={{ uri: item.image_url || CATEGORY_IMAGES[item.category] || DEFAULT_IMAGE }}
              style={styles.rowImg}
            />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.rowCat}>{catLabel(item.category, lang).toUpperCase()}</Text>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Muted style={{ marginTop: 4, fontSize: 12 }}>{item.views} {t("reads")}</Muted>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  logoSmall: { width: 44, height: 44 },
  brandTitle: {
    color: colors.brandPrimary,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  heroWrap: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    overflow: "hidden",
    height: 320,
    backgroundColor: colors.surfaceSecondary,
  },
  heroImg: { width: "100%", height: "100%", position: "absolute" },
  heroGrad: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  heroText: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.xl },
  heroCat: {
    color: colors.brandPrimary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: colors.onSurface,
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 32,
  },
  section: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  rowImg: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  rowCat: {
    color: colors.brandPrimary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  rowTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
    lineHeight: 20,
  },
  searchWrap: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    position: "relative",
  },
  search: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    paddingRight: 40,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
  },
  clearBtn: {
    position: "absolute",
    right: spacing.md,
    top: 10,
    padding: 4,
  },
  aboutBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    gap: spacing.md,
  },
  aboutBannerTitle: {
    color: colors.brandPrimary,
    fontWeight: "800",
    fontSize: 14,
  },
  aboutBannerBody: {
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  aboutClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
