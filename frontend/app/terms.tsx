import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

const APP_NAME = "Conoscenza Aperta";
const CONTACT_EMAIL = "info@scienzebiofisiche.it";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Chi siamo e cosa offriamo",
    body:
      `Conoscenza Aperta è un'applicazione mobile dedicata alla crescita personale, spirituale e al Ben Essere, che raccoglie articoli, meditazioni audio e video su temi come biofisica quantistica, meditazione, naturopatia, medicina integrata, filosofia e discipline orientali. L'app è offerta gratuitamente per la fruizione dei contenuti base; alcuni contenuti avanzati sono riservati a utenti abbonati.`,
  },
  {
    title: "2. Registrazione e uso dell'account",
    body:
      `Per usare l'app devi registrare un account fornendo un numero di telefono valido, una password e il tuo nome. Un numero di telefono può essere associato a un solo account. Sei responsabile della riservatezza della tua password e di ogni attività effettuata dal tuo account. Se sospetti un uso non autorizzato, avvisaci subito e cambia la password dal Profilo → Sicurezza → Cambia password.`,
  },
  {
    title: "3. Abbonamenti Premium",
    body:
      `I piani Premium (24 ore, 1 settimana, 3, 6 o 12 mesi) danno accesso ai contenuti avanzati. Attualmente l'attivazione dell'abbonamento è manuale: dopo aver scelto il piano dall'app riceverai istruzioni per completare il pagamento tramite bonifico o accordo diretto, e l'accesso Premium sarà attivato manualmente. L'abbonamento non si rinnova automaticamente e scade alla data indicata. Non sono previsti rimborsi se non nei casi obbligatori di legge.`,
  },
  {
    title: "4. Codici sconto e referral",
    body:
      `Puoi applicare codici sconto durante la richiesta di abbonamento e invitare altri utenti tramite il tuo codice referral. Per ogni amico che si iscrive col tuo codice ricevi un mese di Premium in regalo, secondo le regole in vigore al momento dell'invito.`,
  },
  {
    title: "5. Uso corretto del servizio",
    body:
      `Ti impegni a usare l'app in modo corretto, rispettando gli altri utenti nei commenti e nelle interazioni. Sono vietati: linguaggio offensivo, spam, contenuti illegali o lesivi di diritti altrui, e ogni utilizzo del servizio per fini che possano ledere altre persone. Ci riserviamo il diritto di rimuovere contenuti inappropriati e sospendere account che violano queste regole.`,
  },
  {
    title: "6. Proprietà intellettuale",
    body:
      `Tutti i contenuti presenti nell'app (articoli, meditazioni, video, immagini, marchio, grafica) sono proprietà di Conoscenza Aperta o dei rispettivi autori e sono protetti dalle leggi sul diritto d'autore. È vietato copiare, ridistribuire, rivendere o pubblicare i contenuti al di fuori dell'app senza autorizzazione scritta. È consentito condividere singoli articoli tramite le funzioni di condivisione integrate.`,
  },
  {
    title: "7. Contenuti a scopo informativo",
    body:
      `I contenuti dell'app hanno finalità informative, culturali e di crescita personale. NON sono consigli medici, psicologici, terapeutici o farmaceutici e non sostituiscono in alcun modo il parere di un medico o di un professionista qualificato. Per problemi di salute rivolgiti sempre a un medico. Conoscenza Aperta non risponde di eventuali decisioni prese dagli utenti sulla base dei contenuti pubblicati.`,
  },
  {
    title: "8. Limitazione di responsabilità",
    body:
      `L'app è fornita "così com'è". Facciamo il massimo per garantire disponibilità e correttezza dei contenuti, ma non possiamo garantire un funzionamento ininterrotto o l'assenza di errori. Non siamo responsabili per eventuali interruzioni del servizio, perdita di dati o danni indiretti derivanti dall'uso dell'app.`,
  },
  {
    title: "9. Modifiche ai termini",
    body:
      `Possiamo modificare questi termini per aggiornarli alle esigenze del servizio o alle norme di legge. Ti informeremo delle modifiche significative tramite la home dell'app o via notifica. L'uso continuato dell'app dopo la modifica vale come accettazione dei nuovi termini.`,
  },
  {
    title: "10. Contatti e legge applicabile",
    body:
      `Per qualsiasi domanda su questi termini scrivi a ${CONTACT_EMAIL}. Il servizio è governato dalla legge italiana; qualsiasi controversia sarà di competenza del Foro del consumatore secondo le norme applicabili.`,
  },
];

export default function Terms() {
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
        <Pressable testID="back-terms" onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Termini di Servizio</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.lastUpdate}>Ultimo aggiornamento: 20 settembre 2026</Text>
        <Text style={styles.intro}>
          {`Benvenuto in ${APP_NAME}. Utilizzando l'app accetti i termini che seguono. Ti chiediamo di leggerli con attenzione.`}
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
    textAlign: "center", marginTop: spacing.xxxl, fontSize: 14,
  },
});
