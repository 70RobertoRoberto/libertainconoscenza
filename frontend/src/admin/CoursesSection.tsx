import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  Switch,
  Platform,
  Alert,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { colors, spacing, radius } from "@/src/theme";
import { api, adminUpload } from "@/src/api";
import { RichEditor, RichViewer } from "@/src/RichEditor";

/**
 * Cross-platform alert. On web, RN Alert.alert is silent → use window.alert.
 */
function toast(title: string, message?: string) {
  const text = message ? `${title}\n\n${message}` : title;
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(text);
    return;
  }
  Alert.alert(title, message);
}

function confirmDelete(title: string, message: string, onYes: () => void) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: "Annulla", style: "cancel" },
    { text: "Elimina", style: "destructive", onPress: onYes },
  ]);
}

/**
 * Admin "Corsi" section.
 *
 * Sub-tabs (per DOCUMENTO TECNICO §5.1):
 *   • Crea Corso
 *   • Corsi Presenti (bozze) — is_active=false
 *   • Corsi Attivi (fruibili) — is_active=true
 *
 * Argomenti and Quiz editors are opened from the course detail modal.
 */
type SubTab = "create" | "drafts" | "active";

type Area = { id: string; name: string; slug: string; order: number };
type Course = {
  id: string;
  title: string;
  cover_url: string;
  description_html: string;
  kind: "base" | "premium";
  price: number;
  area_id: string | null;
  area_name?: string | null;
  is_active: boolean;
  promo: { active: boolean; price_promo?: number | null; ends_at?: string | null; duration_days?: number | null };
  topic_count: number;
  has_quiz: boolean;
};
type Topic = {
  id: string;
  title: string;
  kind: string;
  content_html: string;
  order: number;
};
type Quiz = {
  id?: string;
  questions: { id: string; text: string; answers: { text: string; is_correct: boolean }[]; explanation: string }[];
  pass_threshold: number;
  max_attempts: number;
} | null;

const TOPIC_KINDS: { key: string; label: string; hint: string }[] = [
  { key: "presentazione", label: "Presentazione", hint: "Pagina di presentazione del corso" },
  { key: "apertura", label: "Apertura", hint: "\"La scena che conosci\"" },
  { key: "modulo", label: "Modulo", hint: "Modulo di contenuto" },
  { key: "laboratorio", label: "Laboratorio pratico", hint: "Attività pratica" },
  { key: "sintesi", label: "Sintesi finale", hint: "Riepilogo" },
  { key: "ponte", label: "Ponte", hint: "Articolo + percorso esterno (meditazione facoltativa)" },
  { key: "bibliografia", label: "Bibliografia", hint: "Riferimenti" },
];

export function CoursesSection() {
  const [tab, setTab] = useState<SubTab>("create");
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs */}
      <View style={s.subtabs}>
        {[
          { key: "create", label: "Crea Corso" },
          { key: "drafts", label: "Presenti (bozze)" },
          { key: "active", label: "Attivi (fruibili)" },
        ].map((t) => (
          <Pressable
            key={t.key}
            testID={`ctab-${t.key}`}
            onPress={() => setTab(t.key as SubTab)}
            style={[s.subtab, tab === t.key && s.subtabActive]}
          >
            <Text style={[s.subtabTxt, tab === t.key && s.subtabTxtActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {tab === "create" && <CreateCourseForm onCreated={(id) => { setOpenCourseId(id); setTab("drafts"); }} />}
        {tab === "drafts" && <CourseList active={false} onOpen={setOpenCourseId} />}
        {tab === "active" && <CourseList active={true} onOpen={setOpenCourseId} />}
      </ScrollView>

      {openCourseId ? (
        <CourseEditorModal courseId={openCourseId} onClose={() => setOpenCourseId(null)} />
      ) : null}
    </View>
  );
}

/* ─────────── Create form ─────────── */
function CreateCourseForm({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [descHtml, setDescHtml] = useState("");
  const [descEditor, setDescEditor] = useState(false);
  const [kind, setKind] = useState<"base" | "premium">("base");
  const [price, setPrice] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areaModal, setAreaModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: areasData } = useQuery({
    queryKey: ["c-areas"],
    queryFn: () => api<{ items: Area[] }>("/admin/course-areas"),
  });
  const areas = areasData?.items || [];

  const pickCover = async () => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { toast("Permesso negato"); return; }
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    setUploading(true);
    try {
      // Size check only on native — on web, blob:// URIs don't play well with getInfoAsync.
      if (Platform.OS !== "web") {
        try {
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (info.exists && (info.size || 0) > 8 * 1024 * 1024) {
            toast("Immagine troppo grande", "Massimo 8 MB.");
            return;
          }
        } catch { /* ignore size probe failures */ }
      }
      const up = await adminUpload(
        asset.uri,
        asset.mimeType || "image/jpeg",
        asset.fileName || "cover.jpg",
      );
      setCoverUrl(up.url);
    } catch (e: any) {
      toast("Errore upload", String(e?.message || e));
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!title.trim()) return toast("Titolo obbligatorio");
    if (!coverUrl) return toast("Copertina obbligatoria");
    if (kind === "premium" && (!price || Number(price) <= 0)) return toast("Prezzo obbligatorio per corsi Premium");
    setSaving(true);
    try {
      const res = await api<Course>("/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          cover_url: coverUrl,
          description_html: descHtml,
          kind,
          price: kind === "premium" ? Number(price) : 0,
          area_id: areaId,
          is_active: false,
        }),
      });
      qc.invalidateQueries({ queryKey: ["c-list"] });
      setTitle(""); setCoverUrl(""); setDescHtml(""); setPrice(""); setAreaId(null); setKind("base");
      toast("Corso creato", "Ora puoi aggiungere argomenti e quiz.");
      onCreated(res.id);
    } catch (e: any) {
      toast("Errore", e?.message || "Impossibile creare");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Text style={s.h1}>Nuovo Corso</Text>

      <Text style={s.label}>Titolo *</Text>
      <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Titolo del corso" placeholderTextColor={colors.muted} />

      <Text style={s.label}>Immagine di copertina *</Text>
      {coverUrl ? (
        <View style={{ marginBottom: spacing.md }}>
          <Image source={{ uri: coverUrl }} style={s.cover} />
          <View style={s.coverBadge}>
            <Text style={s.coverBadgeTxt}>✓ Immagine caricata</Text>
          </View>
          <Pressable onPress={() => setCoverUrl("")} style={s.coverRemove}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>×</Text>
          </Pressable>
          <Pressable onPress={pickCover} style={s.coverReplace} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.brandPrimary} />
            ) : (
              <Text style={s.uploadTxt}>Sostituisci copertina</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={pickCover} style={s.upload} disabled={uploading}>
          {uploading ? (
            <View style={{ alignItems: "center" }}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={[s.uploadTxt, { marginTop: 6 }]}>Caricamento in corso…</Text>
            </View>
          ) : (
            <Text style={s.uploadTxt}>📷  Scegli copertina</Text>
          )}
        </Pressable>
      )}

      <Text style={s.label}>Descrizione (max 3.000 parole; preview 250 parole)</Text>
      <Pressable onPress={() => setDescEditor(true)} style={s.editorLauncher}>
        <Text style={{ color: descHtml ? colors.onSurface : colors.muted, fontSize: 14 }}>
          {descHtml ? "✎  Modifica descrizione (WYSIWYG)" : "✎  Apri editor…"}
        </Text>
      </Pressable>
      {descHtml ? (
        <View style={s.previewBox}>
          <Text style={s.previewLabel}>Anteprima:</Text>
          <View style={{ height: 140 }}>
            <RichViewer html={descHtml} />
          </View>
        </View>
      ) : null}
      <RichEditor
        visible={descEditor}
        initialHtml={descHtml}
        onSave={(h) => { setDescHtml(h); setDescEditor(false); }}
        onClose={() => setDescEditor(false)}
        title="Descrizione corso"
      />

      <Text style={s.label}>Tipo *</Text>
      <View style={s.rowRadio}>
        {(["base", "premium"] as const).map((k) => (
          <Pressable key={k} onPress={() => setKind(k)} style={[s.radio, kind === k && s.radioActive]}>
            <Text style={[s.radioTxt, kind === k && s.radioTxtActive]}>
              {k === "premium" ? "👑 Premium" : "Base"}
            </Text>
          </Pressable>
        ))}
      </View>

      {kind === "premium" ? (
        <>
          <Text style={s.label}>Costo (€) — una tantum *</Text>
          <TextInput
            style={s.input}
            value={price}
            onChangeText={(t) => setPrice(t.replace(",", ".").replace(/[^0-9.]/g, ""))}
            placeholder="es. 29"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
          />
        </>
      ) : (
        <View style={s.freeBox}>
          <Text style={s.freeTitle}>💚  Corso Base — GRATUITO</Text>
          <Text style={s.freeBody}>
            Incluso nell&apos;abbonamento annuale. Questo testo verrà mostrato automaticamente
            agli utenti al posto del prezzo.
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }}>
        <Text style={s.label}>Area tematica (opzionale)</Text>
        <Pressable onPress={() => setAreaModal(true)}>
          <Text style={{ color: colors.brandPrimary, fontSize: 13 }}>Gestisci aree</Text>
        </Pressable>
      </View>
      <View style={s.chipRow}>
        <Pressable onPress={() => setAreaId(null)} style={[s.aChip, !areaId && s.aChipActive]}>
          <Text style={[s.aChipTxt, !areaId && s.aChipTxtActive]}>Nessuna</Text>
        </Pressable>
        {areas.map((a) => (
          <Pressable key={a.id} onPress={() => setAreaId(a.id)} style={[s.aChip, areaId === a.id && s.aChipActive]}>
            <Text style={[s.aChipTxt, areaId === a.id && s.aChipTxtActive]}>{a.name}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={save} style={s.primaryBtn} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Salva corso (bozza)</Text>}
      </Pressable>

      {areaModal ? <AreasModal onClose={() => setAreaModal(false)} /> : null}
    </>
  );
}

/* ─────────── Course list (drafts / active) ─────────── */
function CourseList({ active, onOpen }: { active: boolean; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["c-list", active ? "active" : "draft"],
    queryFn: () => api<{ items: Course[] }>(`/admin/courses?status=${active ? "active" : "draft"}`),
    refetchOnMount: "always",
  });
  const items = data?.items || [];

  const toggle = async (c: Course) => {
    try {
      await api(`/admin/courses/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      qc.invalidateQueries({ queryKey: ["c-list"] });
    } catch (e: any) { toast("Errore", e?.message || "-"); }
  };

  const del = async (c: Course) => {
    confirmDelete("Eliminare?", `"${c.title}" verrà eliminato.`, async () => {
      try {
        await api(`/admin/courses/${c.id}`, { method: "DELETE" });
        qc.invalidateQueries({ queryKey: ["c-list"] });
      } catch (e: any) { toast("Errore", e?.message || "-"); }
    });
  };

  if (isLoading) return <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 20 }} />;
  if (items.length === 0) return <Text style={s.empty}>Nessun corso {active ? "attivo" : "in bozza"}.</Text>;
  return (
    <>
      {items.map((c) => (
        <View key={c.id} style={s.card}>
          {c.cover_url ? <Image source={{ uri: c.cover_url }} style={s.cardCover} /> : null}
          <View style={{ flex: 1, padding: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {c.kind === "premium" ? <Text style={{ fontSize: 14 }}>👑</Text> : null}
              <Text style={s.cardTitle} numberOfLines={2}>{c.title}</Text>
            </View>
            <Text style={s.cardMeta}>
              {c.kind === "premium" ? `Premium · ${c.price.toFixed(2)} €` : "Base · Gratuito (incluso nell'abbonamento)"}
              {c.area_name ? ` · ${c.area_name}` : ""}
              {` · ${c.topic_count} argomenti`}
              {c.has_quiz ? " · Quiz" : ""}
            </Text>
            <View style={s.cardActions}>
              <Pressable onPress={() => onOpen(c.id)} style={s.actionBtn}>
                <Text style={s.actionTxt}>Modifica</Text>
              </Pressable>
              <Pressable onPress={() => toggle(c)} style={[s.actionBtn, s.actionBtnAlt]}>
                <Text style={s.actionTxt}>{c.is_active ? "Disattiva" : "Attiva"}</Text>
              </Pressable>
              <Pressable onPress={() => del(c)} style={[s.actionBtn, s.actionBtnDanger]}>
                <Text style={[s.actionTxt, { color: colors.danger || "#c33" }]}>Elimina</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

/* ─────────── Areas CRUD modal ─────────── */
function AreasModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["c-areas"], queryFn: () => api<{ items: Area[] }>("/admin/course-areas") });
  const [newName, setNewName] = useState("");
  const items = data?.items || [];

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await api("/admin/course-areas", { method: "POST", body: JSON.stringify({ name: newName.trim(), order: 0 }) });
      setNewName(""); qc.invalidateQueries({ queryKey: ["c-areas"] });
    } catch (e: any) { toast("Errore", e?.message || "-"); }
  };
  const del = async (id: string) => {
    try { await api(`/admin/course-areas/${id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["c-areas"] }); }
    catch (e: any) { toast("Errore", e?.message || "-"); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.modalCard}>
          <Text style={s.h1}>Aree tematiche</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: spacing.md }}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={newName} onChangeText={setNewName} placeholder="Nuova area" placeholderTextColor={colors.muted} />
            <Pressable onPress={add} style={s.primaryBtnSm}><Text style={s.primaryTxt}>+</Text></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 300 }}>
            {items.map((a) => (
              <View key={a.id} style={s.areaRow}>
                <Text style={{ flex: 1, color: colors.onSurface }}>{a.name}</Text>
                <Pressable onPress={() => del(a.id)}><Text style={{ color: colors.danger || "#c33" }}>Elimina</Text></Pressable>
              </View>
            ))}
            {items.length === 0 ? <Text style={s.empty}>Nessuna area ancora.</Text> : null}
          </ScrollView>
          <Pressable onPress={onClose} style={[s.primaryBtn, { marginTop: spacing.md }]}>
            <Text style={s.primaryTxt}>Chiudi</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ─────────── Course editor: topics + quiz + settings ─────────── */
function CourseEditorModal({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: course, refetch } = useQuery({
    queryKey: ["c-detail", courseId],
    queryFn: () => api<Course>(`/admin/courses/${courseId}`),
  });
  const { data: topicsData, refetch: refetchTopics } = useQuery({
    queryKey: ["c-topics", courseId],
    queryFn: () => api<{ items: Topic[] }>(`/admin/courses/${courseId}/topics`),
  });
  const { data: quizData, refetch: refetchQuiz } = useQuery({
    queryKey: ["c-quiz", courseId],
    queryFn: () => api<{ quiz: Quiz }>(`/admin/courses/${courseId}/quiz`),
  });
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!course) return null;
  const topics = topicsData?.items || [];
  const quiz = quizData?.quiz || null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["c-list"] });
    refetch(); refetchTopics(); refetchQuiz();
  };

  const toggleActive = async () => {
    await api(`/admin/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !course.is_active }),
    });
    invalidate();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={s.editorHeader}>
          <Pressable onPress={onClose} hitSlop={10}><Text style={s.headerBtn}>Chiudi</Text></Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>{course.title}</Text>
          <Pressable onPress={toggleActive}>
            <Text style={[s.headerBtn, { color: course.is_active ? "#c33" : colors.brandPrimary, fontWeight: "800" }]}>
              {course.is_active ? "Disattiva" : "Attiva"}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
          {course.cover_url ? <Image source={{ uri: course.cover_url }} style={s.cardCover} /> : null}

          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: spacing.md }}>
            {course.kind === "premium" ? <Text style={{ fontSize: 16 }}>👑</Text> : null}
            <Text style={s.h1}>{course.title}</Text>
          </View>
          <Text style={s.cardMeta}>
            {course.kind === "premium" ? `Premium · ${course.price.toFixed(2)} €` : "Base · Gratuito (incluso nell'abbonamento)"}
            {course.area_name ? ` · ${course.area_name}` : ""}
            {course.is_active ? " · Attivo" : " · Bozza"}
          </Text>

          <Pressable onPress={() => setSettingsOpen(true)} style={[s.primaryBtnSm2, { marginTop: spacing.md, alignSelf: "flex-start" }]}>
            <Text style={s.primaryTxt}>⚙  Impostazioni corso (titolo · copertina · descrizione · prezzo)</Text>
          </Pressable>

          {course.description_html ? (
            <View style={[s.previewBox, { marginTop: spacing.md }]}>
              <Text style={s.previewLabel}>Descrizione:</Text>
              <View style={{ height: 180 }}>
                <RichViewer html={course.description_html} />
              </View>
            </View>
          ) : (
            <Text style={[s.empty, { textAlign: "left", padding: 8 }]}>
              Nessuna descrizione. Aprila da &quot;Impostazioni corso&quot;.
            </Text>
          )}

          {/* Topics */}
          <View style={s.section}>
            <Text style={s.h2}>Argomenti ({topics.length})</Text>
            <Pressable onPress={() => setNewTopicOpen(true)} style={s.primaryBtnSm2}>
              <Text style={s.primaryTxt}>+ Inserisci Argomento</Text>
            </Pressable>
          </View>
          {topics.map((t, idx) => (
            <Pressable key={t.id} onPress={() => setEditingTopic(t)} style={s.topicRow}>
              <View style={s.topicNum}><Text style={s.topicNumTxt}>{idx + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.topicTitle} numberOfLines={2}>{t.title}</Text>
                <Text style={s.topicKind}>{TOPIC_KINDS.find((k) => k.key === t.kind)?.label || t.kind}</Text>
              </View>
              <Text style={{ color: colors.muted }}>›</Text>
            </Pressable>
          ))}
          {topics.length === 0 ? <Text style={s.empty}>Nessun argomento ancora. Suggerimento: inizia da &quot;Presentazione&quot;.</Text> : null}

          {/* Quiz */}
          <View style={s.section}>
            <Text style={s.h2}>Quiz {quiz ? `(${quiz.questions.length} domande)` : "(non impostato)"}</Text>
            <Pressable onPress={() => setQuizOpen(true)} style={s.primaryBtnSm2}>
              <Text style={s.primaryTxt}>{quiz ? "Modifica Quiz" : "+ Inserisci Quiz"}</Text>
            </Pressable>
          </View>

          {/* Promo */}
          {course.kind === "premium" ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={s.h2}>Promozione</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
                {course.promo.active ? `Attiva — €${course.promo.price_promo?.toFixed(2)} fino al ${course.promo.ends_at?.slice(0, 10)}` : "Non attiva"}
              </Text>
              <Pressable onPress={() => setPromoOpen(true)} style={s.primaryBtnSm2}>
                <Text style={s.primaryTxt}>{course.promo.active ? "Modifica promo" : "+ Attiva promo"}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        {newTopicOpen ? (
          <TopicEditor
            courseId={courseId}
            topic={null}
            onClose={() => setNewTopicOpen(false)}
            onSaved={() => { setNewTopicOpen(false); invalidate(); }}
          />
        ) : null}
        {editingTopic ? (
          <TopicEditor
            courseId={courseId}
            topic={editingTopic}
            onClose={() => setEditingTopic(null)}
            onSaved={() => { setEditingTopic(null); invalidate(); }}
          />
        ) : null}
        {quizOpen ? (
          <QuizEditor
            courseId={courseId}
            quiz={quiz}
            onClose={() => setQuizOpen(false)}
            onSaved={() => { setQuizOpen(false); invalidate(); }}
          />
        ) : null}
        {promoOpen ? (
          <PromoEditor
            course={course}
            onClose={() => setPromoOpen(false)}
            onSaved={() => { setPromoOpen(false); invalidate(); }}
          />
        ) : null}
        {settingsOpen ? (
          <CourseSettingsEditor
            course={course}
            onClose={() => setSettingsOpen(false)}
            onSaved={() => { setSettingsOpen(false); invalidate(); }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

/* ─────────── Course settings editor (title/cover/description/kind/price/area) ─────────── */
function CourseSettingsEditor({
  course, onClose, onSaved,
}: { course: Course; onClose: () => void; onSaved: () => void }) {
  const { data: areasData } = useQuery({
    queryKey: ["c-areas"],
    queryFn: () => api<{ items: Area[] }>("/admin/course-areas"),
  });
  const areas = areasData?.items || [];

  const [title, setTitle] = useState(course.title);
  const [coverUrl, setCoverUrl] = useState(course.cover_url);
  const [descHtml, setDescHtml] = useState(course.description_html);
  const [descEditor, setDescEditor] = useState(false);
  const [kind, setKind] = useState<"base" | "premium">(course.kind);
  const [price, setPrice] = useState(course.price ? String(course.price) : "");
  const [areaId, setAreaId] = useState<string | null>(course.area_id ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickCover = async () => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { toast("Permesso negato"); return; }
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    setUploading(true);
    try {
      if (Platform.OS !== "web") {
        try {
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (info.exists && (info.size || 0) > 8 * 1024 * 1024) {
            toast("Immagine troppo grande", "Massimo 8 MB.");
            return;
          }
        } catch { /* skip */ }
      }
      const up = await adminUpload(
        asset.uri,
        asset.mimeType || "image/jpeg",
        asset.fileName || "cover.jpg",
      );
      setCoverUrl(up.url);
    } catch (e: any) {
      toast("Errore upload", String(e?.message || e));
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!title.trim()) return toast("Titolo obbligatorio");
    if (!coverUrl) return toast("Copertina obbligatoria");
    if (kind === "premium" && (!price || Number(price) <= 0)) return toast("Prezzo obbligatorio per corsi Premium");
    setSaving(true);
    try {
      await api(`/admin/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          cover_url: coverUrl,
          description_html: descHtml,
          kind,
          price: kind === "premium" ? Number(price) : 0,
          area_id: areaId,
        }),
      });
      onSaved();
    } catch (e: any) {
      toast("Errore", e?.message || "-");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={s.editorHeader}>
          <Pressable onPress={onClose}><Text style={s.headerBtn}>Annulla</Text></Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>Impostazioni corso</Text>
          <Pressable onPress={save} disabled={saving}>
            <Text style={[s.headerBtn, { fontWeight: "800" }]}>{saving ? "…" : "Salva"}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
          <Text style={s.label}>Titolo *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholderTextColor={colors.muted} />

          <Text style={s.label}>Immagine di copertina *</Text>
          {coverUrl ? (
            <View style={{ marginBottom: spacing.md }}>
              <Image source={{ uri: coverUrl }} style={s.cover} />
              <View style={s.coverBadge}>
                <Text style={s.coverBadgeTxt}>✓ Immagine attuale</Text>
              </View>
              <Pressable onPress={pickCover} style={s.coverReplace} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color={colors.brandPrimary} />
                ) : (
                  <Text style={s.uploadTxt}>Sostituisci copertina</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={pickCover} style={s.upload} disabled={uploading}>
              {uploading ? (
                <View style={{ alignItems: "center" }}>
                  <ActivityIndicator color={colors.brandPrimary} />
                  <Text style={[s.uploadTxt, { marginTop: 6 }]}>Caricamento in corso…</Text>
                </View>
              ) : (
                <Text style={s.uploadTxt}>📷  Scegli copertina</Text>
              )}
            </Pressable>
          )}

          <Text style={s.label}>Descrizione (WYSIWYG)</Text>
          <Pressable onPress={() => setDescEditor(true)} style={s.editorLauncher}>
            <Text style={{ color: descHtml ? colors.onSurface : colors.muted, fontSize: 14 }}>
              {descHtml ? "✎  Modifica descrizione" : "✎  Apri editor…"}
            </Text>
          </Pressable>
          {descHtml ? (
            <View style={s.previewBox}>
              <Text style={s.previewLabel}>Anteprima:</Text>
              <View style={{ height: 160 }}>
                <RichViewer html={descHtml} />
              </View>
            </View>
          ) : null}
          <RichEditor
            visible={descEditor}
            initialHtml={descHtml}
            onSave={(h) => { setDescHtml(h); setDescEditor(false); }}
            onClose={() => setDescEditor(false)}
            title="Descrizione corso"
          />

          <Text style={s.label}>Tipo *</Text>
          <View style={s.rowRadio}>
            {(["base", "premium"] as const).map((k) => (
              <Pressable key={k} onPress={() => setKind(k)} style={[s.radio, kind === k && s.radioActive]}>
                <Text style={[s.radioTxt, kind === k && s.radioTxtActive]}>
                  {k === "premium" ? "👑 Premium" : "Base"}
                </Text>
              </Pressable>
            ))}
          </View>

          {kind === "premium" ? (
            <>
              <Text style={s.label}>Costo (€) — una tantum *</Text>
              <TextInput
                style={s.input}
                value={price}
                onChangeText={(t) => setPrice(t.replace(",", ".").replace(/[^0-9.]/g, ""))}
                placeholder="es. 29"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </>
          ) : (
            <View style={s.freeBox}>
              <Text style={s.freeTitle}>💚  Corso Base — GRATUITO</Text>
              <Text style={s.freeBody}>
                Incluso nell&apos;abbonamento annuale. Questo testo verrà mostrato automaticamente
                agli utenti al posto del prezzo.
              </Text>
            </View>
          )}

          <Text style={s.label}>Area tematica (opzionale)</Text>
          <View style={s.chipRow}>
            <Pressable onPress={() => setAreaId(null)} style={[s.aChip, !areaId && s.aChipActive]}>
              <Text style={[s.aChipTxt, !areaId && s.aChipTxtActive]}>Nessuna</Text>
            </Pressable>
            {areas.map((a) => (
              <Pressable key={a.id} onPress={() => setAreaId(a.id)} style={[s.aChip, areaId === a.id && s.aChipActive]}>
                <Text style={[s.aChipTxt, areaId === a.id && s.aChipTxtActive]}>{a.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─────────── Topic editor ─────────── */
function TopicEditor({
  courseId, topic, onClose, onSaved,
}: { courseId: string; topic: Topic | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !topic;
  const [title, setTitle] = useState(topic?.title || "");
  const [kind, setKind] = useState(topic?.kind || "modulo");
  const [contentHtml, setContentHtml] = useState(topic?.content_html || "");
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return toast("Titolo obbligatorio");
    setSaving(true);
    try {
      const body = JSON.stringify({ title: title.trim(), kind, content_html: contentHtml, order: topic?.order || 0 });
      if (isNew) {
        await api(`/admin/courses/${courseId}/topics`, { method: "POST", body });
      } else {
        await api(`/admin/topics/${topic!.id}`, { method: "PATCH", body });
      }
      onSaved();
    } catch (e: any) { toast("Errore", e?.message || "-"); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!topic) return;
    confirmDelete("Eliminare l'argomento?", "L'operazione è irreversibile.", async () => {
      try { await api(`/admin/topics/${topic.id}`, { method: "DELETE" }); onSaved(); }
      catch (e: any) { toast("Errore", e?.message || "-"); }
    });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={s.editorHeader}>
          <Pressable onPress={onClose}><Text style={s.headerBtn}>Annulla</Text></Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>{isNew ? "Nuovo Argomento" : "Modifica"}</Text>
          <Pressable onPress={save} disabled={saving}>
            <Text style={[s.headerBtn, { fontWeight: "800" }]}>{saving ? "…" : "Salva"}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={s.label}>Titolo *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Titolo argomento" placeholderTextColor={colors.muted} />

          <Text style={s.label}>Tipo</Text>
          <View style={s.chipRow}>
            {TOPIC_KINDS.map((k) => (
              <Pressable key={k.key} onPress={() => setKind(k.key)} style={[s.aChip, kind === k.key && s.aChipActive]}>
                <Text style={[s.aChipTxt, kind === k.key && s.aChipTxtActive]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            {TOPIC_KINDS.find((k) => k.key === kind)?.hint}
          </Text>

          <Text style={[s.label, { marginTop: spacing.lg }]}>Contenuto (WYSIWYG)</Text>
          <Pressable onPress={() => setEditorOpen(true)} style={s.editorLauncher}>
            <Text style={{ color: contentHtml ? colors.onSurface : colors.muted, fontSize: 14 }}>
              {contentHtml ? "✎ Modifica contenuto" : "✎ Apri editor…"}
            </Text>
          </Pressable>
          {contentHtml ? (
            <View style={s.previewBox}>
              <Text style={s.previewLabel}>Anteprima:</Text>
              <View style={{ height: 220 }}>
                <RichViewer html={contentHtml} />
              </View>
            </View>
          ) : null}
          <RichEditor
            visible={editorOpen}
            initialHtml={contentHtml}
            onSave={(h) => { setContentHtml(h); setEditorOpen(false); }}
            onClose={() => setEditorOpen(false)}
            title={title || "Argomento"}
          />

          {!isNew ? (
            <Pressable onPress={del} style={[s.primaryBtn, { backgroundColor: colors.danger || "#c33", marginTop: spacing.xl }]}>
              <Text style={s.primaryTxt}>Elimina Argomento</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─────────── Quiz editor ─────────── */
function QuizEditor({
  courseId, quiz, onClose, onSaved,
}: { courseId: string; quiz: Quiz; onClose: () => void; onSaved: () => void }) {
  type Q = { id: string; text: string; answers: { text: string; is_correct: boolean }[]; explanation: string };
  const [questions, setQuestions] = useState<Q[]>(
    quiz?.questions?.length
      ? quiz.questions
      : [{ id: crypto.randomUUID?.() || String(Math.random()), text: "", answers: [ { text: "", is_correct: true }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false } ], explanation: "" }]
  );
  const [saving, setSaving] = useState(false);

  const addQuestion = () => setQuestions((qs) => [
    ...qs,
    { id: crypto.randomUUID?.() || String(Math.random()), text: "", answers: [ { text: "", is_correct: true }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false } ], explanation: "" }
  ]);
  const delQuestion = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));

  const setQ = (i: number, patch: Partial<Q>) => setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  const setAnswer = (qi: number, ai: number, text: string) => setQuestions((qs) => qs.map((q, i) => i === qi ? { ...q, answers: q.answers.map((a, j) => j === ai ? { ...a, text } : a) } : q));
  const setCorrect = (qi: number, ai: number) => setQuestions((qs) => qs.map((q, i) => i === qi ? { ...q, answers: q.answers.map((a, j) => ({ ...a, is_correct: j === ai })) } : q));

  const save = async () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return toast(`Domanda ${i + 1}: testo mancante`);
      const filled = q.answers.filter(a => a.text.trim());
      if (filled.length < 2) return toast(`Domanda ${i + 1}: servono almeno 2 risposte`);
      if (!q.answers.some(a => a.is_correct && a.text.trim())) return toast(`Domanda ${i + 1}: manca risposta corretta`);
    }
    setSaving(true);
    try {
      const payload = {
        questions: questions.map(q => ({ ...q, answers: q.answers.filter(a => a.text.trim()) })),
        pass_threshold: 0.7,
        max_attempts: 3,
      };
      await api(`/admin/courses/${courseId}/quiz`, { method: "PUT", body: JSON.stringify(payload) });
      onSaved();
    } catch (e: any) { toast("Errore", e?.message || "-"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={s.editorHeader}>
          <Pressable onPress={onClose}><Text style={s.headerBtn}>Annulla</Text></Pressable>
          <Text style={s.headerTitle}>Quiz — 70% · 3 tentativi</Text>
          <Pressable onPress={save} disabled={saving}>
            <Text style={[s.headerBtn, { fontWeight: "800" }]}>{saving ? "…" : "Salva"}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
          {questions.map((q, i) => (
            <View key={q.id} style={s.qCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={s.qNum}>Domanda {i + 1}</Text>
                {questions.length > 1 ? (
                  <Pressable onPress={() => delQuestion(i)}><Text style={{ color: colors.danger || "#c33" }}>Elimina</Text></Pressable>
                ) : null}
              </View>
              <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Testo della domanda" placeholderTextColor={colors.muted} multiline value={q.text} onChangeText={(t) => setQ(i, { text: t })} />
              {q.answers.map((a, ai) => (
                <View key={ai} style={s.answerRow}>
                  <Pressable onPress={() => setCorrect(i, ai)} style={[s.check, a.is_correct && s.checkOn]}>
                    <Text style={{ color: a.is_correct ? "#fff" : colors.muted, fontWeight: "800" }}>{a.is_correct ? "✓" : ""}</Text>
                  </Pressable>
                  <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder={`Risposta ${ai + 1}`} placeholderTextColor={colors.muted} value={a.text} onChangeText={(t) => setAnswer(i, ai, t)} />
                </View>
              ))}
              <Text style={[s.label, { marginTop: 6 }]}>Spiegazione (mostrata dopo la risposta)</Text>
              <TextInput style={[s.input, { minHeight: 60 }]} multiline placeholder="Spiegazione della risposta corretta…" placeholderTextColor={colors.muted} value={q.explanation} onChangeText={(t) => setQ(i, { explanation: t })} />
            </View>
          ))}
          <Pressable onPress={addQuestion} style={s.primaryBtnSm2}>
            <Text style={s.primaryTxt}>+ Aggiungi domanda</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─────────── Promo editor ─────────── */
function PromoEditor({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: () => void }) {
  const [active, setActive] = useState(course.promo.active);
  const [pricePromo, setPricePromo] = useState(course.promo.price_promo ? String(course.promo.price_promo) : "");
  const [days, setDays] = useState(course.promo.duration_days ? String(course.promo.duration_days) : "7");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (active) {
      if (!pricePromo || Number(pricePromo) <= 0) return toast("Prezzo promo obbligatorio");
      if (!days || Number(days) <= 0) return toast("Durata (giorni) obbligatoria");
      if (Number(pricePromo) >= course.price) return toast("Il prezzo promo dev'essere < del normale");
    }
    setSaving(true);
    try {
      await api(`/admin/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          promo: {
            active,
            price_promo: active ? Number(pricePromo) : null,
            duration_days: active ? Number(days) : null,
          },
        }),
      });
      onSaved();
    } catch (e: any) { toast("Errore", e?.message || "-"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={s.editorHeader}>
          <Pressable onPress={onClose}><Text style={s.headerBtn}>Annulla</Text></Pressable>
          <Text style={s.headerTitle}>Promozione</Text>
          <Pressable onPress={save} disabled={saving}>
            <Text style={[s.headerBtn, { fontWeight: "800" }]}>{saving ? "…" : "Salva"}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg }}>
            <Text style={s.label}>Attiva promo</Text>
            <Switch value={active} onValueChange={setActive} />
          </View>
          <Text style={s.label}>Prezzo normale (€)</Text>
          <TextInput style={s.input} editable={false} value={course.price.toFixed(2)} />
          <Text style={s.label}>Prezzo promo (€)</Text>
          <TextInput style={s.input} value={pricePromo} onChangeText={(t) => setPricePromo(t.replace(",", ".").replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholderTextColor={colors.muted} />
          <Text style={s.label}>Durata (giorni)</Text>
          <TextInput style={s.input} value={days} onChangeText={(t) => setDays(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholderTextColor={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Alla scadenza il corso torna al prezzo normale automaticamente.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─────────── Styles ─────────── */
const s = StyleSheet.create({
  subtabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  subtab: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  subtabActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  subtabTxt: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  subtabTxtActive: { color: colors.onBrandPrimary },
  h1: { color: colors.onSurface, fontSize: 20, fontWeight: "800", marginBottom: spacing.md },
  h2: { color: colors.onSurface, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  label: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginTop: spacing.md, marginBottom: 6 },
  input: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 12, color: colors.onSurface, marginBottom: spacing.sm, fontSize: 15 },
  cover: { width: "100%", height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  coverRemove: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  coverBadge: { position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  coverBadgeTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  coverReplace: { marginTop: 8, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", alignItems: "center" },
  upload: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", marginBottom: spacing.md },
  uploadTxt: { color: colors.brandPrimary, fontSize: 14 },
  editorLauncher: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginBottom: 8 },
  previewBox: { marginBottom: spacing.md },
  previewLabel: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  rowRadio: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  radio: { flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center" },
  radioActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  radioTxt: { color: colors.onSurfaceSecondary, fontWeight: "600" },
  radioTxtActive: { color: colors.brandPrimary },
  freeBox: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary, borderLeftWidth: 3, borderLeftColor: colors.brandPrimary, marginBottom: spacing.md },
  freeTitle: { color: colors.onBrandTertiary, fontWeight: "800", fontSize: 14 },
  freeBody: { color: colors.onBrandTertiary, fontSize: 13, lineHeight: 19, marginTop: 4, opacity: 0.9 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  aChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  aChipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary },
  aChipTxt: { color: colors.onSurfaceSecondary, fontSize: 13 },
  aChipTxtActive: { color: colors.onBrandPrimary, fontWeight: "700" },
  primaryBtn: { backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: radius.md, alignItems: "center", marginTop: spacing.lg },
  primaryBtnSm: { backgroundColor: colors.brandPrimary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, alignItems: "center" },
  primaryBtnSm2: { backgroundColor: colors.brandPrimary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md, alignItems: "center", alignSelf: "flex-start", marginTop: 8 },
  primaryTxt: { color: colors.onBrandPrimary, fontWeight: "800" },
  empty: { color: colors.muted, textAlign: "center", padding: spacing.lg, fontStyle: "italic" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginBottom: spacing.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  cardCover: { width: "100%", height: 140, backgroundColor: colors.surfaceSecondary },
  cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", flex: 1 },
  cardMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: spacing.md, flexWrap: "wrap" },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandPrimary },
  actionBtnAlt: { borderColor: colors.border },
  actionBtnDanger: { borderColor: colors.danger || "#c33" },
  actionTxt: { color: colors.brandPrimary, fontSize: 13, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  areaRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  editorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 48, paddingBottom: 12, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn: { color: colors.brandPrimary, fontSize: 15 },
  headerTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center", marginHorizontal: 8 },
  section: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl },
  topicRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginTop: 6, borderWidth: 1, borderColor: colors.border },
  topicNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  topicNumTxt: { color: colors.onBrandPrimary, fontWeight: "800" },
  topicTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  topicKind: { color: colors.muted, fontSize: 12, marginTop: 2 },
  qCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  qNum: { color: colors.brandPrimary, fontWeight: "800" },
  answerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checkOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
});
