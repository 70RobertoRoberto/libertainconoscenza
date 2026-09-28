import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

type QuizView = {
  questions: { id: string; text: string; answers: { text: string }[] }[];
  pass_threshold: number;
  max_attempts: number;
  attempts_used: number;
  passed: boolean;
  certificate_id: string | null;
};

type AttemptResult = {
  score: number;
  correct_count?: number;
  total_questions?: number;
  passed: boolean;
  attempts_used: number;
  max_attempts: number;
  per_question: { question_id: string; correct_index: number; user_index: number; is_correct: boolean; explanation: string }[];
  certificate_id: string | null;
  feedback?: string | null;
};

function toast(t: string, m?: string) {
  const text = m ? `${t}\n\n${m}` : t;
  if (Platform.OS === "web") { if (typeof window !== "undefined") window.alert(text); return; }
  Alert.alert(t, m);
}

export default function CourseQuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["u-quiz", id],
    queryFn: () => api<QuizView>(`/courses/${id}/quiz-view`),
    enabled: !!id,
    refetchOnMount: "always",
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allAnswered = useMemo(
    () => (data ? data.questions.every((q) => answers[q.id] != null) : false),
    [data, answers],
  );

  if (isLoading || !data) return <View style={s.centered}><ActivityIndicator color={colors.brandPrimary} /></View>;

  const remaining = Math.max(0, data.max_attempts - data.attempts_used);
  const exhausted = remaining <= 0 && !data.passed;

  const submit = async () => {
    if (!allAnswered) return toast("Rispondi a tutte le domande");
    setSubmitting(true);
    try {
      const r = await api<AttemptResult>(`/courses/${id}/quiz-view/attempt`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setResult(r);
    } catch (e: any) {
      toast("Errore", e?.message || "-");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.xl, paddingBottom: 40 }}>
        <View style={[s.resultBox, result.passed ? s.pass : s.fail]}>
          <Text style={s.resultBig}>{result.passed ? "🏆" : "😊"}</Text>
          <Text style={s.resultTitle}>{result.passed ? "Quiz superato!" : "Non superato"}</Text>
          {typeof result.correct_count === "number" && typeof result.total_questions === "number" ? (
            <Text style={s.resultSub}>
              {result.correct_count} su {result.total_questions} corrette · {Math.round(result.score * 100)}%
            </Text>
          ) : (
            <Text style={s.resultSub}>Punteggio: {Math.round(result.score * 100)}%</Text>
          )}
          <Text style={s.resultSub}>
            Tentativi: {result.attempts_used}/{result.max_attempts}
          </Text>
        </View>
        {result.feedback ? (
          <View style={s.feedbackBox}>
            <Text style={s.feedbackLabel}>📝  Risultato valutazione</Text>
            <Text style={s.feedbackTxt}>{result.feedback}</Text>
          </View>
        ) : null}
        {result.passed && result.certificate_id ? (
          <Pressable
            onPress={() => router.replace(`/certificate/${result.certificate_id}` as any)}
            style={[s.btn, s.btnPrimary, { marginTop: spacing.lg }]}
          >
            <Text style={s.btnPrimaryTxt}>🏆  Vedi il tuo certificato</Text>
          </Pressable>
        ) : result.attempts_used < result.max_attempts ? (
          <Pressable
            onPress={() => { setResult(null); setAnswers({}); refetch(); }}
            style={[s.btn, s.btnPrimary, { marginTop: spacing.lg }]}
          >
            <Text style={s.btnPrimaryTxt}>Riprova ({result.max_attempts - result.attempts_used} tentativi rimasti)</Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 12, fontStyle: "italic" }}>
            Tentativi esauriti. Puoi rifare il corso in un secondo momento.
          </Text>
        )}

        {/* Per-question feedback */}
        <Text style={s.sectionTitle}>Riepilogo risposte</Text>
        {data.questions.map((q, i) => {
          const info = result.per_question.find((p) => p.question_id === q.id);
          if (!info) return null;
          return (
            <View key={q.id} style={[s.qCard, info.is_correct ? s.qOk : s.qKo]}>
              <Text style={s.qHead}>{i + 1}. {q.text}</Text>
              {q.answers.map((a, ai) => {
                const isCorrect = ai === info.correct_index;
                const isUser = ai === info.user_index;
                return (
                  <View key={ai} style={[
                    s.aRow,
                    isCorrect && s.aCorrect,
                    isUser && !isCorrect && s.aWrong,
                  ]}>
                    <Text style={s.aTxt}>
                      {isCorrect ? "✓ " : isUser ? "✗ " : "○ "}{a.text}
                    </Text>
                  </View>
                );
              })}
              {info.explanation ? (
                <Text style={s.explanation}>💡  {info.explanation}</Text>
              ) : null}
            </View>
          );
        })}

        <Pressable onPress={() => router.replace(`/course/${id}` as any)} style={[s.btn, { marginTop: spacing.xl }]}>
          <Text style={s.btnTxt}>Torna al corso</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.backTxt}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Quiz finale</Text>
          <Text style={s.headerSub}>
            Soglia {Math.round(data.pass_threshold * 100)}% · Tentativi: {data.attempts_used}/{data.max_attempts}
          </Text>
        </View>
      </View>

      {data.passed ? (
        <View style={s.centered}>
          <Text style={s.resultBig}>🏆</Text>
          <Text style={s.resultTitle}>Hai già superato questo quiz</Text>
          {data.certificate_id ? (
            <Pressable
              onPress={() => router.replace(`/certificate/${data.certificate_id}` as any)}
              style={[s.btn, s.btnPrimary, { marginTop: spacing.lg }]}
            >
              <Text style={s.btnPrimaryTxt}>Vedi il tuo certificato</Text>
            </Pressable>
          ) : null}
        </View>
      ) : exhausted ? (
        <View style={s.centered}>
          <Text style={{ color: colors.onSurface, fontSize: 16, textAlign: "center" }}>
            Hai esaurito i {data.max_attempts} tentativi. Rientra nel corso più avanti per riprovare.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {data.questions.map((q, i) => (
            <View key={q.id} style={s.qCard}>
              <Text style={s.qHead}>{i + 1}. {q.text}</Text>
              {q.answers.map((a, ai) => {
                const selected = answers[q.id] === ai;
                return (
                  <Pressable
                    key={ai}
                    onPress={() => setAnswers({ ...answers, [q.id]: ai })}
                    style={[s.answerBtn, selected && s.answerSel]}
                  >
                    <View style={[s.dot, selected && s.dotOn]}>
                      {selected ? <View style={s.dotInner} /> : null}
                    </View>
                    <Text style={[s.aTxt, { flex: 1 }]}>{a.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <Pressable
            onPress={submit}
            disabled={!allAnswered || submitting}
            style={[s.btn, s.btnPrimary, (!allAnswered || submitting) && { opacity: 0.5 }]}
          >
            {submitting ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <Text style={s.btnPrimaryTxt}>Invia risposte</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12,
  },
  backTxt: { color: colors.brandPrimary, fontSize: 26, fontWeight: "700", paddingHorizontal: 6 },
  headerTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  headerSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  qCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  qOk: { borderColor: "#3aa055" },
  qKo: { borderColor: "#c33" },
  qHead: { color: colors.onSurface, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  answerBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderRadius: radius.sm, marginTop: 6,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  answerSel: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  dotOn: { borderColor: colors.brandPrimary },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  aRow: { padding: 8, borderRadius: radius.sm, marginTop: 4 },
  aCorrect: { backgroundColor: "rgba(58,160,85,0.15)" },
  aWrong: { backgroundColor: "rgba(200,50,50,0.15)" },
  aTxt: { color: colors.onSurface, fontSize: 14 },
  explanation: { marginTop: 8, color: colors.onSurfaceSecondary, fontSize: 13, fontStyle: "italic", padding: 8, backgroundColor: colors.brandTertiary, borderRadius: radius.sm },
  btn: { paddingVertical: 14, borderRadius: radius.md, alignItems: "center", marginTop: spacing.lg, borderWidth: 1, borderColor: colors.brandPrimary },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnPrimaryTxt: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  btnTxt: { color: colors.brandPrimary, fontWeight: "800", fontSize: 14 },
  resultBox: { alignItems: "center", padding: spacing.xl, borderRadius: radius.lg, borderWidth: 2 },
  pass: { borderColor: "#3aa055", backgroundColor: "rgba(58,160,85,0.08)" },
  fail: { borderColor: "#c33", backgroundColor: "rgba(200,50,50,0.06)" },
  resultBig: { fontSize: 60 },
  resultTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800", marginTop: 8 },
  resultSub: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 4 },
  feedbackBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  feedbackLabel: {
    color: colors.brandPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  feedbackTxt: {
    color: colors.onSurface,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Georgia",
  },
  sectionTitle: {
    color: colors.brandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 2,
    textTransform: "uppercase", marginTop: spacing.xl, marginBottom: spacing.sm,
  },
});
