import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

const APP_NAME = "Libertà in Conoscenza";
const CONTACT_EMAIL = "info@scienzebiofisiche.it";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Chi siamo e cosa offriamo",
    body:
      `Libertà in Conoscenza è un'applicazione mobile dedicata alla crescita personale, spirituale e al Ben Essere, che raccoglie articoli, meditazioni audio e video su temi come biofisica quantistica, meditazione, naturopatia, medicina integrata, filosofia e discipline orientali. L'attività è di tipo formativo in ambito olistico ai sensi della Legge 4/2013. L'app è offerta gratuitamente per la fruizione dei contenuti base; alcuni contenuti avanzati e i corsi Premium sono riservati agli utenti abbonati o acquirenti.`,
  },
  {
    title: "2. Registrazione e uso dell'account",
    body:
      `Per usare l'app devi registrare un account fornendo un numero di telefono valido, una password e il tuo nome. Un numero di telefono può essere associato a un solo account. Sei responsabile della riservatezza della tua password e di ogni attività effettuata dal tuo account. Se sospetti un uso non autorizzato, avvisaci subito e cambia la password dal Profilo → Sicurezza → Cambia password.`,
  },
  {
    title: "3. Prova gratuita di 15 giorni",
    body:
      `Al momento della registrazione ottieni automaticamente 15 (quindici) giorni di accesso completo a tutti i contenuti Premium e a tutti i corsi Base. La prova gratuita non richiede pagamento né inserimento di dati di fatturazione e termina automaticamente alla scadenza. Nessun addebito viene effettuato al termine della prova; per continuare ad accedere ai contenuti avanzati potrai sottoscrivere l'abbonamento annuale.`,
  },
  {
    title: "4. Abbonamento annuale (12 €/anno)",
    body:
      `L'abbonamento annuale a Libertà in Conoscenza costa 12 € (dodici euro) all'anno e include: tutti gli articoli, tutti i video, tutte le meditazioni e tutti i corsi Base. I corsi Premium non sono inclusi e vanno acquistati separatamente. L'abbonamento si rinnova automaticamente alla scadenza per un altro anno al prezzo in vigore. Riceverai un'email di avviso almeno 30 giorni prima della scadenza, con indicazione della data di rinnovo, della data limite per la disdetta e delle modalità operative, in conformità alla Legge sulla Concorrenza 2022 (L. 177/2024, art. 20) e al Codice del Consumo. Potrai disdire in qualsiasi momento dal pulsante "Disdici/Esci" presente nel profilo (attivo da 1 settimana prima della scadenza): l'accesso resta garantito fino alla data di scadenza già pagata.`,
  },
  {
    title: "5. Corsi Premium (acquisto singolo)",
    body:
      `I corsi Premium sono acquistabili singolarmente e non sono inclusi nell'abbonamento annuale. Ogni corso ha un prezzo indicato nella scheda del corso; puoi applicare eventuali codici sconto prima del pagamento. L'acquisto ha durata illimitata: il corso resta accessibile nel tuo profilo senza scadenza.`,
  },
  {
    title: "6. Clausola d'esame e tentativi quiz",
    body:
      `Oggetto del contratto. Il presente contratto ha ad oggetto l'accesso al materiale didattico del corso e la possibilità di sostenere l'esame finale (quiz) entro il numero massimo di 3 (tre) tentativi. L'attestato viene rilasciato esclusivamente in caso di superamento dell'esame entro i predetti tentativi. L'oggetto del contratto non è, pertanto, l'acquisto dell'attestato.\n\nEsito dell'esame. Il mancato superamento dell'esame nei 3 (tre) tentativi previsti non costituisce inadempimento del fornitore, non configura un disservizio e non dà diritto ad alcun rimborso, parziale o totale, del corrispettivo versato.`,
  },
  {
    title: "7. Valore dell'attestato",
    body:
      `L'attestato rilasciato da Libertà in Conoscenza è un documento privato che certifica il superamento dell'esame finale del corso. Esso non ha il valore di una qualifica professionale regionale ai sensi della Legge 845/78, non costituisce titolo per l'ammissione ai pubblici concorsi e non attribuisce crediti formativi universitari (CFU). Eventuali riconoscimenti potranno essere previsti solo a seguito di specifici accordi con enti accreditati.`,
  },
  {
    title: "8. Recesso e servizi digitali",
    body:
      `Per l'abbonamento annuale e per l'acquisto dei corsi Premium, il pagamento è sottoposto a una checkbox obbligatoria di consenso al recesso (art. 59, comma 1, lett. o) del Codice del Consumo, D.Lgs. 206/2005). Confermando la checkbox e iniziando la fruizione dei contenuti (visualizzazione dei video, degli articoli o accesso ai materiali) l'Utente perde il diritto di recesso di 14 giorni. Senza tale consenso l'acquisto non è possibile. Il consenso viene registrato (data, ora, indirizzo IP, user agent, testo esatto della clausola) e conservato a fini probatori.`,
  },
  {
    title: "9. Codici sconto e referral",
    body:
      `Puoi applicare codici sconto durante la richiesta di abbonamento o l'acquisto di un corso Premium. Ogni codice ha un ambito di applicazione (abbonamento, corso specifico, o generico) e un numero massimo di utilizzi. Puoi invitare altri utenti tramite il tuo codice referral personale: per ogni amico che si iscrive col tuo codice ricevi un mese di Premium in regalo, secondo le regole in vigore al momento dell'invito.`,
  },
  {
    title: "10. Uso corretto del servizio",
    body:
      `Ti impegni a usare l'app in modo corretto, rispettando gli altri utenti nei commenti e nelle interazioni. Sono vietati: linguaggio offensivo, spam, contenuti illegali o lesivi di diritti altrui, e ogni utilizzo del servizio che possa ledere altre persone. Ci riserviamo il diritto di rimuovere contenuti inappropriati e sospendere account che violano queste regole a insindacabile giudizio dell'amministratore.`,
  },
  {
    title: "11. Proprietà intellettuale",
    body:
      `Tutti i contenuti presenti nell'app (articoli, meditazioni, video, immagini, marchio, grafica) sono proprietà di Libertà in Conoscenza o dei rispettivi autori e sono protetti dalle leggi sul diritto d'autore. È vietato copiare, ridistribuire, rivendere o pubblicare i contenuti al di fuori dell'app senza autorizzazione scritta. È consentito condividere singoli articoli tramite le funzioni di condivisione integrate.`,
  },
  {
    title: "12. Contenuti a scopo informativo",
    body:
      `I contenuti dell'app hanno finalità informative, culturali e di crescita personale. NON sono consigli medici, psicologici, terapeutici o farmaceutici e non sostituiscono in alcun modo il parere di un medico o di un professionista qualificato. Per ogni dettaglio consulta il nostro Disclaimer.`,
  },
  {
    title: "13. Limitazione di responsabilità",
    body:
      `L'app è fornita "così com'è". Facciamo il massimo per garantire disponibilità e correttezza dei contenuti, ma non possiamo garantire un funzionamento ininterrotto o l'assenza di errori. Non siamo responsabili per eventuali interruzioni del servizio, perdita di dati o danni indiretti derivanti dall'uso dell'app.`,
  },
  {
    title: "14. Assistenza tecnica",
    body:
      `Per problemi tecnici puoi contattarci dal profilo → Assistenza, compilando il modulo di richiesta con la descrizione del problema. Riceverai un numero di ticket via email e la risposta ti arriverà entro pochi giorni lavorativi via email e nel tuo profilo.`,
  },
  {
    title: "15. Modifiche ai termini",
    body:
      `Possiamo modificare questi termini per aggiornarli alle esigenze del servizio o alle norme di legge. Ti informeremo delle modifiche significative tramite la home dell'app o via email. L'uso continuato dell'app dopo la modifica vale come accettazione dei nuovi termini.`,
  },
  {
    title: "16. Contatti e legge applicabile",
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
        <Text style={styles.lastUpdate}>Ultimo aggiornamento: 27 settembre 2026</Text>
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
