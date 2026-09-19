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
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { CATEGORY_IMAGES, DEFAULT_IMAGE } from "@/src/assets";
import { Muted } from "@/src/ui";

export default function ArticleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fav, setFav] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["article", id],
    queryFn: () => api<any>(`/articles/${id}`),
    enabled: !!id,
  });

  const qc = useQueryClient();
  const { data: comments } = useQuery({
    queryKey: ["comments", id],
    queryFn: () => api<{ items: any[] }>(`/comments?content_id=${id}`),
    enabled: !!id,
  });
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const sendComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      await api("/comments", {
        method: "POST",
        body: JSON.stringify({ content_id: id, content_type: "article", body: newComment }),
      });
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["comments", id] });
    } catch {}
    finally { setPosting(false); }
  };

  useEffect(() => {
    if (!id) return;
    api<any>("/favorites").then((r) => setFav((r.ids || []).includes(id as string))).catch(() => {});
  }, [id]);

  const toggleFav = async () => {
    try {
      const r = await api<any>("/favorites/toggle", {
        method: "POST",
        body: JSON.stringify({ content_id: id, content_type: "article" }),
      });
      setFav(!!r.favorited);
    } catch {}
  };

  if (isLoading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const shareText = `${data.title}\n\n${data.summary}\n\n— da Conoscenza Aperta`;
  const shareWA = () =>
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
  const shareTG = () =>
    Linking.openURL(
      `https://t.me/share/url?url=${encodeURIComponent(data.source_url || "")}&text=${encodeURIComponent(shareText)}`,
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: data.image_url || CATEGORY_IMAGES[data.category] || DEFAULT_IMAGE }}
            style={styles.hero}
          />
          <LinearGradient
            colors={["rgba(10,15,13,0.6)", "transparent", "rgba(10,15,13,0.95)"]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFillObject as any}
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
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: -spacing.xl }}>
          <Text style={styles.cat}>{data.category.toUpperCase()}</Text>
          <Text style={styles.title}>{data.title}</Text>
          <Muted style={{ marginTop: spacing.sm }}>{data.views} letture</Muted>
          <View style={styles.divider} />
          <Text style={styles.body}>{data.summary}</Text>
          {data.source_url ? (
            <Pressable onPress={() => Linking.openURL(data.source_url)}>
              <Text style={styles.source}>Fonte: {data.source_url}</Text>
            </Pressable>
          ) : null}

          <View style={styles.commentsWrap}>
            <Text style={styles.cSection}>Commenti ({comments?.items?.length || 0})</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <TextInput
                testID="new-comment"
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Lascia un pensiero…"
                placeholderTextColor={colors.muted}
                style={styles.cInput}
                multiline
              />
              <Pressable testID="send-comment" onPress={sendComment} disabled={posting} style={styles.cSend}>
                <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>{posting ? "…" : "Invia"}</Text>
              </Pressable>
            </View>
            {(comments?.items || []).map((c: any) => (
              <View key={c.id} style={styles.cItem}>
                <Text style={styles.cUser}>{c.user_name}</Text>
                <Text style={styles.cBody}>{c.body}</Text>
                <Text style={styles.cDate}>{new Date(c.created_at).toLocaleDateString("it-IT")}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.shareBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="share-wa" onPress={shareWA} style={[styles.shareBtn, { backgroundColor: "#25D366" }]}>
          <Text style={styles.shareTxt}>WhatsApp</Text>
        </Pressable>
        <Pressable testID="share-tg" onPress={shareTG} style={[styles.shareBtn, { backgroundColor: "#229ED9" }]}>
          <Text style={styles.shareTxt}>Telegram</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  heroWrap: { height: 340, width: "100%" },
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
  cat: {
    color: colors.brandPrimary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  divider: {
    height: 1,
    backgroundColor: colors.brandSecondary,
    opacity: 0.4,
    marginVertical: spacing.xl,
    width: 60,
  },
  body: {
    color: colors.onSurfaceSecondary,
    fontSize: 17,
    lineHeight: 28,
  },
  source: {
    color: colors.muted,
    marginTop: spacing.xl,
    fontSize: 12,
    fontStyle: "italic",
  },
  commentsWrap: { marginTop: spacing.xxxl },
  cSection: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  cInput: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    maxHeight: 100,
  },
  cSend: {
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    justifyContent: "center",
  },
  cItem: {
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  cUser: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  cBody: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 4, lineHeight: 20 },
  cDate: { color: colors.muted, fontSize: 11, marginTop: 4 },
  shareBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
  },
  shareBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  shareTxt: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
