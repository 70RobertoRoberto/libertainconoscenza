import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

const APP_NAME = "Conoscenza Aperta";
const CONTACT_EMAIL = "info@conoscenzaaperta.it"; // segnaposto — sostituire con email reale

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Chi è il Titolare del trattamento",
    body:
      `Il Titolare del trattamento dei dati personali raccolti tramite l'app ${APP_NAME} è il team di Conoscenza Aperta. Per qualsiasi domanda o richiesta relativa alla tua privacy puoi scrivere a ${CONTACT_EMAIL}.`,
  },
  {
    title: "2. Dati che raccogliamo",
    body:
      `Al momento della registrazione ti chiediamo: numero di telefono (obbligatorio, come identificativo dell'account), nome (obbligatorio), password (cifrata, mai memorizzata in chiaro), lingua preferita. Durante l'uso dell'app raccogliamo automaticamente: contenuti letti/ascoltati/visualizzati, tempo di meditazione, articoli preferiti, commenti pubblicati, codici referral usati, ordini di abbonamento richiesti, token di notifica (solo se autorizzi le push). Non raccogliamo dati di geolocalizzazione precisa, contatti della rubrica, foto o file dal tuo dispositivo se non quando li carichi volontariamente.`,
  },
  {
    title: "3. Finalità del trattamento",
    body:
      `Usiamo i tuoi dati esclusivamente per: (a) permetterti di accedere all'app e gestire il tuo account; (b) mostrarti contenuti nella lingua e categorie che preferisci; (c) tracciare i tuoi progressi (articoli letti, minuti meditati) e mostrarti statistiche personali; (d) gestire le richieste di abbonamento Premium; (e) inviarti notifiche push se le autorizzi; (f) migliorare l'app tramite statistiche aggregate anonime. Non profiliamo utenti per pubblicità mirata e non vendiamo dati a terzi.`,
  },
  {
    title: "4. Base giuridica",
    body:
      `Il trattamento è basato su: esecuzione del contratto tra te e Conoscenza Aperta (art. 6.1.b GDPR) per le funzioni essenziali dell'app; consenso (art. 6.1.a GDPR) per l'invio di notifiche push; legittimo interesse (art. 6.1.f GDPR) per statistiche aggregate anonime e prevenzione abusi.`,
  },
  {
    title: "5. Conservazione dei dati",
    body:
      `Manteniamo i tuoi dati finché il tuo account è attivo. Se cancelli l'account (contattandoci a ${CONTACT_EMAIL}) elimineremo i tuoi dati personali entro 30 giorni, eccetto quelli che dobbiamo conservare per obblighi di legge (es. dati fiscali degli ordini per 10 anni). Le password sono conservate cifrate tramite bcrypt: neanche noi possiamo leggerle.`,
  },
  {
    title: "6. Con chi condividiamo i dati",
    body:
      `I dati sono trattati sui nostri server hosting (Emergent/Google Cloud) e sul database MongoDB. Non condividiamo dati con terzi a fini commerciali. Potremmo condividere dati solo con: (a) fornitori tecnici essenziali (hosting, backup) sotto adeguati contratti di trattamento; (b) autorità competenti se richiesto dalla legge.`,
  },
  {
    title: "7. Trasferimenti internazionali",
    body:
      `I dati sono conservati in datacenter dell'Unione Europea quando possibile. Alcuni servizi cloud potrebbero comportare trasferimenti extra-UE (es. Stati Uniti) coperti da clausole contrattuali standard approvate dalla Commissione Europea.`,
  },
  {
    title: "8. I tuoi diritti (GDPR)",
    body:
      `In qualunque momento hai diritto a: accedere ai tuoi dati; rettificarli se sbagliati; cancellarli (diritto all'oblio); limitarne il trattamento; opporti al trattamento; portabilità dei dati; revocare il consenso alle notifiche. Puoi esercitare questi diritti scrivendo a ${CONTACT_EMAIL} e ti risponderemo entro 30 giorni. Hai inoltre il diritto di proporre reclamo al Garante per la Protezione dei Dati Personali (garanteprivacy.it).`,
  },
  {
    title: "9. Sicurezza",
    body:
      `Adottiamo misure tecniche e organizzative per proteggere i tuoi dati: password cifrate con bcrypt, connessioni HTTPS, autenticazione tramite token JWT firmati, accesso ai server limitato e loggato. Nessun sistema è sicuro al 100%: in caso di violazione ti avviseremo entro 72 ore come richiesto dalla legge.`,
  },
  {
    title: "10. Cookie e tecnologie di tracciamento",
    body:
      `L'app mobile non usa cookie di tracciamento pubblicitario. Utilizziamo il local storage del dispositivo esclusivamente per salvare le tue preferenze (lingua selezionata, aver visto il banner di benvenuto, token di accesso cifrato). Non utilizziamo strumenti di analytics comportamentale di terzi.`,
  },
  {
    title: "11. Minori",
    body:
      `L'app è pensata per un pubblico adulto. Non raccogliamo consapevolmente dati di minori di 16 anni. Se ci accorgiamo di aver raccolto dati di un minore senza il consenso dei genitori, li elimineremo immediatamente.`,
  },
  {
    title: "12. Aggiornamenti a questa Privacy Policy",
    body:
      `Possiamo aggiornare questa policy per adeguarci a nuove norme o funzionalità. Ti informeremo tramite la home dell'app o notifica. La data dell'ultimo aggiornamento è indicata in cima a questa pagina.`,
  },
];

export default function Privacy() {
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
        <Pressable testID="back-privacy" onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.lastUpdate}>Ultimo aggiornamento: 20 settembre 2026</Text>
        <Text style={styles.intro}>
          La tua privacy è importante per noi. In questa pagina ti spieghiamo in modo trasparente
          quali dati raccogliamo, perché li usiamo e quali sono i tuoi diritti (GDPR compliant).
        </Text>

        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
          <Text style={styles.contact}>📧  Contattaci per esercitare i tuoi diritti: {CONTACT_EMAIL}</Text>
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
