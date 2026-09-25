import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { useLang } from "@/src/i18n";

/**
 * "Corsi" tab — placeholder / coming-soon page.
 * Announces the upcoming courses section (multi-lesson learning paths).
 * Replace this file when the real Courses feature is ready.
 */
export default function CorsiScreen() {
  const { t: _t } = useLang();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Corsi</Text>
        <Text style={styles.title}>Percorsi formativi</Text>
        <Text style={styles.subtitle}>
          Presto disponibili: percorsi strutturati in più lezioni per formarti
          in profondità, al tuo ritmo.
        </Text>

        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>◆  In arrivo</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Che cosa troverai</Text>
          <Text style={styles.cardBody}>
            Ogni corso sarà articolato in moduli tematici con contenuti testuali,
            audio e video, esercizi pratici e verifiche di apprendimento.
            {"\n\n"}
            Alcuni corsi saranno gratuiti e aperti a tutti; altri, di
            approfondimento qualificato, saranno riservati agli iscritti Premium
            o disponibili in acquisto singolo.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Primi argomenti</Text>
          <View style={{ gap: 10 }}>
            {[
              "Fondamenti di Somatognostica Scalare Cardiocentrica",
              "Tecnica Bioenergetica secondo il Metodo Summa Aurea",
              "Meditazione: dalle basi ai percorsi avanzati",
              "Fisica Quantistica e Coscienza",
              "Kabbalah: introduzione all'Albero della Vita",
            ].map((s, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.dot}>◈</Text>
                <Text style={styles.rowTxt}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          disabled
          style={({ pressed }) => [
            styles.notify,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.notifyTxt}>
            Sarai avvisato appena i primi corsi saranno pubblicati
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.brandPrimary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 6,
  },
  subtitle: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: 8,
  },
  badgeTxt: {
    color: colors.onBrandTertiary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  cardTitle: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 10,
  },
  cardBody: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { color: colors.brandPrimary, fontSize: 13, marginTop: 3 },
  rowTxt: { color: colors.onSurface, fontSize: 14, flex: 1, lineHeight: 20 },
  notify: {
    marginTop: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  notifyTxt: { color: colors.muted, fontSize: 13, fontStyle: "italic" },
});
