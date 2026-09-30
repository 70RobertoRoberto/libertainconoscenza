import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { LOGO_URL } from "@/src/assets";
import { RichViewer } from "@/src/RichEditor";
import FabMenu from "@/src/FabMenu";

type Cert = {
  id: string;
  user_name: string;
  course_title: string;
  issued_at: string;
  score: number;
};

function toast(t: string, m?: string) {
  const text = m ? `${t}\n\n${m}` : t;
  if (Platform.OS === "web") { if (typeof window !== "undefined") window.alert(text); return; }
  Alert.alert(t, m);
}

/**
 * Certificato di completamento — template neutro provvisorio.
 * Verrà sostituito dal template definitivo quando l'utente fornirà il PDF di riferimento.
 * Il rendering avviene via HTML dentro RichViewer, così su web è stampabile e su native è condivisibile.
 */
export default function CertificateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ["u-cert", id],
    queryFn: () => api<Cert>(`/certificates/${id}`),
    enabled: !!id,
  });

  if (isLoading || !data) return <View style={styles.centered}><ActivityIndicator color={colors.brandPrimary} /></View>;

  const issued = data.issued_at ? new Date(data.issued_at) : new Date();
  const dateStr = issued.toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" });
  const codice = data.id.slice(0, 8).toUpperCase();

  const html = buildCertificateHtml({
    userName: data.user_name,
    courseTitle: data.course_title,
    dateStr,
    codice,
    score: Math.round(data.score * 100),
    logoUrl: LOGO_URL,
  });

  const onPrint = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) { toast("Popup bloccato", "Consenti i popup e riprova."); return; }
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    } else {
      toast("Salvataggio PDF", "Su cellulare userai la condivisione di sistema quando la funzione sarà completa.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.backTxt}>‹</Text></Pressable>
        <Text style={styles.headerTitle}>Certificato</Text>
        <Pressable onPress={onPrint} hitSlop={10}>
          <Text style={styles.actionTxt}>📄 PDF</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.frame}>
          <View style={{ height: 520 }}>
            <RichViewer html={html} />
          </View>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>Codice</Text>
          <Text style={styles.metaValue}>{codice}</Text>
          <Text style={styles.metaLabel}>Punteggio</Text>
          <Text style={styles.metaValue}>{Math.round(data.score * 100)}%</Text>
          <Text style={styles.metaLabel}>Rilasciato</Text>
          <Text style={styles.metaValue}>{dateStr}</Text>
        </View>

        <Pressable onPress={onPrint} style={styles.printBtn}>
          <Text style={styles.printTxt}>📄  Salva / Stampa PDF</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/(tabs)/corsi" as any)} style={styles.secondaryBtn}>
          <Text style={styles.secondaryTxt}>🎓  Elenco corsi</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/my-certificates" as any)} style={styles.secondaryBtn}>
          <Text style={styles.secondaryTxt}>📜  I miei certificati</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/(tabs)" as any)} style={styles.secondaryBtn}>
          <Text style={styles.secondaryTxt}>🏠  Home</Text>
        </Pressable>
        <Text style={styles.note}>
          Template provvisorio. Verrà sostituito dal certificato ufficiale &quot;Libertà in Conoscenza&quot; quando disponibile.
        </Text>
      </ScrollView>
      <FabMenu />
    </View>
  );
}

function buildCertificateHtml(p: {
  userName: string; courseTitle: string; dateStr: string; codice: string; score: number; logoUrl: string;
}) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; padding: 40px 60px; font-family: 'Georgia', serif; background: #fff; color: #0B1B3A; }
  .frame { border: 6px double #D4AF37; padding: 40px; text-align: center; height: 100%; box-sizing: border-box; }
  .logo { width: 90px; height: 90px; margin: 0 auto 20px; display: block; border-radius: 50%; }
  .brand { color: #D4AF37; font-size: 14px; letter-spacing: 6px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
  h1 { color: #0B1B3A; font-size: 38px; font-weight: 700; margin: 0 0 24px; letter-spacing: 2px; }
  .subtitle { color: #444; font-size: 15px; margin-bottom: 24px; letter-spacing: 1px; }
  .name { color: #0B1B3A; font-size: 32px; font-weight: 700; font-style: italic; margin: 16px 0; padding-bottom: 12px; border-bottom: 1px solid #D4AF37; display: inline-block; padding: 8px 40px 12px; }
  .body { color: #333; font-size: 15px; line-height: 1.7; max-width: 620px; margin: 20px auto; }
  .course { color: #0B1B3A; font-size: 22px; font-weight: 700; font-style: italic; margin: 10px 0; }
  .footer { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; color: #666; }
  .foot-item { text-align: center; flex: 1; }
  .foot-label { color: #999; letter-spacing: 2px; text-transform: uppercase; font-size: 10px; }
  .foot-val { color: #0B1B3A; font-weight: 700; margin-top: 4px; }
  .seal { color: #D4AF37; font-size: 40px; letter-spacing: 2px; margin: 10px 0; }
</style>
</head><body>
<div class="frame">
  <img class="logo" src="${p.logoUrl}" alt="logo"/>
  <div class="brand">Libertà in Conoscenza</div>
  <h1>Certificato di Completamento</h1>
  <div class="subtitle">Si attesta che</div>
  <div class="name">${escapeHtml(p.userName)}</div>
  <div class="body">
    ha completato con successo il percorso formativo intitolato
    <div class="course">${escapeHtml(p.courseTitle)}</div>
    superando la prova di valutazione finale con un punteggio del <b>${p.score}%</b>.
  </div>
  <div class="seal">✦</div>
  <div class="footer">
    <div class="foot-item"><div class="foot-label">Data</div><div class="foot-val">${escapeHtml(p.dateStr)}</div></div>
    <div class="foot-item"><div class="foot-label">Codice certificato</div><div class="foot-val">${p.codice}</div></div>
    <div class="foot-item"><div class="foot-label">Firma</div><div class="foot-val" style="font-style:italic;">Libertà in Conoscenza</div></div>
  </div>
</div>
</body></html>`;
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  backTxt: { color: colors.brandPrimary, fontSize: 26, fontWeight: "700", paddingHorizontal: 6 },
  headerTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", flex: 1, textAlign: "center" },
  actionTxt: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700", paddingHorizontal: 6 },
  frame: { backgroundColor: "#fff", borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  meta: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  metaLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginTop: 6 },
  metaValue: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  printBtn: { backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: radius.md, alignItems: "center", marginTop: spacing.lg },
  printTxt: { color: colors.onBrandPrimary, fontWeight: "800" },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.surfaceSecondary,
  },
  secondaryTxt: { color: colors.brandPrimary, fontWeight: "700", fontSize: 14 },
  note: { color: colors.muted, fontSize: 12, fontStyle: "italic", textAlign: "center", marginTop: 12 },
});
