import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import FabMenu from "@/src/FabMenu";

type EnrollmentItem = {
  course: {
    id: string;
    title: string;
    cover_url: string;
    kind: "base" | "premium";
  };
  started_at: string | null;
  quiz_passed: boolean;
  certificate_id: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function MyCoursesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => api<{ items: EnrollmentItem[] }>("/me/enrollments"),
  });

  const items = data?.items || [];

  return (
    <>
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

      <Text style={s.title}>I miei Corsi</Text>
      <Text style={s.subtitle}>
        I corsi a cui ti sei iscritto. Riprendi da dove hai lasciato.
      </Text>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.brandPrimary} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🎓</Text>
          <Text style={s.emptyTitle}>Nessun corso ancora</Text>
          <Text style={s.emptyTxt}>
            Esplora la nostra Vetrina Corsi e iscriviti al primo che ti ispira.
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
          {items.map((it) => (
            <Pressable
              key={it.course.id}
              onPress={() => router.push(`/course/${it.course.id}`)}
              style={s.card}
              testID={`enroll-${it.course.id}`}
            >
              <Image
                source={{ uri: it.course.cover_url }}
                style={s.cover}
                resizeMode="cover"
              />
              <View style={s.body}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {it.course.kind === "premium" ? (
                    <Text style={s.premiumTag}>👑 Premium</Text>
                  ) : (
                    <Text style={s.baseTag}>Base</Text>
                  )}
                  {it.quiz_passed ? (
                    <Text style={s.passedTag}>✓ Superato</Text>
                  ) : null}
                </View>
                <Text style={s.courseTitle} numberOfLines={2}>
                  {it.course.title}
                </Text>
                <Text style={s.meta}>
                  Iscritto il {formatDate(it.started_at)}
                </Text>

                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                  <Pressable
                    style={s.actionPrimary}
                    onPress={() => router.push(`/course/${it.course.id}`)}
                    testID={`open-${it.course.id}`}
                  >
                    <Text style={s.actionPrimaryTxt}>
                      {it.quiz_passed ? "Rivedi" : "Riprendi"}
                    </Text>
                  </Pressable>
                  {it.certificate_id ? (
                    <Pressable
                      style={s.actionSecondary}
                      onPress={() => router.push(`/certificate/${it.certificate_id}`)}
                      testID={`cert-${it.certificate_id}`}
                    >
                      <Text style={s.actionSecondaryTxt}>🏆 Certificato</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
    <FabMenu />
    </>
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
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: {
    width: "100%",
    height: 140,
    backgroundColor: colors.surfaceTertiary,
  },
  body: { padding: spacing.md },
  premiumTag: {
    color: colors.brandPrimary,
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  baseTag: {
    color: colors.onSurfaceTertiary,
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  passedTag: {
    color: "#22c55e",
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "#22c55e22",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  courseTitle: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  actionPrimaryTxt: {
    color: colors.onBrandPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  actionSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  actionSecondaryTxt: {
    color: colors.brandPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
});
