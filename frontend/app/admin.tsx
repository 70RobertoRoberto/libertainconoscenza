import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { GoldButton, OutlineButton, Muted, Card } from "@/src/ui";

const CATEGORIES = [
  "Crescita personale", "Spirituale", "Fisica quantistica", "Meditazione",
  "Discipline orientali", "Naturopatia", "Psicologia", "Medicina Integrata",
  "Filosofia", "Nutrizione", "Somatognostica", "Video",
];

type Section = "stats" | "articles" | "media" | "messages" | "users" | "orders";

export default function Admin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>("stats");

  const sections: { key: Section; label: string }[] = [
    { key: "stats", label: "Statistiche" },
    { key: "articles", label: "Articoli" },
    { key: "media", label: "Video/Med." },
    { key: "messages", label: "Messaggi" },
    { key: "users", label: "Utenti" },
    { key: "orders", label: "Ordini" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.title}>Amministrazione</Text>
          <Pressable testID="admin-back" onPress={() => router.back()}>
            <Text style={{ color: colors.brandPrimary, fontSize: 15 }}>Chiudi</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}
        >
          {sections.map((s) => {
            const active = s.key === section;
            return (
              <Pressable
                key={s.key}
                testID={`admin-tab-${s.key}`}
                onPress={() => setSection(s.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {section === "stats" && <StatsSection />}
        {section === "articles" && <ArticlesSection />}
        {section === "media" && <MediaSection />}
        {section === "messages" && <MessagesSection />}
        {section === "users" && <UsersSection />}
        {section === "orders" && <OrdersSection />}
      </KeyboardAvoidingView>
    </View>
  );
}

/* ─────── Stats ─────── */
function StatsSection() {
  const insets = useSafeAreaInsets();
  const { data: summary } = useQuery({
    queryKey: ["stats-summary"],
    queryFn: () => api<any>("/admin/stats/summary"),
  });
  const { data: daily } = useQuery({
    queryKey: ["stats-daily"],
    queryFn: () => api<{ items: any[] }>("/admin/stats/daily?days=14"),
  });
  const { data: top } = useQuery({
    queryKey: ["stats-top"],
    queryFn: () => api<any>("/admin/stats/top-content?limit=10"),
  });

  const maxViews = Math.max(1, ...(daily?.items || []).map((x) => x.views));

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
        <StatCard label="Utenti" value={summary?.users ?? "—"} />
        <StatCard label="Premium" value={summary?.premium_users ?? "—"} />
        <StatCard label="Articoli" value={summary?.articles ?? "—"} />
        <StatCard label="Media" value={summary?.media ?? "—"} />
        <StatCard label="Viste totali" value={summary?.total_views ?? "—"} full />
      </View>

      <Text style={styles.section}>Visualizzazioni giornaliere</Text>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 160, gap: 4 }}>
          {(daily?.items || []).map((d) => (
            <View key={d.date} style={{ flex: 1, alignItems: "center" }}>
              <View style={{
                width: "100%",
                height: `${(d.views / maxViews) * 100}%`,
                backgroundColor: colors.brandPrimary,
                borderRadius: 4,
                minHeight: 2,
              }} />
              <Text style={styles.chartLbl}>{d.date.slice(5)}</Text>
            </View>
          ))}
          {!daily?.items?.length && <Muted>Nessun dato</Muted>}
        </View>
      </Card>

      <Text style={styles.section}>Articoli più letti</Text>
      <Card>
        {(top?.articles || []).map((a: any) => (
          <View key={a.id} style={styles.topRow}>
            <Text style={styles.topTitle} numberOfLines={1}>{a.title}</Text>
            <Text style={styles.topViews}>{a.views}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.section}>Video/Meditazioni più viste</Text>
      <Card>
        {(top?.media || []).map((m: any) => (
          <View key={m.id} style={styles.topRow}>
            <Text style={styles.topTitle} numberOfLines={1}>{m.title}</Text>
            <Text style={styles.topViews}>{m.views}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function StatCard({ label, value, full }: { label: string; value: any; full?: boolean }) {
  return (
    <View style={[styles.statCard, full && { flexBasis: "100%" }]}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

/* ─────── Articles ─────── */
function ArticlesSection() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-articles"], queryFn: () => api<any>("/articles?limit=200") });
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState("Crescita personale");
  const [premium, setPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const create = async () => {
    setLoading(true); setMsg("");
    try {
      if (mode === "ai") {
        if (!url) throw new Error("Inserisci URL");
        await api("/admin/articles/summarize", {
          method: "POST",
          body: JSON.stringify({ url, category: cat, is_premium: premium }),
        });
      } else {
        if (!title || !summary) throw new Error("Titolo e testo richiesti");
        await api("/admin/articles", {
          method: "POST",
          body: JSON.stringify({ title, summary, category: cat, is_premium: premium }),
        });
      }
      setTitle(""); setSummary(""); setUrl("");
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      setMsg("Articolo creato");
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    await api(`/admin/articles/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["admin-articles"] });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Card>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
          <Pressable testID="mode-manual" onPress={() => setMode("manual")} style={[styles.smallChip, mode === "manual" && styles.smallChipActive]}>
            <Text style={mode === "manual" ? styles.smallChipTxtActive : styles.smallChipTxt}>Manuale</Text>
          </Pressable>
          <Pressable testID="mode-ai" onPress={() => setMode("ai")} style={[styles.smallChip, mode === "ai" && styles.smallChipActive]}>
            <Text style={mode === "ai" ? styles.smallChipTxtActive : styles.smallChipTxt}>Da URL con AI</Text>
          </Pressable>
        </View>

        {mode === "ai" ? (
          <TextInput
            testID="ai-url"
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.summaaurea.org/..."
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        ) : (
          <>
            <TextInput
              testID="article-title"
              value={title}
              onChangeText={setTitle}
              placeholder="Titolo"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              testID="article-summary"
              value={summary}
              onChangeText={setSummary}
              placeholder="Testo (max 25-30 righe)"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, { minHeight: 140, textAlignVertical: "top", marginTop: spacing.md }]}
            />
          </>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.md }}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[styles.smallChip, cat === c && styles.smallChipActive]}>
              <Text style={cat === c ? styles.smallChipTxtActive : styles.smallChipTxt}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable testID="toggle-premium" onPress={() => setPremium(!premium)} style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={[styles.checkbox, premium && { backgroundColor: colors.brandPrimary }]} />
          <Text style={{ color: colors.onSurface }}>Contenuto Premium</Text>
        </Pressable>

        {msg ? <Text style={{ color: colors.brandPrimary, marginTop: spacing.sm }}>{msg}</Text> : null}
        <GoldButton testID="save-article" label={mode === "ai" ? "Sintetizza e salva" : "Salva articolo"} onPress={create} loading={loading} style={{ marginTop: spacing.md }} />
      </Card>

      <Text style={styles.section}>Articoli esistenti</Text>
      {(data?.items || []).map((a: any) => (
        <View key={a.id} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle} numberOfLines={1}>{a.title}</Text>
            <Muted style={{ fontSize: 11 }}>{a.category} · {a.views} letture{a.is_premium ? " · PREMIUM" : ""}</Muted>
          </View>
          <Pressable testID={`del-article-${a.id}`} onPress={() => remove(a.id)}>
            <Text style={{ color: colors.error, fontWeight: "700" }}>Elimina</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─────── Media ─────── */
function MediaSection() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-media"], queryFn: () => api<any>("/media") });
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [thumb, setThumb] = useState("");
  const [kind, setKind] = useState<"meditation" | "video">("meditation");
  const [cat, setCat] = useState("Meditazione");
  const [duration, setDuration] = useState("");
  const [premium, setPremium] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true); setMsg("");
    try {
      if (!title || !url) throw new Error("Titolo e URL richiesti");
      await api("/admin/media", {
        method: "POST",
        body: JSON.stringify({
          title, description: desc, media_url: url,
          thumbnail_url: thumb || null, kind, category: cat,
          duration_sec: duration ? parseInt(duration) * 60 : null,
          is_premium: premium,
        }),
      });
      setTitle(""); setDesc(""); setUrl(""); setThumb(""); setDuration("");
      qc.invalidateQueries({ queryKey: ["admin-media"] });
      setMsg("Contenuto caricato");
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    await api(`/admin/media/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["admin-media"] });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Card>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
          <Pressable onPress={() => setKind("meditation")} style={[styles.smallChip, kind === "meditation" && styles.smallChipActive]}>
            <Text style={kind === "meditation" ? styles.smallChipTxtActive : styles.smallChipTxt}>Meditazione</Text>
          </Pressable>
          <Pressable onPress={() => setKind("video")} style={[styles.smallChip, kind === "video" && styles.smallChipActive]}>
            <Text style={kind === "video" ? styles.smallChipTxtActive : styles.smallChipTxt}>Video</Text>
          </Pressable>
        </View>
        <TextInput testID="media-title" value={title} onChangeText={setTitle} placeholder="Titolo" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput testID="media-url" value={url} onChangeText={setUrl} placeholder="URL video/audio (YouTube, mp3, mp4)" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: spacing.md }]} autoCapitalize="none" />
        <TextInput value={thumb} onChangeText={setThumb} placeholder="URL immagine anteprima (facoltativo)" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: spacing.md }]} autoCapitalize="none" />
        <TextInput value={desc} onChangeText={setDesc} placeholder="Descrizione" placeholderTextColor={colors.muted} multiline style={[styles.input, { marginTop: spacing.md, minHeight: 80, textAlignVertical: "top" }]} />
        <TextInput value={duration} onChangeText={setDuration} placeholder="Durata in minuti" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, { marginTop: spacing.md }]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.md }}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[styles.smallChip, cat === c && styles.smallChipActive]}>
              <Text style={cat === c ? styles.smallChipTxtActive : styles.smallChipTxt}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={() => setPremium(!premium)} style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={[styles.checkbox, premium && { backgroundColor: colors.brandPrimary }]} />
          <Text style={{ color: colors.onSurface }}>Contenuto Premium</Text>
        </Pressable>
        {msg ? <Text style={{ color: colors.brandPrimary, marginTop: spacing.sm }}>{msg}</Text> : null}
        <GoldButton testID="save-media" label="Carica contenuto" onPress={create} loading={loading} style={{ marginTop: spacing.md }} />
      </Card>

      <Text style={styles.section}>Media caricati</Text>
      {(data?.items || []).map((m: any) => (
        <View key={m.id} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle} numberOfLines={1}>{m.title}</Text>
            <Muted style={{ fontSize: 11 }}>{m.kind} · {m.category} · {m.views} viste{m.is_premium ? " · PREMIUM" : ""}</Muted>
          </View>
          <Pressable onPress={() => remove(m.id)}>
            <Text style={{ color: colors.error, fontWeight: "700" }}>Elimina</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─────── Messages ─────── */
function MessagesSection() {
  const insets = useSafeAreaInsets();
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => api<any>("/admin/users") });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true); setMsg("");
    try {
      if (!title || !body) throw new Error("Titolo e messaggio richiesti");
      await api("/admin/messages", {
        method: "POST",
        body: JSON.stringify({ title, body, target_user_id: targetId }),
      });
      setTitle(""); setBody("");
      setMsg("Messaggio inviato");
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Card>
        <TextInput value={title} onChangeText={setTitle} placeholder="Titolo del messaggio" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={body} onChangeText={setBody} placeholder="Testo del messaggio" placeholderTextColor={colors.muted} multiline style={[styles.input, { marginTop: spacing.md, minHeight: 120, textAlignVertical: "top" }]} />
        <Text style={{ color: colors.muted, marginTop: spacing.md, fontSize: 12 }}>Destinatario:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Pressable onPress={() => setTargetId(null)} style={[styles.smallChip, targetId === null && styles.smallChipActive]}>
            <Text style={targetId === null ? styles.smallChipTxtActive : styles.smallChipTxt}>Tutti (community)</Text>
          </Pressable>
          {(users?.items || []).map((u: any) => (
            <Pressable key={u.id} onPress={() => setTargetId(u.id)} style={[styles.smallChip, targetId === u.id && styles.smallChipActive]}>
              <Text style={targetId === u.id ? styles.smallChipTxtActive : styles.smallChipTxt}>{u.name || u.phone}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {msg ? <Text style={{ color: colors.brandPrimary, marginTop: spacing.sm }}>{msg}</Text> : null}
        <GoldButton testID="send-msg" label="Invia messaggio" onPress={send} loading={loading} style={{ marginTop: spacing.md }} />
      </Card>
    </ScrollView>
  );
}

/* ─────── Users ─────── */
function UsersSection() {
  const insets = useSafeAreaInsets();
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: () => api<any>("/admin/users") });
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      {(data?.items || []).map((u: any) => (
        <View key={u.id} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{u.name || "—"}</Text>
            <Muted style={{ fontSize: 12 }}>{u.phone}</Muted>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: u.subscription?.status === "premium" ? colors.brandPrimary : colors.muted, fontSize: 12, fontWeight: "700" }}>
              {u.subscription?.status === "premium" ? "PREMIUM" : "GRATUITO"}
            </Text>
            {u.is_admin ? <Text style={{ color: colors.success, fontSize: 10 }}>ADMIN</Text> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─────── Orders ─────── */
function OrdersSection() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-orders"], queryFn: () => api<any>("/admin/orders") });

  const activate = async (id: string) => {
    await api(`/admin/orders/${id}/activate`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      {(data?.items || []).length === 0 && <Muted>Nessun ordine ancora</Muted>}
      {(data?.items || []).map((o: any) => (
        <Card key={o.id} style={{ marginBottom: spacing.md }}>
          <Text style={styles.itemTitle}>{o.user_name || o.user_phone}</Text>
          <Muted style={{ marginTop: 4 }}>
            Piano {o.plan} · €{o.amount_eur} · {o.status}
          </Muted>
          {o.status === "pending" ? (
            <GoldButton
              testID={`activate-${o.id}`}
              label="Attiva abbonamento"
              onPress={() => activate(o.id)}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 24, fontWeight: "700" },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandPrimary },
  smallChip: {
    paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  smallChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  smallChipTxt: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  smallChipTxtActive: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "700" },
  section: { color: colors.onSurface, fontSize: 18, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.md },
  statCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.lg, flexBasis: "47%", flexGrow: 1,
    borderWidth: 1, borderColor: colors.border,
  },
  statVal: { color: colors.brandPrimary, fontSize: 28, fontWeight: "800" },
  statLbl: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4 },
  chartLbl: { color: colors.muted, fontSize: 9, marginTop: 4 },
  topRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  topTitle: { color: colors.onSurface, flex: 1, marginRight: spacing.md },
  topViews: { color: colors.brandPrimary, fontWeight: "700" },
  input: {
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.onSurface,
    borderWidth: 1, borderColor: colors.border,
  },
  itemRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider,
    gap: spacing.md,
  },
  itemTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  checkbox: {
    width: 20, height: 20, borderWidth: 2, borderColor: colors.brandPrimary, borderRadius: 4,
  },
});
