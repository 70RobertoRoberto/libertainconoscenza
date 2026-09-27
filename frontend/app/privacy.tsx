import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

const APP_NAME = "Libertà in Conoscenza";
const CONTACT_EMAIL = "info@scienzebiofisiche.it";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Titolare del trattamento",
    body:
      `Il Titolare del trattamento dei dati personali raccolti tramite l'app ${APP_NAME} è la Direzione di Libertà in Conoscenza. Per qualsiasi domanda o richiesta relativa alla tua privacy puoi scrivere a ${CONTACT_EMAIL}. Riferimento normativo: Regolamento (UE) 2016/679 (GDPR) e D.Lgs. 196/2003 e successive modificazioni.`,
  },
  {
    title: "2. Dati che raccogliamo",
    body:
      `Al momento della registrazione: numero di telefono (identificativo dell'account), nome, password (cifrata con bcrypt, mai in chiaro), lingua preferita.\n\nIn fase di abbonamento o acquisto di corsi Premium: nome e cognome, indirizzo, codice fiscale o P.IVA, cellulare, email di fatturazione.\n\nDurante l'uso dell'app: contenuti letti, ascoltati e visualizzati, tempo di meditazione, articoli preferiti, commenti pubblicati, codici referral usati, ordini di abbonamento o acquisti registrati, risultati dei quiz dei corsi, token di notifica push (solo se autorizzato).\n\nNon raccogliamo geolocalizzazione precisa, contatti della rubrica, foto o file dal tuo dispositivo se non quando li carichi volontariamente.`,
  },
  {
    title: "3. Finalità del trattamento",
    body:
      `Usiamo i tuoi dati esclusivamente per: (a) esecuzione del contratto e gestione dell'account; (b) emissione dell'attestato al superamento del quiz; (c) emissione delle ricevute fiscali per abbonamenti e acquisti; (d) memorizzazione dei risultati dei quiz e dei corsi; (e) adempimenti di legge (fatturazione, obblighi fiscali, tracciabilità del consenso); (f) invio di comunicazioni promozionali solo se autorizzato con specifico consenso; (g) miglioramento dell'app tramite statistiche aggregate anonime. Non profiliamo utenti per pubblicità mirata e non vendiamo dati a terzi.`,
  },
  {
    title: "4. Base giuridica del trattamento",
    body:
      `Il trattamento è basato su:\n• art. 6.1.b GDPR (esecuzione del contratto) per le funzioni essenziali dell'app, gli abbonamenti e gli acquisti;\n• art. 6.1.c GDPR (obbligo legale) per emissione ricevute fiscali, conservazione documenti contabili e tracciabilità dei consensi;\n• art. 6.1.a GDPR (consenso esplicito) per invio di comunicazioni promozionali e notifiche push;\n• art. 6.1.f GDPR (legittimo interesse) per statistiche aggregate anonime e prevenzione abusi.`,
  },
  {
    title: "5. Conservazione dei dati",
    body:
      `• Dati contrattuali (fatturazione, ordini): durata del rapporto + 10 anni, per obblighi fiscali di legge.\n• Dati di account e attività: finché l'account è attivo. Se richiedi la cancellazione dell'account scrivendo a ${CONTACT_EMAIL}, eliminiamo i tuoi dati personali entro 30 giorni, tranne i dati che dobbiamo conservare per legge.\n• Dati di navigazione: secondo la nostra Cookie Policy.\n• Password: cifrate con bcrypt (neanche noi possiamo leggerle).`,
  },
  {
    title: "6. Con chi condividiamo i dati",
    body:
      `I dati sono trattati sui nostri server hosting (Emergent/Google Cloud) e sul database MongoDB. Non condividiamo dati con terzi a fini commerciali. Potremmo condividere dati solo con: (a) fornitori tecnici essenziali (hosting, backup, invio email transazionali) sotto adeguati contratti di trattamento; (b) autorità competenti se richiesto dalla legge; (c) provider di pagamento (Stripe/PayPal) quando attiveremo i pagamenti online, limitatamente ai dati necessari per completare la transazione.`,
  },
  {
    title: "7. Trasferimenti internazionali",
    body:
      `I dati sono conservati in datacenter dell'Unione Europea quando possibile. Alcuni servizi cloud potrebbero comportare trasferimenti extra-UE (es. Stati Uniti) coperti da clausole contrattuali standard approvate dalla Commissione Europea.`,
  },
  {
    title: "8. I tuoi diritti (GDPR)",
    body:
      `In qualunque momento hai diritto a: accedere ai tuoi dati; rettificarli se sbagliati; cancellarli (diritto all'oblio); limitarne il trattamento; opporti al trattamento; portabilità dei dati; revocare i consensi prestati (marketing, notifiche, cookies non essenziali) direttamente dal tuo profilo. Puoi esercitare questi diritti scrivendo a ${CONTACT_EMAIL} e ti risponderemo entro 30 giorni. Hai inoltre il diritto di proporre reclamo al Garante per la Protezione dei Dati Personali (garanteprivacy.it).`,
  },
  {
    title: "9. Comunicazioni promozionali (marketing)",
    body:
      `Con il tuo consenso specifico, potremo utilizzare i tuoi dati per inviarti comunicazioni relative a nuovi corsi, contenuti e iniziative della App "Libertà in Conoscenza". I tuoi dati rimangono esclusivamente all'interno della App e non saranno mai ceduti a terzi per finalità di marketing. Il consenso è facoltativo, mai pre-selezionato, e revocabile in qualsiasi momento dal profilo → Privacy. Le comunicazioni di servizio (benvenuto, conferme di acquisto, avviso scadenza abbonamento, assistenza tecnica, invio certificato) non richiedono un consenso separato.`,
  },
  {
    title: "10. Sicurezza",
    body:
      `Adottiamo misure tecniche e organizzative per proteggere i tuoi dati: password cifrate con bcrypt, connessioni HTTPS, autenticazione tramite token JWT firmati, accesso ai server limitato e loggato, backup periodici. Nessun sistema è sicuro al 100%: in caso di violazione ti avviseremo entro 72 ore come richiesto dall'art. 34 GDPR.`,
  },
  {
    title: "11. Cookie e tecnologie di tracciamento",
    body:
      `L'app usa esclusivamente cookie tecnici e utilizza il local storage del dispositivo per salvare le tue preferenze (lingua, aver visto l'onboarding, token di accesso cifrato). Per l'eventuale utilizzo di strumenti analitici o di profilazione ti chiederemo un consenso specifico tramite il banner cookie che appare al primo accesso. Per il dettaglio consulta la nostra Cookie Policy.`,
  },
  {
    title: "12. Minori",
    body:
      `L'app è pensata per un pubblico adulto. Per i minori di 14 anni è richiesto il consenso di chi esercita la responsabilità genitoriale. Non raccogliamo consapevolmente dati di minori senza tale consenso; qualora ci accorgessimo di aver raccolto dati di un minore senza autorizzazione, li elimineremo immediatamente.`,
  },
  {
    title: "13. Aggiornamenti a questa Privacy Policy",
    body:
      `Possiamo aggiornare questa policy per adeguarci a nuove norme o funzionalità. Ti informeremo tramite la home dell'app o via email. La data dell'ultimo aggiornamento è indicata in cima a questa pagina.`,
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
        <Text style={styles.lastUpdate}>Ultimo aggiornamento: 27 settembre 2026</Text>
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
