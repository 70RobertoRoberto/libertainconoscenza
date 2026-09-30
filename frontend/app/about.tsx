import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { Muted, Card } from "@/src/ui";
import { LOGO_URL } from "@/src/assets";

const TELEGRAM_URL = "https://t.me/conoscenza_aperta";

const ABOUT_INTRO = `Libertà in Conoscenza è un'App di informazione e formazione che riunisce varie discipline in un unico spazio. Nasce con uno scopo preciso: darti conoscenza che ti rende autonomo e indipendente, in virtù del percorso che scegli di fare.

È uno strumento ideale che ti consente di esplorare e scegliere con consapevolezza anche il tuo percorso personale. All'interno puoi, così, seguire la tua ispirazione e riportare in te conoscenza, in valore di crescita e di riconoscimento.`;

const DISCIPLINE_LIST = [
  "Fisica e Biofisica quantistica",
  "Naturopatia",
  "Psicologia",
  "Coscienza",
  "Neuroscienze",
  "Cardioscienze",
  "Medicina Integrata e Complementare",
  "Filosofia",
  "Crescita Personale e Spirituale",
  "Discipline Bio Naturali",
  "Arti Orientali",
  "Esoterismo",
  "Nutrizione",
  "Meditazione",
  "Pratiche Energetiche",
];

const ACCESSO_APP = [
  {
    name: "Prova gratuita",
    desc: "Aperta a tutti per iniziare a esplorare e conoscere. Senza spesa per 15 giorni con accesso a 5 corsi base da te scelti in preferenza, 10 meditazioni da te selezionate e tutti gli articoli e i video informativi.",
  },
  {
    name: "Abbonato",
    desc: "Per chi sceglie di aderire a tutti i contenuti base con un piccolo contributo di 12 euro annui (1 euro al mese). Con tale scelta è possibile usufruire di tutti i corsi a livello base e di tutte le meditazioni presenti, compresi tutti i video e articoli informativi.",
  },
];

const COSA_TROVI_INTRO = `L'App organizza i contenuti in tre forme, per accompagnarti in modo completo dalla comprensione, alla pratica e alla formazione strutturata.`;

const COSA_TROVI_SEZIONI = [
  {
    icon: "📄",
    title: "Biblioteca",
    desc: "Contenuti scritti per informarti, aggiornarti e aprire la mente. Approfondimenti su tutte le discipline, dal livello divulgativo a quello specialistico. Tutto diviso in categorie ampie e specifiche.",
  },
  {
    icon: "🧘",
    title: "Media",
    desc: "• Meditazioni: proposte per centrarti, ritrovare chiarezza e coltivare la tua evoluzione personale. Non solo rilassamento ma anche uno strumento di presenza e consapevolezza.\n• Video: presentazioni di tematiche e discipline spiegate in modo dettagliato e specifico.",
  },
  {
    icon: "🎓",
    title: "Corsi",
    desc: "Corsi e percorsi formativi strutturati, con vari moduli differenziati, per formarti in virtù del tuo reale interesse, con possibilità di scelta differenziata e di approfondimento con metodo e continuità, non solo per curiosare, ma anche per padroneggiare.",
  },
];

const LIVELLI_CORSI_INTRO = `L'App prevede due livelli per i corsi, pensati per accompagnarti in ogni fase del tuo percorso, che sono due gradi di interesse differenziati in approfondimento.`;

const LIVELLI_CORSI = [
  {
    name: "Livello Base — aperto a tutti",
    desc: "È la porta d'ingresso, libera e accessibile per usufruire di ogni corso istruito in forma più aperta e anche convenevole in ideale di tutti. Tutto per iniziare a esplorare, conoscere e costruire basi solide.",
  },
  {
    name: "Livello Premium — approfondimento qualificato",
    desc: "È lo spazio per chi vuole andare oltre, riscoprendo il valore dell'approfondimento di alcuni contenuti più specializzanti in un catalogo di corsi e percorsi avanzati, per chi desidera trasformare la conoscenza in valore integrato ed elevato.",
  },
];

const LIVELLI_CORSI_QUOTE = `Il Base non è un livello inferiore: è la libertà di iniziare.
Il Premium non è un livello superiore della persona: è la libertà di approfondire.
La libertà resta di tutti.`;

const GUIDA_INTRO = `Guida all'uso veloce dell'App per l'abbonato`;

const GUIDA_STEPS = [
  {
    title: "Scegli la tua area",
    desc: "Esplora per disciplina, per tema o per tipo di contenuto: articoli, meditazioni, video, corsi.",
  },
  {
    title: "Segui il tuo ritmo",
    desc: "Non ci sono percorsi obbligati. Puoi leggere, meditare, studiare — quando vuoi, quanto vuoi.",
  },
  {
    title: "Costruisci il tuo percorso",
    desc: "Scegli i contenuti che ti interessano, riprendi da dove avevi lasciato, continua liberamente il tuo cammino personale di crescita. Nel tuo profilo personale troverai le tue scelte e i tuoi contenuti.",
  },
  {
    title: "Accedi a ciò che è di tuo interesse",
    desc: "Inizi libero nel percorso base per poi proseguire nella scelta ideale che preferisci.",
  },
  {
    title: "Come accedere al Servizio Premium",
    desc: "Clicca sul corso che vuoi utilizzare e compila il form con i dati richiesti e procedi all'acquisto. Sarai attivato subito e riceverai una mail riepilogativa del servizio scelto che sarà disponibile per tutta la durata del tuo abbonamento.",
  },
  {
    title: "Durata e scadenza",
    desc: "L'abbonamento è annuale ed è rinnovato automaticamente. Sarai avvisato da una settimana prima e il giorno prima del rinnovo. Se vuoi procedere alla disdetta accedi al tuo profilo e disdici quando vuoi. Dopo aver disdetto, il tuo profilo con tutti i tuoi dati sarà attivo per altri sei mesi, in cui puoi ancora riattivarlo e recuperare il tuo conseguito, semplicemente rinnovando l'abbonamento. Dopo sei mesi dovrai ripartire con un nuovo profilo.",
  },
  {
    title: "Approfondimenti",
    desc: "Ulteriori approfondimenti sono disponibili nel tuo profilo personale in termini di servizio, privacy policy, cookie policy, disclaimer.",
  },
];

export default function About() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const openTelegram = async () => {
    try { await Linking.openURL(TELEGRAM_URL); } catch {}
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xxxl,
      }}
    >
      <View style={styles.header}>
        <Pressable testID="back-about" onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Chi Siamo</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.heroWrap}>
        <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>CONOSCENZA APERTA</Text>
        <Muted style={styles.tagline}>Sapienza per crescere</Muted>
      </View>

      <View style={styles.bannerWrap}>
        <Pressable testID="open-telegram-banner" onPress={openTelegram} style={styles.bannerPress}>
          <Image
            source={{ uri: `${process.env.EXPO_PUBLIC_BACKEND_URL || ""}/api/files/about/banner-telegram-49ac997f.jpg` }}
            style={styles.bannerImg}
            resizeMode="cover"
            accessibilityLabel="Conoscenza Aperta - Canale Telegram"
          />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.body}>{ABOUT_INTRO}</Text>

        {/* Discipline presenti */}
        <Text style={styles.sectionTitle}>DISCIPLINE PRESENTI</Text>
        <View style={styles.chipsWrap}>
          {DISCIPLINE_LIST.map((d, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipTxt}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Due livelli di accesso all'App */}
        <Text style={styles.sectionTitle}>DUE LIVELLI DI ACCESSO ALL&apos;APP</Text>
        {ACCESSO_APP.map((it, i) => (
          <View key={i} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemBullet}>◆</Text>
              <Text style={styles.itemName}>{it.name}</Text>
            </View>
            <Text style={styles.itemDesc}>{it.desc}</Text>
          </View>
        ))}

        {/* Cosa trovi dentro */}
        <Text style={styles.sectionTitle}>COSA TROVI DENTRO</Text>
        <Text style={styles.body}>{COSA_TROVI_INTRO}</Text>
        {COSA_TROVI_SEZIONI.map((s, i) => (
          <View key={i} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemIcon}>{s.icon}</Text>
              <Text style={styles.itemName}>{s.title}</Text>
            </View>
            <Text style={styles.itemDesc}>{s.desc}</Text>
          </View>
        ))}

        {/* Come funziona: due livelli di accesso ai corsi */}
        <Text style={styles.sectionTitle}>COME FUNZIONA — DUE LIVELLI DI ACCESSO</Text>
        <Text style={styles.body}>{LIVELLI_CORSI_INTRO}</Text>
        {LIVELLI_CORSI.map((l, i) => (
          <View key={i} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemBullet}>◆</Text>
              <Text style={styles.itemName}>{l.name}</Text>
            </View>
            <Text style={styles.itemDesc}>{l.desc}</Text>
          </View>
        ))}

        <View style={styles.quoteBox}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quoteText}>{LIVELLI_CORSI_QUOTE}</Text>
          <Text style={[styles.quoteMark, styles.quoteMarkClose]}>”</Text>
        </View>

        {/* Guida all'uso veloce */}
        <Text style={styles.sectionTitle}>{GUIDA_INTRO.toUpperCase()}</Text>
        {GUIDA_STEPS.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNumberWrap}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepDesc}>{s.desc}</Text>
            </View>
          </View>
        ))}

        <Card style={styles.tgCard}>
          <Text style={styles.tgTitle}>📡  Unisciti al canale Telegram</Text>
          <Muted style={{ marginTop: 4, marginBottom: spacing.md }}>
            Contenuti esclusivi, eventi e aggiornamenti dal progetto Libertà in Conoscenza.
          </Muted>
          <Pressable testID="open-telegram" onPress={openTelegram} style={styles.tgBtn}>
            <Text style={styles.tgBtnTxt}>Apri Telegram · @conoscenza_aperta</Text>
          </Pressable>
        </Card>

        <Text style={styles.thanks}>GRAZIE</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "700" },
  heroWrap: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  logo: { width: 92, height: 92 },
  brand: {
    color: colors.brandPrimary,
    letterSpacing: 5,
    fontSize: 13,
    fontWeight: "800",
    marginTop: spacing.md,
  },
  tagline: { fontStyle: "italic", marginTop: 4 },
  bannerWrap: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  bannerPress: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    // Elegant subtle glow
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerImg: {
    width: "100%",
    aspectRatio: 3 / 2,   // matches the source banner ratio (approx.)
    backgroundColor: colors.surfaceSecondary,
  },
  body: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginTop: spacing.md,
    fontFamily: "Georgia",
  },
  sectionTitle: {
    color: colors.brandPrimary,
    letterSpacing: 3,
    fontSize: 13,
    fontWeight: "800",
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  quoteBox: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandPrimary,
    backgroundColor: colors.surfaceSecondary,
  },
  quoteMark: {
    color: colors.brandPrimary,
    fontSize: 40,
    lineHeight: 40,
    fontFamily: "Georgia",
    height: 30,
  },
  quoteMarkClose: {
    textAlign: "right",
    marginTop: -10,
  },
  quoteText: {
    color: colors.onSurface,
    fontSize: 15,
    lineHeight: 25,
    fontStyle: "italic",
    fontFamily: "Georgia",
    marginTop: -6,
  },
  listRow: { flexDirection: "row", alignItems: "flex-start", marginVertical: 5 },
  bullet: { color: colors.brandPrimary, marginRight: spacing.sm, fontSize: 12, marginTop: 4 },
  listItem: { flex: 1, color: colors.onSurface, fontSize: 14, lineHeight: 22, fontFamily: "Georgia" },

  // Chip layout for "Discipline presenti"
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipTxt: {
    color: colors.onSurface,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // Card items with name + description
  itemCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceSecondary,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  itemBullet: {
    color: colors.brandPrimary,
    fontSize: 14,
    marginRight: spacing.sm,
  },
  itemIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  itemName: {
    color: colors.brandPrimary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
    flex: 1,
  },
  itemDesc: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Georgia",
  },

  // Numbered guide steps
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.lg,
  },
  stepNumberWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    marginTop: 2,
  },
  stepNumber: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "800",
  },
  stepTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  stepDesc: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Georgia",
  },

  tgCard: {
    marginTop: spacing.xxl,
    borderColor: colors.brandPrimary,
    borderWidth: 1,
  },
  tgTitle: { color: colors.brandPrimary, fontSize: 16, fontWeight: "800" },
  tgBtn: {
    backgroundColor: "#229ED9",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  tgBtnTxt: { color: "#FFFFFF", fontWeight: "800", letterSpacing: 0.3 },
  thanks: {
    color: colors.brandPrimary,
    letterSpacing: 8,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginTop: spacing.xxxl,
    marginBottom: spacing.xl,
  },
});
