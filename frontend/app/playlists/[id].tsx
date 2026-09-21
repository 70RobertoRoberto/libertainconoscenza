import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { Muted, GoldButton } from "@/src/ui";
import { useLang } from "@/src/i18n";

type MediaItem = {
  id: string;
  title: string;
  description: string;
  thumbnail_url?: string | null;
  duration_sec?: number | null;
  is_premium?: boolean;
  meditation_category?: string | null;
};

type PlaylistDetail = {
  id: string;
  name: string;
  media_ids: string[];
  items: MediaItem[];
  count: number;
};

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useLang();
  const [renaming, setRenaming] = useState(false);
  const [nameEdit, setNameEdit] = useState("");

  const { data, refetch, isFetching, isLoading } = useQuery({
    queryKey: ["playlist", id],
    queryFn: () => api<PlaylistDetail>(`/playlists/${id}`),
    enabled: !!id,
  });

  // Local ordering state so we can move items up/down before saving
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  useEffect(() => {
    if (data?.media_ids) setOrderedIds(data.media_ids);
  }, [data?.media_ids]);
  const itemsById = useMemo(() => {
    const m: Record<string, MediaItem> = {};
    (data?.items || []).forEach((it) => (m[it.id] = it));
    return m;
  }, [data]);

  const orderChanged = useMemo(() => {
    if (!data?.media_ids) return false;
    if (data.media_ids.length !== orderedIds.length) return false;
    return data.media_ids.some((x, i) => x !== orderedIds[i]);
  }, [data?.media_ids, orderedIds]);

  const move = (idx: number, delta: number) => {
    const j = idx + delta;
    if (j < 0 || j >= orderedIds.length) return;
    const next = orderedIds.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrderedIds(next);
  };

  const saveOrder = async () => {
    await api(`/playlists/${id}/reorder`, {
      method: "POST",
      body: JSON.stringify({ media_ids: orderedIds }),
    });
    qc.invalidateQueries({ queryKey: ["playlist", id] });
    qc.invalidateQueries({ queryKey: ["my-playlists"] });
  };

  const remove = async (mid: string) => {
    Alert.alert("Rimuovi meditazione", "Vuoi rimuoverla dalla playlist?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Rimuovi",
        style: "destructive",
        onPress: async () => {
          await api(`/playlists/${id}/items/${mid}`, { method: "DELETE" });
          qc.invalidateQueries({ queryKey: ["playlist", id] });
          qc.invalidateQueries({ queryKey: ["my-playlists"] });
        },
      },
    ]);
  };

  const startRename = () => {
    setNameEdit(data?.name || "");
    setRenaming(true);
  };
  const saveRename = async () => {
    const nm = nameEdit.trim();
    if (!nm) { setRenaming(false); return; }
    await api(`/playlists/${id}`, { method: "PATCH", body: JSON.stringify({ name: nm }) });
    qc.invalidateQueries({ queryKey: ["playlist", id] });
    qc.invalidateQueries({ queryKey: ["my-playlists"] });
    setRenaming(false);
  };

  const playAll = () => {
    if (orderedIds.length === 0) return;
    // Simple approach: open the first meditation. Auto-advance can be added later.
    router.push(`/media/${orderedIds[0]}` as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen
        options={{
          title: data?.name || "Playlist",
          headerBackTitle: "Indietro",
          headerRight: () => (
            <Pressable onPress={startRename} hitSlop={10} style={{ marginRight: spacing.md }}>
              <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Rinomina</Text>
            </Pressable>
          ),
        }}
      />

      {renaming ? (
        <View style={styles.renameBox}>
          <TextInput
            testID="rename-input"
            value={nameEdit}
            onChangeText={setNameEdit}
            style={styles.input}
            autoFocus
            maxLength={80}
            onSubmitEditing={saveRename}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Pressable onPress={() => setRenaming(false)} style={styles.cancelBtn}>
              <Text style={{ color: colors.muted, fontWeight: "700" }}>Annulla</Text>
            </Pressable>
            <GoldButton label="Salva" onPress={saveRename} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxxl,
        }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : !data ? (
          <Muted>Playlist non trovata.</Muted>
        ) : (
          <>
            <Text style={styles.count}>
              {orderedIds.length} meditazion{orderedIds.length === 1 ? "e" : "i"}
            </Text>

            {orderedIds.length > 0 ? (
              <GoldButton
                testID="play-all"
                label="▶  Ascolta la prima meditazione"
                onPress={playAll}
                style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
              />
            ) : null}

            {orderChanged ? (
              <View style={styles.saveBar}>
                <Muted style={{ flex: 1, fontSize: 12 }}>Ordine modificato</Muted>
                <Pressable
                  onPress={() => setOrderedIds(data.media_ids)}
                  style={styles.miniBtn}
                >
                  <Text style={styles.miniBtnTxt}>Annulla</Text>
                </Pressable>
                <Pressable
                  testID="save-order"
                  onPress={saveOrder}
                  style={[styles.miniBtn, styles.miniBtnPrimary]}
                >
                  <Text style={styles.miniBtnPrimaryTxt}>Salva</Text>
                </Pressable>
              </View>
            ) : null}

            {orderedIds.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🎵</Text>
                <Muted style={{ textAlign: "center", marginTop: spacing.sm }}>
                  Nessuna meditazione ancora.{"\n"}Aggiungine dalla pagina di ascolto.
                </Muted>
              </View>
            ) : (
              orderedIds.map((mid, idx) => {
                const it = itemsById[mid];
                if (!it) return null;
                return (
                  <View key={mid} style={styles.row}>
                    <Pressable
                      testID={`open-${mid}`}
                      onPress={() => router.push(`/media/${mid}` as any)}
                      style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                    >
                      <Text style={styles.orderNum}>{idx + 1}</Text>
                      {it.thumbnail_url ? (
                        <Image source={{ uri: it.thumbnail_url }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, { alignItems: "center", justifyContent: "center" }]}>
                          <Text style={{ fontSize: 22 }}>🎧</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: spacing.md }}>
                        <Text style={styles.rowTitle} numberOfLines={2}>{it.title}</Text>
                        {it.meditation_category ? (
                          <Muted style={{ fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                            {it.meditation_category}
                          </Muted>
                        ) : null}
                        {it.duration_sec ? (
                          <Muted style={{ fontSize: 11, marginTop: 2 }}>
                            {`${Math.round(it.duration_sec / 60)} ${t("minutes")}`}
                          </Muted>
                        ) : null}
                      </View>
                    </Pressable>
                    <View style={{ alignItems: "center", gap: 4 }}>
                      <Pressable
                        testID={`up-${mid}`}
                        onPress={() => move(idx, -1)}
                        disabled={idx === 0}
                        style={[styles.arrow, idx === 0 && styles.arrowDisabled]}
                        hitSlop={6}
                      >
                        <Text style={styles.arrowTxt}>▲</Text>
                      </Pressable>
                      <Pressable
                        testID={`down-${mid}`}
                        onPress={() => move(idx, 1)}
                        disabled={idx === orderedIds.length - 1}
                        style={[styles.arrow, idx === orderedIds.length - 1 && styles.arrowDisabled]}
                        hitSlop={6}
                      >
                        <Text style={styles.arrowTxt}>▼</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      testID={`rm-${mid}`}
                      onPress={() => remove(mid)}
                      style={{ paddingHorizontal: 8 }}
                      hitSlop={10}
                    >
                      <Text style={{ color: colors.error, fontSize: 20 }}>×</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  renameBox: {
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.brandPrimary + "50",
  },
  miniBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniBtnTxt: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  miniBtnPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  miniBtnPrimaryTxt: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  orderNum: {
    color: colors.brandPrimary,
    fontWeight: "800",
    width: 24,
    fontSize: 15,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  rowTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  arrow: {
    width: 26,
    height: 22,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowDisabled: { opacity: 0.3 },
  arrowTxt: { color: colors.brandPrimary, fontSize: 10, fontWeight: "700" },
  empty: {
    marginTop: spacing.xl,
    padding: spacing.xxl,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  emptyEmoji: { fontSize: 40 },
});
