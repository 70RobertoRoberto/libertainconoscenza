import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

type CertItem = {
  id: string;
  course_id: string;
  course_title: string;
  issued_at: string | null;
  score: number;
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function MyCertificatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => api<{ items: CertItem[] }>("/me/certificates"),
  });

  const items = data?.items || [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.xxxl,
        paddingHorizontal: spacing.xl,
      }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />
      }
    >
      <View style={s.headerRow}>
        <Pressable onPress={() => router.back()} testID="back-btn" style={s.backBtn}>
          <Text style={s.backTxt}>← Indietro</Text>
        </Pressable>
      </View>

      <Text style={s.title}>I miei Certificati</Text>
      <Text style={s.subtitle}>
        Attestati di partecipazione ai corsi che hai completato con successo.
      </Text>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.brandPrimary} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🏆</Text>
          <Text style={s.emptyTitle}>Nessun certificato ancora</Text>
          <Text style={s.emptyTxt}>
            Completa un corso e supera il quiz finale per ottenere il tuo primo attestato.
          </Text>
          <Pressable
            style={s.cta}
            onPress={() => router.replace("/(tabs)/corsi")}
            testID="go-corsi"
          >
            <Text style={s.ctaTxt}>Vai a Corsi</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          {items.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/certificate/${c.id}`)}
              style={s.card}
              testID={`cert-${c.id}`}
            >
              <View style={s.medalCircle}>
                <Text style={s.medalIcon}>🏆</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.courseTitle} numberOfLines={2}>
                  {c.course_title}
                </Text>
                <Text style={s.meta}>
                  Rilasciato il {formatDate(c.issued_at)}
                </Text>
                <Text style={s.score}>
                  Punteggio: {Math.round((c.score || 0) * 100)}%
                </Text>
              </View>
              <Text style={s.chev}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  backBtn: { paddingVertical: 4, paddingRight: spacing.md },
  backTxt: { color: colors.brandPrimary, fontSize: 15, fontWeight: "600" },
  title: {
    color: colors.onSurface,
    fontSize: 24,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  empty: {
    marginTop: spacing.xxl,
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  emptyTxt: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 280,
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  ctaTxt: { color: colors.onBrandPrimary, fontWeight: "700" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  medalCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  medalIcon: { fontSize: 26 },
  courseTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "700",
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  score: {
    color: colors.brandPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  chev: {
    color: colors.brandPrimary,
    fontSize: 28,
    fontWeight: "300",
    paddingHorizontal: spacing.sm,
  },
});
