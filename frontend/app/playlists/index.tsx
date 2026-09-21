import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { Muted, GoldButton, Card } from "@/src/ui";

type PlaylistRow = { id: string; name: string; count: number; updated_at?: string };

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, refetch, isFetching, isLoading } = useQuery({
    queryKey: ["my-playlists"],
    queryFn: () => api<{ items: PlaylistRow[] }>("/playlists"),
  });

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    setCreating(true);
    try {
      await api("/playlists", { method: "POST", body: JSON.stringify({ name: n }) });
      setName("");
      qc.invalidateQueries({ queryKey: ["my-playlists"] });
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (p: PlaylistRow) => {
    Alert.alert(
      "Elimina playlist",
      `Vuoi eliminare "${p.name}"? Le meditazioni non saranno rimosse dai preferiti.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            await api(`/playlists/${p.id}`, { method: "DELETE" });
            qc.invalidateQueries({ queryKey: ["my-playlists"] });
          },
        },
      ]
    );
  };

  const items = data?.items || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen options={{ title: "Le mie playlist", headerBackTitle: "Indietro" }} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        <Text style={styles.title}>Le mie playlist</Text>
        <Muted style={{ marginTop: 4, marginBottom: spacing.lg }}>
          Crea sequenze personali di meditazioni per il tuo momento di pratica.
        </Muted>

        <Card>
          <Text style={styles.section}>Nuova playlist</Text>
          <TextInput
            testID="new-name"
            value={name}
            onChangeText={setName}
            placeholder="Es: Serata di calma"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={80}
            onSubmitEditing={create}
            returnKeyType="done"
          />
          <GoldButton
            testID="btn-create"
            label="Crea playlist"
            onPress={create}
            loading={creating}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Text style={styles.section}>Le tue playlist</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎧</Text>
            <Muted style={{ textAlign: "center", marginTop: spacing.sm }}>
              Ancora nessuna playlist.{"\n"}Creane una qui sopra oppure aggiungi una meditazione dalla pagina di ascolto.
            </Muted>
          </View>
        ) : (
          items.map((p) => (
            <Pressable
              key={p.id}
              testID={`pl-row-${p.id}`}
              onPress={() => router.push(`/playlists/${p.id}` as any)}
              style={styles.row}
            >
              <View style={styles.icon}>
                <Text style={{ fontSize: 22 }}>🎵</Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
                <Muted style={{ fontSize: 12, marginTop: 2 }}>
                  {p.count} meditazion{p.count === 1 ? "e" : "i"}
                </Muted>
              </View>
              <Pressable
                testID={`del-${p.id}`}
                onPress={() => confirmDelete(p)}
                hitSlop={10}
                style={{ paddingHorizontal: spacing.sm }}
              >
                <Text style={{ color: colors.error, fontSize: 20 }}>🗑</Text>
              </Pressable>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800" },
  section: {
    color: colors.brandPrimary,
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: "800",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.brandPrimary + "60",
  },
  rowName: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  chevron: { color: colors.brandPrimary, fontSize: 22, fontWeight: "600", marginLeft: 4 },
  empty: {
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
