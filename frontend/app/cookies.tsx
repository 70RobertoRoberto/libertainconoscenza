import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

const CONTACT_EMAIL = "info@scienzebiofisiche.it";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Cosa sono i cookie",
    body:
      `I cookie sono piccoli file di testo che i siti e le app salvano sul tuo dispositivo per farne funzionare determinate parti o per raccogliere informazioni statistiche. In un'applicazione mobile come "Libertà in Conoscenza" utilizziamo tecnologie equivalenti (local storage, SecureStore, token cifrati) che qui chiamiamo "cookie" per semplicità.`,
  },
  {
    title: "2. Tipologie di cookie utilizzate",
    body:
      `• Cookie tecnici (sempre attivi, senza consenso): sono indispensabili per il funzionamento dell'app. Comprendono il token di sessione cifrato, le preferenze di lingua, l'aver visto l'onboarding, i preferiti salvati.\n\n• Cookie analitici di prima parte con IP anonimizzato (senza consenso): raccolgono statistiche aggregate anonime sull'uso dell'app per aiutarci a migliorarla. I dati non sono riconducibili all'utente.\n\n• Cookie analitici di terze parti (solo con consenso): eventuali strumenti di analisi comportamentale forniti da terzi. Vengono attivati solo se accetti tramite il banner.\n\n• Cookie di profilazione o marketing (solo con consenso): oggi non ne utilizziamo. Se in futuro decidessimo di introdurli, ti chiederemo un consenso esplicito.`,
  },
  {
    title: "3. Il banner cookie",
    body:
      `Al primo accesso all'app, subito dopo la registrazione, ti mostriamo una sola volta un banner con tre pulsanti:\n\n• "Accetta tutto" → autorizzi tutte le categorie di cookie.\n• "Rifiuta tutto" → attivi solo i cookie tecnici, necessari al funzionamento.\n• "Personalizza" → scegli singolarmente quali categorie autorizzare.\n\nIl banner include il link a questa Cookie Policy. La tua scelta viene salvata sul dispositivo e sul tuo profilo; non ti verrà più chiesta a ogni apertura.`,
  },
  {
    title: "4. Revoca e modifica del consenso",
    body:
      `Puoi modificare o revocare il consenso ai cookie in qualsiasi momento dal tuo Profilo → Sezione "Privacy e cookie". La modifica ha effetto immediato: eventuali cookie non più autorizzati non verranno più utilizzati e i dati raccolti attraverso di essi verranno cancellati o resi anonimi entro tempi tecnici ragionevoli.`,
  },
  {
    title: "5. Base giuridica",
    body:
      `I cookie tecnici e analitici di prima parte con IP anonimizzato non richiedono consenso ai sensi del provvedimento del Garante Privacy del 10 giugno 2021 e delle Linee Guida EDPB. I cookie analitici di terze parti e quelli di profilazione richiedono invece un consenso esplicito ai sensi dell'art. 6.1.a GDPR.`,
  },
  {
    title: "6. Conservazione dei dati raccolti",
    body:
      `I dati raccolti tramite cookie sono conservati per il tempo strettamente necessario alle finalità dichiarate. Le preferenze utente restano finché non le modifichi; i dati statistici anonimi sono conservati in forma aggregata; i cookie di terze parti seguono le policy dei rispettivi fornitori, che indicheremo nel banner al momento dell'attivazione.`,
  },
  {
    title: "7. Contatti",
    body:
      `Per qualsiasi domanda relativa a questa Cookie Policy o all'uso dei cookie nell'app scrivi a ${CONTACT_EMAIL}. Consulta anche la nostra Privacy Policy per il quadro completo dei trattamenti.`,
  },
];

export default function Cookies() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xxxl,
      }}
    >
      <View style={styles.header}>
        <Pressable testID="back-cookies" onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Cookie Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.lastUpdate}>Ultimo aggiornamento: 27 settembre 2026</Text>
        <Text style={styles.intro}>
          In questa pagina ti spieghiamo quali cookie e tecnologie simili utilizziamo,
          perché li usiamo e come puoi gestire le tue preferenze in qualsiasi momento.
        </Text>

        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
          <Text style={styles.contact}>📧  Scrivici: {CONTACT_EMAIL}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  lastUpdate: { color: colors.muted, fontSize: 12, fontStyle: "italic", marginTop: spacing.md },
  intro: {
    color: colors.onSurfaceSecondary,
    fontSize: 15, lineHeight: 24, marginTop: spacing.md,
    fontFamily: "Georgia",
  },
  section: { marginTop: spacing.xxl },
  sectionTitle: {
    color: colors.brandPrimary, fontSize: 15, fontWeight: "800",
    marginBottom: spacing.sm,
  },
  sectionBody: {
    color: colors.onSurfaceSecondary,
    fontSize: 14, lineHeight: 22,
    fontFamily: "Georgia",
  },
  contact: {
    color: colors.brandPrimary, fontWeight: "700",
    textAlign: "center", marginTop: spacing.xxxl, fontSize: 13,
  },
});
