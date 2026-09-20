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
import * as DocumentPicker from "expo-document-picker";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { GoldButton, Muted, Card } from "@/src/ui";

const CATEGORIES = [
  "Crescita personale", "Spirituale", "Fisica quantistica", "Meditazione",
  "Discipline orientali", "Naturopatia", "Psicologia", "Medicina Integrata",
  "Filosofia", "Nutrizione", "Somatognostica", "Video",
];

type Section = "stats" | "articles" | "media" | "youtube" | "ads" | "coupons" | "comments" | "messages" | "users" | "orders";

export default function Admin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>("stats");

  const sections: { key: Section; label: string }[] = [
    { key: "stats", label: "Statistiche" },
    { key: "articles", label: "Articoli" },
    { key: "media", label: "Video/Med." },
    { key: "youtube", label: "YouTube" },
    { key: "ads", label: "Pubblicità" },
    { key: "coupons", label: "Sconti" },
    { key: "comments", label: "Commenti" },
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
        {section === "youtube" && <YoutubeSection />}
        {section === "ads" && <AdsSection />}
        {section === "coupons" && <CouponsSection />}
        {section === "comments" && <CommentsSection />}
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

  const pickAndUpload = async () => {
    setMsg("");
    try {
      // Broad audio filter on Android so recorder files (m4a, amr, 3gp, opus) are visible.
      const pick = await DocumentPicker.getDocumentAsync({
        type: kind === "meditation"
          ? ["audio/*", "audio/mpeg", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/wav", "audio/aac", "audio/amr", "audio/3gpp", "audio/ogg", "audio/opus", "audio/flac", "application/octet-stream"]
          : "video/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (pick.canceled || !pick.assets?.[0]) return;
      const asset = pick.assets[0];
      setLoading(true);
      setMsg(`Caricamento in corso: ${asset.name || "file"}…`);
      const backend = process.env.EXPO_PUBLIC_BACKEND_URL || "";
      const form = new FormData();
      const inferredMime =
        asset.mimeType ||
        (kind === "meditation"
          ? (asset.name?.toLowerCase().endsWith(".m4a") ? "audio/mp4"
            : asset.name?.toLowerCase().endsWith(".amr") ? "audio/amr"
            : asset.name?.toLowerCase().endsWith(".3gp") || asset.name?.toLowerCase().endsWith(".3gpp") ? "audio/3gpp"
            : asset.name?.toLowerCase().endsWith(".wav") ? "audio/wav"
            : asset.name?.toLowerCase().endsWith(".ogg") ? "audio/ogg"
            : asset.name?.toLowerCase().endsWith(".opus") ? "audio/opus"
            : asset.name?.toLowerCase().endsWith(".flac") ? "audio/flac"
            : "audio/mpeg")
          : "video/mp4");
      if (Platform.OS === "web") {
        const blob = await (await fetch(asset.uri)).blob();
        form.append("file", blob, asset.name || "file");
      } else {
        form.append("file", { uri: asset.uri, name: asset.name || "file", type: inferredMime } as any);
      }
      const token =
        (await (await import("expo-secure-store")).getItemAsync("ca_token").catch(() => null)) ||
        (typeof window !== "undefined" ? window.localStorage.getItem("ca_token") : null);
      if (!token) throw new Error("Non autenticato");
      const res = await fetch(`${backend}/api/admin/upload`, {
        method: "POST",
        body: form as any,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setUrl(j.url);
      // Auto-fill title from the filename if empty (strip extension).
      if (!title && asset.name) {
        const nice = asset.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
        if (nice) setTitle(nice.charAt(0).toUpperCase() + nice.slice(1));
      }
      const sizeKB = Math.round(j.size / 1024);
      const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
      setMsg(`✅ File caricato: ${asset.name} (${sizeStr}). Ora compila i campi e tocca "Pubblica".`);
    } catch (e: any) {
      setMsg(`Errore upload: ${e.message}`);
    } finally {
      setLoading(false);
    }
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
        <TextInput testID="media-url" value={url} onChangeText={setUrl} placeholder="URL YouTube / mp3 / mp4 — oppure carica un file qui sotto ↓" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: spacing.md }]} autoCapitalize="none" />
        <GoldButton
          testID="upload-file"
          label={kind === "meditation" ? "🎙️  Carica registrazione dal telefono" : "📹  Carica video dal telefono"}
          onPress={pickAndUpload}
          style={{ marginTop: spacing.md }}
          loading={loading}
        />
        {kind === "meditation" ? (
          <Muted style={{ marginTop: spacing.sm, fontSize: 12 }}>
            Supporta MP3, M4A, WAV, AMR, 3GP, OGG, OPUS, FLAC. Anche le registrazioni fatte con il registratore del telefono (max 300 MB).
          </Muted>
        ) : null}
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

/* ─────── YouTube import ─────── */
function YoutubeSection() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [url, setUrl] = useState("https://www.youtube.com/@SUMMAAUREA");
  const [cat, setCat] = useState("Video");
  const [premium, setPremium] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true); setMsg("");
    try {
      if (!url) throw new Error("Inserisci URL canale");
      const r = await api<any>("/admin/media/import-youtube", {
        method: "POST",
        body: JSON.stringify({ channel_url: url, category: cat, is_premium: premium }),
      });
      setMsg(`Importati ${r.imported} video (saltati ${r.skipped} già presenti su ${r.total} disponibili).`);
      qc.invalidateQueries({ queryKey: ["admin-media"] });
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Card>
        <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>Importa video da canale YouTube</Text>
        <Muted style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
          Inserisci l'URL di un canale YouTube (es. https://youtube.com/@SUMMAAUREA). Vengono importati gli ultimi 15 video del feed.
        </Muted>
        <TextInput
          testID="yt-url"
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.youtube.com/@..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.md }}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[styles.smallChip, cat === c && styles.smallChipActive]}>
              <Text style={cat === c ? styles.smallChipTxtActive : styles.smallChipTxt}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={() => setPremium(!premium)} style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={[styles.checkbox, premium && { backgroundColor: colors.brandPrimary }]} />
          <Text style={{ color: colors.onSurface }}>Contenuti Premium</Text>
        </Pressable>
        {msg ? <Text style={{ color: colors.brandPrimary, marginTop: spacing.sm }}>{msg}</Text> : null}
        <GoldButton testID="yt-import" label="Importa video del canale" onPress={run} loading={loading} style={{ marginTop: spacing.md }} />
      </Card>
    </ScrollView>
  );
}

/* ─────── Ads ─────── */
function AdsSection() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-ads"], queryFn: () => api<any>("/admin/ads") });
  const [image, setImage] = useState("");
  const [click, setClick] = useState("");
  const [caption, setCaption] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true); setMsg("");
    try {
      if (!image) throw new Error("URL immagine richiesto");
      await api("/admin/ads", {
        method: "POST",
        body: JSON.stringify({ image_url: image, click_url: click || null, caption, is_active: true }),
      });
      setImage(""); setClick(""); setCaption("");
      qc.invalidateQueries({ queryKey: ["admin-ads"] });
      setMsg("Pubblicità creata");
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    await api(`/admin/ads/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["admin-ads"] });
  };
  const toggle = async (id: string) => {
    await api(`/admin/ads/${id}/toggle`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["admin-ads"] });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Card>
        <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>Nuova pubblicità</Text>
        <Muted style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
          Un banner viene mostrato agli utenti per 5 secondi ogni 10 minuti di uso dell'app.
        </Muted>
        <TextInput testID="ad-image" value={image} onChangeText={setImage} placeholder="URL immagine (https://...)" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
        <TextInput testID="ad-caption" value={caption} onChangeText={setCaption} placeholder="Titolo/didascalia (facoltativo)" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: spacing.md }]} />
        <TextInput testID="ad-click" value={click} onChangeText={setClick} placeholder="URL al click (facoltativo)" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: spacing.md }]} autoCapitalize="none" />
        {msg ? <Text style={{ color: colors.brandPrimary, marginTop: spacing.sm }}>{msg}</Text> : null}
        <GoldButton testID="save-ad" label="Salva pubblicità" onPress={create} loading={loading} style={{ marginTop: spacing.md }} />
      </Card>

      <Text style={styles.section}>Pubblicità caricate</Text>
      {(data?.items || []).length === 0 && <Muted>Nessuna pubblicità</Muted>}
      {(data?.items || []).map((a: any) => (
        <View key={a.id} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle} numberOfLines={1}>{a.caption || a.image_url}</Text>
            <Muted style={{ fontSize: 11 }}>
              {a.is_active ? "Attiva" : "Disattiva"}{a.click_url ? ` · ${a.click_url}` : ""}
            </Muted>
          </View>
          <Pressable onPress={() => toggle(a.id)}>
            <Text style={{ color: colors.brandPrimary, fontWeight: "700", marginRight: spacing.md }}>
              {a.is_active ? "Pausa" : "Attiva"}
            </Text>
          </Pressable>
          <Pressable onPress={() => remove(a.id)}>
            <Text style={{ color: colors.error, fontWeight: "700" }}>Elimina</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─────── Coupons ─────── */
function CouponsSection() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-coupons"], queryFn: () => api<any>("/admin/coupons") });
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("20");
  const [maxUses, setMaxUses] = useState("100");
  const [expires, setExpires] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true); setMsg("");
    try {
      if (!code) throw new Error("Codice richiesto");
      await api("/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: code.toUpperCase(),
          percent_off: parseInt(percent) || 10,
          max_uses: parseInt(maxUses) || 100,
          expires_at: expires || null,
        }),
      });
      setCode(""); setPercent("20"); setMaxUses("100"); setExpires("");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setMsg("Codice creato");
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  };

  const remove = async (c: string) => {
    await api(`/admin/coupons/${c}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Card>
        <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>Nuovo codice sconto</Text>
        <Muted style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
          Gli utenti applicheranno il codice al checkout dell'abbonamento.
        </Muted>
        <TextInput testID="coupon-code" value={code} onChangeText={setCode} placeholder="LANCIO2026" placeholderTextColor={colors.muted} autoCapitalize="characters" style={styles.input} />
        <TextInput testID="coupon-percent" value={percent} onChangeText={setPercent} placeholder="% di sconto (1-100)" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, { marginTop: spacing.md }]} />
        <TextInput testID="coupon-max" value={maxUses} onChangeText={setMaxUses} placeholder="Numero massimo di usi" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, { marginTop: spacing.md }]} />
        <TextInput value={expires} onChangeText={setExpires} placeholder="Scadenza YYYY-MM-DD (facoltativo)" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.input, { marginTop: spacing.md }]} />
        {msg ? <Text style={{ color: colors.brandPrimary, marginTop: spacing.sm }}>{msg}</Text> : null}
        <GoldButton testID="save-coupon" label="Crea codice" onPress={create} loading={loading} style={{ marginTop: spacing.md }} />
      </Card>

      <Text style={styles.section}>Codici attivi</Text>
      {(data?.items || []).length === 0 && <Muted>Nessun codice sconto</Muted>}
      {(data?.items || []).map((c: any) => (
        <View key={c.code} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{c.code} · -{c.percent_off}%</Text>
            <Muted style={{ fontSize: 11 }}>
              Usato {c.used_count}/{c.max_uses}{c.expires_at ? ` · scade ${c.expires_at}` : ""}
            </Muted>
          </View>
          <Pressable onPress={() => remove(c.code)}>
            <Text style={{ color: colors.error, fontWeight: "700" }}>Elimina</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─────── Comments moderation ─────── */
function CommentsSection() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-comments"], queryFn: () => api<any>("/admin/comments") });

  const remove = async (id: string) => {
    await api(`/admin/comments/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["admin-comments"] });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>Moderazione commenti</Text>
      <Muted style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
        Elimina commenti offensivi o fuori tema.
      </Muted>
      {(data?.items || []).length === 0 && <Muted>Nessun commento ancora</Muted>}
      {(data?.items || []).map((c: any) => (
        <Card key={c.id} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.brandPrimary, fontSize: 13, fontWeight: "700" }}>{c.user_name}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{new Date(c.created_at).toLocaleDateString("it-IT")}</Text>
          </View>
          <Text style={{ color: colors.onSurfaceSecondary, marginTop: spacing.sm, fontSize: 14, lineHeight: 20 }}>{c.body}</Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: spacing.sm, fontStyle: "italic" }}>
            su {c.content_type === "article" ? "articolo" : "media"}: {c.content_title}
          </Text>
          <Pressable
            testID={`del-comment-${c.id}`}
            onPress={() => remove(c.id)}
            style={{ marginTop: spacing.md, alignSelf: "flex-start" }}
          >
            <Text style={{ color: colors.error, fontWeight: "700" }}>Elimina commento</Text>
          </Pressable>
        </Card>
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
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: () => api<any>("/admin/users") });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const items: any[] = data?.items || [];
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const deletableItems = items.filter((u) => !u.is_admin);
  const allDeletableSelected = deletableItems.length > 0 && deletableItems.every((u) => selected[u.id]);

  const toggle = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };
  const toggleAll = () => {
    if (allDeletableSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      deletableItems.forEach((u) => (next[u.id] = true));
      setSelected(next);
    }
  };

  const confirmAndDelete = (msg: string, doIt: () => Promise<void>) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && !window.confirm(msg)) return;
      doIt();
    } else {
      import("react-native").then(({ Alert }) => {
        Alert.alert("Conferma", msg, [
          { text: "Annulla", style: "cancel" },
          { text: "Elimina", style: "destructive", onPress: doIt },
        ]);
      });
    }
  };

  const deleteOne = (u: any) => {
    confirmAndDelete(
      `Eliminare l'utente ${u.name || u.phone}?\nVerranno cancellati anche i suoi commenti, preferiti e ordini.`,
      async () => {
        setBusy(true);
        try {
          await api(`/admin/users/${u.id}`, { method: "DELETE" });
          qc.invalidateQueries({ queryKey: ["admin-users"] });
          qc.invalidateQueries({ queryKey: ["stats-summary"] });
        } finally { setBusy(false); }
      },
    );
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    confirmAndDelete(
      `Eliminare ${selectedIds.length} utenti selezionati?\nOperazione non reversibile.`,
      async () => {
        setBusy(true);
        try {
          await api(`/admin/users/bulk-delete`, {
            method: "POST",
            body: JSON.stringify({ ids: selectedIds }),
          });
          setSelected({});
          qc.invalidateQueries({ queryKey: ["admin-users"] });
          qc.invalidateQueries({ queryKey: ["stats-summary"] });
        } finally { setBusy(false); }
      },
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
        <Pressable testID="toggle-all-users" onPress={toggleAll} style={styles.selAllBtn}>
          <Text style={styles.selAllTxt}>
            {allDeletableSelected ? "☑︎  Deseleziona tutti" : "☐  Seleziona tutti"}
          </Text>
        </Pressable>
        {selectedIds.length > 0 ? (
          <Pressable testID="delete-selected-users" onPress={deleteSelected} style={styles.dangerBtn} disabled={busy}>
            <Text style={styles.dangerTxt}>{busy ? "…" : `Elimina (${selectedIds.length})`}</Text>
          </Pressable>
        ) : null}
      </View>

      {items.map((u: any) => {
        const isChecked = !!selected[u.id];
        return (
          <View key={u.id} style={styles.userRow}>
            <Pressable
              testID={`sel-user-${u.id}`}
              onPress={() => !u.is_admin && toggle(u.id)}
              disabled={u.is_admin}
              style={styles.checkbox}
            >
              <Text style={{ fontSize: 16, color: u.is_admin ? colors.muted : (isChecked ? colors.brandPrimary : colors.onSurfaceTertiary) }}>
                {u.is_admin ? "🔒" : (isChecked ? "☑︎" : "☐")}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{u.name || "—"}</Text>
              <Muted style={{ fontSize: 12 }}>{u.phone}</Muted>
            </View>
            <View style={{ alignItems: "flex-end", marginRight: spacing.sm }}>
              <Text style={{ color: u.subscription?.status === "premium" ? colors.brandPrimary : colors.muted, fontSize: 12, fontWeight: "700" }}>
                {u.subscription?.status === "premium" ? "PREMIUM" : "GRATUITO"}
              </Text>
              {u.is_admin ? <Text style={{ color: colors.success, fontSize: 10 }}>ADMIN</Text> : null}
            </View>
            {!u.is_admin ? (
              <Pressable testID={`del-user-${u.id}`} onPress={() => deleteOne(u)} style={styles.iconBtn} disabled={busy}>
                <Text style={{ color: colors.error, fontSize: 18 }}>🗑</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
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
    width: 32, height: 32, alignItems: "center", justifyContent: "center",
  },
  userRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36, height: 36, alignItems: "center", justifyContent: "center",
    borderRadius: radius.md,
  },
  selAllBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  selAllTxt: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  dangerBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: 10,
    borderRadius: radius.pill, backgroundColor: colors.error,
  },
  dangerTxt: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
