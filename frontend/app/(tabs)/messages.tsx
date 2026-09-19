import React from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { Muted } from "@/src/ui";

export default function Messages() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["messages"],
    queryFn: () => api<{ items: any[] }>("/messages"),
  });

  const markRead = async (id: string) => {
    await api(`/messages/${id}/read`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.md, paddingHorizontal: spacing.xl }}>
        <Text style={styles.title}>Messaggi</Text>
        <Muted style={{ marginTop: 4 }}>Comunicazioni dalla community</Muted>
      </View>
      <FlatList
        data={data?.items || []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={
          <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
            <Muted>Nessun messaggio</Muted>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`msg-${item.id}`}
            onPress={() => !item.read && markRead(item.id)}
            style={styles.card}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                {!item.read ? <View style={styles.dot} /> : null}
                <Text style={styles.msgTitle}>{item.title}</Text>
              </View>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString("it-IT")}</Text>
            </View>
            <Text style={styles.body}>{item.body}</Text>
            {item.is_broadcast ? (
              <Text style={styles.tag}>· Community</Text>
            ) : (
              <Text style={styles.tag}>· Personale</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "700" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
  msgTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  date: { color: colors.muted, fontSize: 11 },
  body: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: spacing.sm, lineHeight: 20 },
  tag: { color: colors.brandPrimary, fontSize: 11, fontWeight: "600", marginTop: spacing.sm },
});
