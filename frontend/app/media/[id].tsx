import React, { useEffect, useState } from "react";
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
import { api, auth } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE } from "@/src/assets";
import { Muted, GoldButton } from "@/src/ui";
import { AudioPlayer } from "@/src/AudioPlayer";
import { useLang, catLabel } from "@/src/i18n";
import AddToPlaylistModal from "@/src/AddToPlaylistModal";
import GatedLanding from "@/src/GatedLanding";
import ShareButton from "@/src/ShareButton";
import FabMenu from "@/src/FabMenu";

export default function MediaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fav, setFav] = useState(false);
  const [addPlOpen, setAddPlOpen] = useState(false);
  const { lang, t } = useLang();
  const [authChecked, setAuthChecked] = useState<null | boolean>(null); // null=checking, true=logged, false=guest

  useEffect(() => {
    auth.hasToken().then((yes) => setAuthChecked(yes));
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["media", id, lang],
    queryFn: () => api<any>(`/media/${id}?lang=${lang}`),
    enabled: !!id && authChecked === true,
  });

  useEffect(() => {
    if (!id) return;
    api<any>("/favorites").then((r) => setFav((r.ids || []).includes(id as string))).catch(() => {});
  }, [id]);

  const toggleFav = async () => {
    try {
      const r = await api<any>("/favorites/toggle", {
        method: "POST",
        body: JSON.stringify({ content_id: id, content_type: "media" }),
      });
      setFav(!!r.favorited);
    } catch {}
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  // Guest visitor → show gated landing (marketing preview, no content leak)
  if (authChecked === false && id) {
    return <GatedLanding contentType="meditation" contentId={id as string} />;
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

  const isRelativeMedia = data.media_url && data.media_url.startsWith("/api/");
  const backendBase = process.env.EXPO_PUBLIC_BACKEND_URL || "";
  const fullUrl = isRelativeMedia ? backendBase + data.media_url : data.media_url;
  const isAudio = data.kind === "meditation" && /\.(mp3|m4a|wav|ogg|aac)(\?|$)/i.test(fullUrl);
  const isYouTube = /youtube\.com|youtu\.be/.test(fullUrl);

  const openMedia = () => Linking.openURL(fullUrl);

  const markComplete = async () => {
    try {
      await api("/completions", {
        method: "POST",
        body: JSON.stringify({ content_id: id, content_type: "media" }),
      });
    } catch {}
  };

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
          <Pressable
            testID="fav-btn"
            onPress={toggleFav}
            style={[styles.favBtn, { top: insets.top + spacing.md }]}
          >
            <Text style={{ fontSize: 20, color: fav ? colors.brandPrimary : colors.onSurface }}>
              {fav ? "♥" : "♡"}
            </Text>
          </Pressable>
          <View style={{ position: "absolute", right: 64, top: insets.top + spacing.md }}>
            <ShareButton
              contentType="meditation"
              contentId={id as string}
              title={data.title}
              size="sm"
            />
          </View>
        </View>
        <View style={{ padding: spacing.xl }}>
          <Text style={styles.kind}>{data.kind === "meditation" ? t("meditations").toUpperCase() : t("videos").toUpperCase()}</Text>
          <Text style={styles.title}>{data.title}</Text>
          <View style={{ flexDirection: "row", marginTop: spacing.sm, gap: spacing.md }}>
            <Muted>{catLabel(data.category, lang)}</Muted>
            {data.duration_sec ? <Muted>· {Math.round(data.duration_sec / 60)} {t("minutes")}</Muted> : null}
            <Muted>· {data.views} {t("views")}</Muted>
          </View>
          <Text style={styles.body}>{data.description}</Text>

          {isAudio ? (
            <View style={{ marginTop: spacing.xl }}>
              <AudioPlayer url={fullUrl} onComplete={markComplete} />
            </View>
          ) : (
            <GoldButton
              testID="play-media"
              label={data.kind === "meditation" ? t("listen_now") : t("watch_now")}
              onPress={openMedia}
              style={{ marginTop: spacing.xl }}
            />
          )}

          {data.kind === "meditation" ? (
            <Pressable
              testID="add-to-playlist"
              onPress={() => setAddPlOpen(true)}
              style={styles.addToPlBtn}
            >
              <Text style={styles.addToPlTxt}>➕  Aggiungi a playlist</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <AddToPlaylistModal
        visible={addPlOpen}
        onClose={() => setAddPlOpen(false)}
        mediaId={id as string}
        mediaTitle={data.title}
      />
      <FabMenu />
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
  favBtn: {
    position: "absolute",
    right: spacing.lg,
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
  addToPlBtn: {
    marginTop: spacing.md,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  addToPlTxt: {
    color: colors.brandPrimary,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
