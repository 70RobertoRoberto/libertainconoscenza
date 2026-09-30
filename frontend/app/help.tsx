import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  ActivityIndicator, RefreshControl, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import FabMenu from "@/src/FabMenu";

type Ticket = {
  id: string;
  ticket_no: string;
  subject: string;
  category: string;
  status: "open" | "waiting_user" | "resolved" | "closed";
  messages: { author: "user" | "admin"; text: string; at: string }[];
  created_at: string;
  updated_at: string;
};

const CATEGORIES = [
  { key: "generico", label: "Generico" },
  { key: "tecnico", label: "Tecnico" },
  { key: "account", label: "Account" },
  { key: "fatturazione", label: "Fatturazione" },
  { key: "contenuto", label: "Contenuti" },
];

const STATUS_LABEL: Record<string, string> = {
  open: "🟠 In lavorazione",
  waiting_user: "✉️ Ti abbiamo risposto",
  resolved: "✅ Risolto",
  closed: "🔒 Chiuso",
};

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("generico");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => api<{ items: Ticket[] }>("/me/support/tickets"),
  });
  const tickets = data?.items || [];

  const submit = async () => {
    if (subject.trim().length < 3) {
      const err = "Oggetto troppo corto (min 3 caratteri)";
      if (Platform.OS === "web") window.alert(err); else Alert.alert("Errore", err);
      return;
    }
    if (message.trim().length < 5) {
      const err = "Descrivi meglio il problema (min 5 caratteri)";
      if (Platform.OS === "web") window.alert(err); else Alert.alert("Errore", err);
      return;
    }
    setSending(true);
    try {
      const t = await api<Ticket>("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ subject: subject.trim(), message: message.trim(), category }),
      });
      setSubject("");
      setMessage("");
      setCategory("generico");
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      const ok = `Ticket #${t.ticket_no} creato!\nRiceverai risposta al più presto. Puoi vedere lo stato qui sotto.`;
      if (Platform.OS === "web") window.alert(ok); else Alert.alert("Fatto", ok);
    } catch (e: any) {
      if (Platform.OS === "web") window.alert(e?.message || "-"); else Alert.alert("Errore", e?.message || "-");
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (t: Ticket) => {
    const text = (replyDraft[t.id] || "").trim();
    if (!text) return;
    try {
      await api(`/me/support/tickets/${t.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setReplyDraft({ ...replyDraft, [t.id]: "" });
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (e: any) {
      if (Platform.OS === "web") window.alert(e?.message || "-"); else Alert.alert("Errore", e?.message || "-");
    }
  };

  return (
    <>
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
        <Text style={s.headerTitle}>Assistenza</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={s.intro}>
          Hai bisogno di aiuto? Apri una richiesta e ti risponderemo entro pochi giorni lavorativi.
          Riceverai la conferma direttamente qui e via email quando attiveremo la notifica automatica.
        </Text>

        <View style={s.card}>
          <Text style={s.sectionTitle}>Nuova richiesta</Text>

          <Text style={s.label}>Categoria</Text>
          <View style={s.catRow}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[s.chip, active && s.chipActive]}
                  testID={`cat-${c.key}`}
                >
                  <Text style={[s.chipTxt, active && s.chipTxtActive]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.label}>Oggetto</Text>
          <TextInput
            testID="help-subject"
            value={subject}
            onChangeText={setSubject}
            placeholder="Riassumi il problema in una frase"
            placeholderTextColor={colors.muted}
            style={s.input}
            maxLength={140}
          />

          <Text style={s.label}>Descrizione</Text>
          <TextInput
            testID="help-message"
            value={message}
            onChangeText={setMessage}
            placeholder="Descrivi il problema con più dettagli possibili (schermata, corso, orario…)"
            placeholderTextColor={colors.muted}
            style={[s.input, s.textarea]}
            multiline
            numberOfLines={5}
            maxLength={5000}
          />

          <Pressable onPress={submit} disabled={sending} style={s.submitBtn} testID="help-submit">
            {sending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={s.submitTxt}>Invia richiesta</Text>
            )}
          </Pressable>
        </View>

        <Text style={s.sectionH}>Le mie richieste</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.lg }} />
        ) : tickets.length === 0 ? (
          <Text style={s.empty}>Nessuna richiesta ancora.</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {tickets.map((t) => {
              const open = expanded === t.id;
              return (
                <View key={t.id} style={s.ticket}>
                  <Pressable
                    onPress={() => setExpanded(open ? null : t.id)}
                    testID={`ticket-${t.ticket_no}`}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Text style={s.tno}>#{t.ticket_no}</Text>
                      <Text style={s.status}>{STATUS_LABEL[t.status] || t.status}</Text>
                    </View>
                    <Text style={s.subj} numberOfLines={2}>{t.subject}</Text>
                    <Text style={s.meta}>
                      {t.category} · {new Date(t.updated_at).toLocaleDateString("it-IT")}
                    </Text>
                  </Pressable>
                  {open ? (
                    <View style={{ marginTop: spacing.md }}>
                      {t.messages.map((m, i) => (
                        <View key={i} style={[s.msg, m.author === "admin" ? s.msgAdmin : s.msgUser]}>
                          <Text style={s.msgAuthor}>{m.author === "admin" ? "Assistenza" : "Tu"}</Text>
                          <Text style={s.msgTxt}>{m.text}</Text>
                          <Text style={s.msgAt}>{new Date(m.at).toLocaleString("it-IT")}</Text>
                        </View>
                      ))}
                      {t.status !== "closed" ? (
                        <View style={{ marginTop: spacing.sm, flexDirection: "row", gap: 8 }}>
                          <TextInput
                            value={replyDraft[t.id] || ""}
                            onChangeText={(v) => setReplyDraft({ ...replyDraft, [t.id]: v })}
                            placeholder="Scrivi una risposta"
                            placeholderTextColor={colors.muted}
                            style={[s.input, { flex: 1, marginBottom: 0 }]}
                          />
                          <Pressable onPress={() => sendReply(t)} style={s.replyBtn}>
                            <Text style={s.replyTxt}>Invia</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
    <FabMenu />
    </>
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
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.onSurface, fontSize: 15, fontWeight: "800", marginBottom: spacing.md,
  },
  sectionH: {
    color: colors.onSurface, fontSize: 16, fontWeight: "700",
    marginTop: spacing.xl, marginBottom: spacing.md,
  },
  label: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700", marginTop: spacing.sm, marginBottom: 6 },
  catRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  chipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  chipTxt: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700" },
  chipTxtActive: { color: colors.brandPrimary },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  textarea: { minHeight: 96, textAlignVertical: "top", paddingTop: 10 },
  submitBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitTxt: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 },
  empty: { color: colors.muted, fontStyle: "italic", textAlign: "center", marginTop: spacing.md },
  ticket: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tno: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  status: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" },
  subj: { color: colors.onSurface, fontSize: 14, fontWeight: "700", marginTop: 4 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  msg: {
    borderRadius: radius.md,
    padding: 10,
    marginTop: 6,
  },
  msgUser: { backgroundColor: colors.surfaceTertiary, alignSelf: "flex-end", maxWidth: "88%" },
  msgAdmin: { backgroundColor: colors.brandTertiary, alignSelf: "flex-start", maxWidth: "88%", borderWidth: 1, borderColor: colors.brandPrimary },
  msgAuthor: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", marginBottom: 2 },
  msgTxt: { color: colors.onSurface, fontSize: 13, lineHeight: 18 },
  msgAt: { color: colors.muted, fontSize: 10, marginTop: 4 },
  replyBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  replyTxt: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 13 },
});
