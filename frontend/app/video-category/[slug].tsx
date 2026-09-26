import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { Muted } from "@/src/ui";
import { useLang } from "@/src/i18n";
import { findVideoCategoryBySlug } from "@/src/videoCategories";

export default function VideoCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();

  const category = React.useMemo(() => findVideoCategoryBySlug(slug || ""), [slug]);

  const { data, refetch, isFetching, isLoading } = useQuery({
    queryKey: ["video-cat", category?.name, lang],
    queryFn: () =>
      api<{ items: any[] }>(
        `/media?kind=video&video_category=${encodeURIComponent(category?.name || "")}&lang=${lang}`
      ),
    enabled: !!category,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (!category) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Categoria non trovata</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.brandPrimary }}>← Torna indietro</Text>
        </Pressable>
      </View>
    );
  }

  const items = data?.items || [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />
      }
    >
      {/* Hero */}
      <View style={styles.heroWrap}>
        <Image source={{ uri: category.image }} style={styles.heroImg} resizeMode="cover" />
        <View style={styles.heroFade} />
        <Pressable
          testID="back-vid-cat"
          onPress={() => router.back()}
          style={[styles.back, { top: insets.top + spacing.md }]}
          hitSlop={10}
        >
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>{category.name}</Text>
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        {category.description.split("\n\n").map((p, idx) => (
          <Text key={idx} style={styles.description}>
            {p}
          </Text>
        ))}
      </View>

      {/* Benefits */}
      {category.benefits.length > 0 ? (
        <View style={styles.benefitsBox}>
          <Text style={styles.benefitsTitle}>Cosa troverai</Text>
          {category.benefits.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitTxt}>{b}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* List of videos */}
      <Text style={styles.listHeader}>Video</Text>
      {isLoading ? (
        <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📺</Text>
          <Text style={styles.emptyTitle}>Nessun video ancora</Text>
          <Muted style={{ textAlign: "center", marginTop: 6 }}>
            Nuovi contenuti in arrivo. Torna a trovarci fra qualche giorno.
          </Muted>
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.xl }}>
          {items.map((item: any) => (
            <Pressable
              key={item.id}
              testID={`vid-item-${item.id}`}
              onPress={() => router.push(`/media/${item.id}` as any)}
              style={styles.row}
            >
              {item.thumbnail_url ? (
                <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Text style={{ fontSize: 28 }}>📺</Text>
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
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  errorTitle: { color: colors.onSurface, fontSize: 18 },
  heroWrap: {
    height: 240,
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
  },
  heroImg: { width: "100%", height: "100%", position: "absolute" },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  back: {
    position: "absolute",
    left: spacing.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  backTxt: { color: "#FFFFFF", fontSize: 22, fontWeight: "600" },
  heroTextWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: spacing.xl,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 6,
  },
  section: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  description: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  benefitsBox: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandPrimary,
    marginBottom: spacing.lg,
  },
  benefitsTitle: {
    color: colors.brandPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
  },
  benefitBullet: {
    color: colors.brandPrimary,
    fontSize: 16,
    marginRight: spacing.sm,
    lineHeight: 22,
  },
  benefitTxt: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  listHeader: {
    color: colors.brandPrimary,
    letterSpacing: 3,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  thumb: {
    width: 120,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  emptyBox: {
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
  pBadge: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pTxt: { color: colors.onBrandPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
});
