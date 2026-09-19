import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE } from "@/src/assets";
import { Muted, GoldButton } from "@/src/ui";

export default function MediaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, error } = useQuery({
    queryKey: ["media", id],
    queryFn: () => api<any>(`/media/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.onSurface, fontSize: 18, textAlign: "center", padding: spacing.xl }}>
          {(error as Error).message.includes("premium")
            ? "Questo contenuto è riservato agli abbonati."
            : (error as Error).message}
        </Text>
        <GoldButton
          testID="go-paywall"
          label="Sblocca Premium"
          onPress={() => router.replace("/paywall")}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  if (!data) return null;

  const openMedia = () => Linking.openURL(data.media_url);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}>
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: data.thumbnail_url || CATEGORY_IMAGES[data.category] || DEFAULT_IMAGE }}
            style={styles.hero}
          />
          <Pressable
            testID="back-btn"
            onPress={() => router.back()}
            style={[styles.back, { top: insets.top + spacing.md }]}
          >
            <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
          </Pressable>
        </View>
        <View style={{ padding: spacing.xl }}>
          <Text style={styles.kind}>{data.kind === "meditation" ? "MEDITAZIONE" : "VIDEO"}</Text>
          <Text style={styles.title}>{data.title}</Text>
          <View style={{ flexDirection: "row", marginTop: spacing.sm, gap: spacing.md }}>
            <Muted>{data.category}</Muted>
            {data.duration_sec ? <Muted>· {Math.round(data.duration_sec / 60)} min</Muted> : null}
            <Muted>· {data.views} visualizzazioni</Muted>
          </View>
          <Text style={styles.body}>{data.description}</Text>
          <GoldButton
            testID="play-media"
            label={data.kind === "meditation" ? "▶  Ascolta ora" : "▶  Guarda ora"}
            onPress={openMedia}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  heroWrap: { height: 260, width: "100%" },
  hero: { width: "100%", height: "100%", position: "absolute" },
  back: {
    position: "absolute",
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(10,15,13,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  kind: { color: colors.brandPrimary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "700", lineHeight: 32 },
  body: { color: colors.onSurfaceSecondary, fontSize: 16, lineHeight: 25, marginTop: spacing.lg },
});
