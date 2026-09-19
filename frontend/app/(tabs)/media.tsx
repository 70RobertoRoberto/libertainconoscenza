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
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE } from "@/src/assets";
import { Muted } from "@/src/ui";

const KINDS = [
  { key: "all", label: "Tutti" },
  { key: "meditation", label: "Meditazioni" },
  { key: "video", label: "Video" },
];

export default function Media() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [kind, setKind] = useState("all");

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["media", kind],
    queryFn: () => api<{ items: any[] }>(`/media${kind === "all" ? "" : `?kind=${kind}`}`),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.md }}>
        <Text style={styles.title}>Meditazioni & Video</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}
          style={{ marginTop: spacing.md }}
        >
          {KINDS.map((k) => {
            const active = k.key === kind;
            return (
              <Pressable
                key={k.key}
                testID={`kind-chip-${k.key}`}
                onPress={() => setKind(k.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{k.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={data?.items || []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={
          <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
            <Muted>Nessun contenuto disponibile</Muted>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`media-row-${item.id}`}
            onPress={() => router.push(`/media/${item.id}`)}
            style={styles.row}
          >
            <Image
              source={{ uri: item.thumbnail_url || CATEGORY_IMAGES[item.category] || DEFAULT_IMAGE }}
              style={styles.thumb}
            />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.kind}>{(item.kind === "meditation" ? "MEDITAZIONE" : "VIDEO")}</Text>
              <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
              <View style={{ flexDirection: "row", marginTop: 4, gap: spacing.sm }}>
                <Muted style={{ fontSize: 11 }}>{item.category}</Muted>
                {item.duration_sec ? (
                  <Muted style={{ fontSize: 11 }}>{`· ${Math.round(item.duration_sec / 60)} min`}</Muted>
                ) : null}
              </View>
            </View>
            {item.is_premium ? (
              <View style={styles.pBadge}>
                <Text style={styles.pTxt}>PRO</Text>
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
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandPrimary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  thumb: { width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  kind: { color: colors.brandPrimary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "600", marginTop: 4 },
  pBadge: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pTxt: { color: colors.onBrandPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
});
