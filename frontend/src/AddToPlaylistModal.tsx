import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { Muted, GoldButton } from "@/src/ui";

type Props = {
  visible: boolean;
  onClose: () => void;
  mediaId: string;
  mediaTitle?: string;
};

type PlaylistRow = {
  id: string;
  name: string;
  count: number;
  updated_at?: string;
};

/**
 * Bottom sheet modal that lets the current user add the given media item to
 * one of their existing playlists, or create a new playlist on the fly.
 */
export default function AddToPlaylistModal({ visible, onClose, mediaId, mediaTitle }: Props) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-playlists"],
    queryFn: () => api<{ items: PlaylistRow[] }>("/playlists"),
    enabled: visible,
  });

  const flash = (tone: "ok" | "err", text: string) => {
    setMsg({ tone, text });
    setTimeout(() => setMsg(null), 2500);
  };

  const addToPlaylist = async (playlistId: string) => {
    setBusyId(playlistId);
    try {
      const res = await api<{ ok: boolean; added: boolean; reason?: string }>(
        `/playlists/${playlistId}/items`,
        { method: "POST", body: JSON.stringify({ media_id: mediaId }) }
      );
      qc.invalidateQueries({ queryKey: ["my-playlists"] });
      qc.invalidateQueries({ queryKey: ["playlist", playlistId] });
      if (res.added) {
        flash("ok", "✅ Aggiunta alla playlist");
        setTimeout(onClose, 700);
      } else {
        flash("err", "Già presente in questa playlist");
      }
    } catch (e: any) {
      flash("err", e.message || "Errore");
    } finally {
      setBusyId(null);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const p = await api<PlaylistRow>("/playlists", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await api(`/playlists/${p.id}/items`, {
        method: "POST",
        body: JSON.stringify({ media_id: mediaId }),
      });
      setNewName("");
      qc.invalidateQueries({ queryKey: ["my-playlists"] });
      flash("ok", `✅ Aggiunta a "${p.name}"`);
      setTimeout(onClose, 700);
    } catch (e: any) {
      flash("err", e.message || "Errore");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable onPress={() => {}} style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>Aggiungi a una playlist</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {mediaTitle ? (
            <Muted style={{ marginBottom: spacing.md }} numberOfLines={2}>
              {mediaTitle}
            </Muted>
          ) : null}

          {/* New playlist input */}
          <View style={styles.newRow}>
            <TextInput
              testID="new-playlist-name"
              value={newName}
              onChangeText={setNewName}
              placeholder="+ Nuova playlist…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              maxLength={80}
              onSubmitEditing={createAndAdd}
              returnKeyType="done"
            />
            <GoldButton
              testID="btn-create-playlist"
              label={creating ? "…" : "Crea"}
              onPress={createAndAdd}
              loading={creating}
              style={{ minWidth: 84 }}
            />
          </View>

          {msg ? (
            <Text style={[styles.flash, msg.tone === "err" ? { color: colors.error } : null]}>
              {msg.text}
            </Text>
          ) : null}

          {/* Existing playlists */}
          <Text style={styles.section}>Le tue playlist</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
          ) : (data?.items || []).length === 0 ? (
            <View style={styles.emptyBox}>
              <Muted style={{ textAlign: "center" }}>
                Non hai ancora playlist.{"\n"}Creane una qui sopra ↑
              </Muted>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {(data?.items || []).map((p) => (
                <Pressable
                  key={p.id}
                  testID={`add-to-playlist-${p.id}`}
                  onPress={() => addToPlaylist(p.id)}
                  disabled={busyId !== null}
                  style={styles.row}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
                    <Muted style={{ fontSize: 11, marginTop: 2 }}>
                      {p.count} meditazion{p.count === 1 ? "e" : "i"}
                    </Muted>
                  </View>
                  {busyId === p.id ? (
                    <ActivityIndicator color={colors.brandPrimary} />
                  ) : (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  close: { color: colors.muted, fontSize: 22 },
  newRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
  },
  flash: {
    color: colors.brandPrimary,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  section: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.brandPrimary,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  emptyBox: {
    marginTop: spacing.md,
    padding: spacing.xl,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowName: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  chevron: { color: colors.brandPrimary, fontSize: 22, fontWeight: "600" },
});
