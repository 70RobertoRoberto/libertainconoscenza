import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE, LOGO_URL } from "@/src/assets";
import { Muted } from "@/src/ui";

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

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["articles-home"],
    queryFn: () => api<{ items: Article[] }>("/articles?limit=20"),
  });

  const items = data?.items || [];
  const hero = items[0];
  const rest = items.slice(1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        data={rest}
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
                  <Text style={styles.brandTitle}>Conoscenza Aperta</Text>
                  <Muted style={{ fontSize: 11 }}>Sapienza per crescere</Muted>
                </View>
              </View>
            </View>

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
                  <Text style={styles.heroCat}>{hero.category.toUpperCase()}</Text>
                  <Text style={styles.heroTitle} numberOfLines={3}>
                    {hero.title}
                  </Text>
                </View>
              </Pressable>
            )}

            <Text style={styles.section}>Ultimi articoli</Text>
          </View>
        }
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
              <Text style={styles.rowCat}>{item.category.toUpperCase()}</Text>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Muted style={{ marginTop: 4, fontSize: 12 }}>{item.views} letture</Muted>
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
});
