import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE } from "@/src/assets";
import { Muted } from "@/src/ui";

const CATEGORIES = [
  "Tutte",
  "Crescita personale",
  "Spirituale",
  "Fisica quantistica",
  "Meditazione",
  "Discipline orientali",
  "Naturopatia",
  "Psicologia",
  "Medicina Integrata",
  "Filosofia",
  "Nutrizione",
  "Somatognostica",
  "Video",
];

export default function Library() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [cat, setCat] = useState("Tutte");

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["library", cat],
    queryFn: () => api<{ items: any[] }>(`/articles${cat === "Tutte" ? "" : `?category=${encodeURIComponent(cat)}`}`),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.md }}>
        <Text style={styles.title}>Biblioteca</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}
          style={{ marginTop: spacing.md }}
        >
          {CATEGORIES.map((c) => {
            const active = c === cat;
            return (
              <Pressable
                key={c}
                testID={`cat-chip-${c}`}
                onPress={() => setCat(c)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={data?.items || []}
        keyExtractor={(x) => x.id}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        contentContainerStyle={{ paddingBottom: spacing.xxxl, gap: spacing.md, paddingTop: spacing.md }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={
          <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
            <Muted>Nessun contenuto in questa categoria</Muted>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`article-card-${item.id}`}
            onPress={() => router.push(`/article/${item.id}`)}
            style={styles.card}
          >
            <Image
              source={{ uri: item.image_url || CATEGORY_IMAGES[item.category] || DEFAULT_IMAGE }}
              style={styles.cardImg}
            />
            <LinearGradient
              colors={["transparent", "rgba(10,15,13,0.95)"]}
              style={StyleSheet.absoluteFillObject as any}
            />
            <View style={styles.cardText}>
              <Text style={styles.cardCat}>{item.category.toUpperCase()}</Text>
              <Text style={styles.cardTitle} numberOfLines={3}>
                {item.title}
              </Text>
            </View>
            {item.is_premium ? (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumTxt}>PREMIUM</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "700",
    paddingHorizontal: spacing.xl,
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  chipText: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandPrimary },
  card: {
    flex: 1,
    height: 220,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
  },
  cardImg: { position: "absolute", width: "100%", height: "100%" },
  cardText: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.md },
  cardCat: {
    color: colors.brandPrimary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 19,
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
