import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

type LoginEntry = {
  at: string;
  device?: string;
  ip?: string;
  ua?: string;
  kind?: string;
};

export default function LoginHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["login-history"],
    queryFn: () => api<{ items: LoginEntry[] }>("/me/login-history"),
  });
  const items = data?.items || [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xxxl,
      }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />
      }
    >
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} hitSlop={10}>
          <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={s.headerTitle}>Accessi recenti</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={s.intro}>
          Elenco degli ultimi accessi al tuo account. Se noti un dispositivo che non riconosci, cambia subito password.
        </Text>

        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.lg }} />
        ) : items.length === 0 ? (
          <Text style={s.empty}>Nessun accesso registrato.</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {items.map((it, i) => (
              <View key={i} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.device}>
                    {it.kind === "register" ? "📝 Registrazione · " : ""}
                    {it.device || "Dispositivo sconosciuto"}
                  </Text>
                  <Text style={s.meta}>{new Date(it.at).toLocaleString("it-IT")}</Text>
                  {it.ip ? <Text style={s.meta}>IP: {it.ip}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  intro: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  empty: { color: colors.muted, fontStyle: "italic", textAlign: "center", marginTop: spacing.md },
  row: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  device: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
