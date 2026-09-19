import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Image, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE } from "@/src/assets";
import { Muted } from "@/src/ui";

export default function Favorites() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, refetch } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => api<{ articles: any[]; media: any[] }>("/favorites"),
  });

  const articles = data?.articles || [];
  const media = data?.media || [];
  const empty = !articles.length && !media.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable testID="fav-back" onPress={() => router.back()}>
          <Text style={{ color: colors.brandPrimary, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Preferiti</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}>
        {empty ? (
          <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
            <Muted>Non hai ancora salvato preferiti.</Muted>
            <Muted>Tocca il cuore su un articolo o meditazione.</Muted>
          </View>
        ) : (
          <>
            {articles.length > 0 && (
              <>
                <Text style={styles.section}>Articoli</Text>
                {articles.map((a) => (
                  <Pressable key={a.id} testID={`fav-article-${a.id}`} onPress={() => router.push(`/article/${a.id}`)} style={styles.row}>
                    <Image source={{ uri: a.image_url || CATEGORY_IMAGES[a.category] || DEFAULT_IMAGE }} style={styles.thumb} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={styles.rowCat}>{a.category.toUpperCase()}</Text>
                      <Text style={styles.rowTitle} numberOfLines={2}>{a.title}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
            {media.length > 0 && (
              <>
                <Text style={styles.section}>Meditazioni & Video</Text>
                {media.map((m) => (
                  <Pressable key={m.id} testID={`fav-media-${m.id}`} onPress={() => router.push(`/media/${m.id}`)} style={styles.row}>
                    <Image source={{ uri: m.thumbnail_url || CATEGORY_IMAGES[m.category] || DEFAULT_IMAGE }} style={styles.thumb} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={styles.rowCat}>{m.kind === "meditation" ? "MEDITAZIONE" : "VIDEO"}</Text>
                      <Text style={styles.rowTitle} numberOfLines={2}>{m.title}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "700" },
  section: { color: colors.onSurface, fontSize: 18, fontWeight: "700", paddingHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  thumb: { width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  rowCat: { color: colors.brandPrimary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "600", marginTop: 4 },
});
