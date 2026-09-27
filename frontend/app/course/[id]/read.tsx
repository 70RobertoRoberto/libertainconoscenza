import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { RichViewer } from "@/src/RichEditor";

type Topic = {
  id: string; title: string; kind: string; content_html: string; order: number;
};
type CourseDetail = {
  course: { id: string; title: string; has_quiz: boolean };
  topics_summary: { id: string; title: string; kind: string; order: number }[];
  enrolled: boolean;
};

const KIND_LABELS: Record<string, string> = {
  presentazione: "Presentazione", apertura: "Apertura", modulo: "Modulo",
  laboratorio: "Laboratorio", sintesi: "Sintesi", ponte: "Ponte", bibliografia: "Bibliografia",
};

function toast(t: string, m?: string) {
  const text = m ? `${t}\n\n${m}` : t;
  if (Platform.OS === "web") { if (typeof window !== "undefined") window.alert(text); return; }
  Alert.alert(t, m);
}

export default function CourseReadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);

  const { data: courseData } = useQuery({
    queryKey: ["u-course", id],
    queryFn: () => api<CourseDetail>(`/courses/${id}`),
    enabled: !!id,
  });
  const topics = courseData?.topics_summary || [];
  const current = topics[idx];

  const { data: topicData, isLoading } = useQuery({
    queryKey: ["u-topic", id, current?.id],
    queryFn: () => api<Topic>(`/courses/${id}/topics/${current!.id}`),
    enabled: !!current?.id,
  });

  const isLast = idx === topics.length - 1;
  const hasQuiz = courseData?.course?.has_quiz;

  const progress = useMemo(() => (topics.length ? (idx + 1) / topics.length : 0), [idx, topics.length]);

  if (!courseData) {
    return <View style={styles.centered}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }
  if (!courseData.enrolled) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.onSurface, fontSize: 16 }}>Devi iscriverti al corso</Text>
        <Pressable onPress={() => router.replace(`/course/${id}` as any)} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.brandPrimary }}>← Vai al dettaglio</Text>
        </Pressable>
      </View>
    );
  }
  if (topics.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.muted, fontStyle: "italic" }}>Nessun argomento in questo corso.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{courseData.course.title}</Text>
          <Text style={styles.headerSub}>
            {KIND_LABELS[current.kind] || current.kind} · {idx + 1}/{topics.length}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <Text style={styles.topicTitle}>{current.title}</Text>
        {isLoading || !topicData ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : (
          <View style={{ height: 500 }}>
            <RichViewer html={topicData.content_html} />
          </View>
        )}
      </ScrollView>

      {/* Navigation bar */}
      <View style={[styles.navBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          style={[styles.navBtn, idx === 0 && styles.navBtnDisabled]}
        >
          <Text style={styles.navTxt}>‹ Precedente</Text>
        </Pressable>
        {isLast && hasQuiz ? (
          <Pressable
            onPress={() => router.push(`/course/${id}/quiz` as any)}
            style={[styles.navBtn, styles.navPrimary]}
          >
            <Text style={[styles.navTxt, { color: colors.onBrandPrimary }]}>Vai al Quiz →</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setIdx(Math.min(topics.length - 1, idx + 1))}
            disabled={isLast}
            style={[styles.navBtn, styles.navPrimary, isLast && styles.navBtnDisabled]}
          >
            <Text style={[styles.navTxt, { color: colors.onBrandPrimary }]}>Successivo ›</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, padding: spacing.xl },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12,
  },
  backTxt: { color: colors.brandPrimary, fontSize: 26, fontWeight: "700", paddingHorizontal: 6 },
  headerTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  headerSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  progressBar: { height: 3, backgroundColor: colors.divider },
  progressFill: { height: 3, backgroundColor: colors.brandPrimary },
  body: { padding: spacing.xl, paddingBottom: 40 },
  topicTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "800", marginBottom: spacing.md },
  navBar: {
    flexDirection: "row", gap: 10, padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.divider,
  },
  navBtn: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: "center",
    borderWidth: 1, borderColor: colors.brandPrimary, backgroundColor: colors.surfaceSecondary,
  },
  navPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  navBtnDisabled: { opacity: 0.4 },
  navTxt: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
});

// Prevent unused import warnings on non-web platforms.
void toast;
