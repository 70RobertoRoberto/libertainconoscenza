import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { Muted, Card } from "@/src/ui";
import { LOGO_URL } from "@/src/assets";

const TELEGRAM_URL = "https://t.me/conoscenza_aperta";

const ABOUT_INTRO = `Il progetto di Conoscenza Aperta è il nuovo Inizio in cui le nostre valorose conoscenze sono riposte in valenza di chi vuole aderire a un progetto di grande cambiamento in attivo, sia in virtù migliorativa della propria vita in ritrovo qualificato di Ben Essere e sia in qualità autentica di Conoscenza riposta in grande valore di apporto per Tutti.

Il nostro obiettivo è perciò nobile e ideale, in ambito di valori da conseguire e apporre con considerazione unificata, ossia tutte le valenze di conoscenza sono qua ben amate, se portate con valore conseguito e condiviso e perciò in supporto di tutti per amore di anima e di anime e di virtù in vita da consigliare sempre per tutti quelli che vogliono trovare giovamento nel cambiamento in conoscenza di se stessi e in supporto per altri.

La Conoscenza è pertanto Aperta in simbiosi di valore per tutti da conseguire in ogni forma che porta la qualifica in vita di un miglioramento da consolidare in nuove conoscenze e, pertanto, in grandi apporti di sviluppi in conoscenze di vario tipo, da riporre sempre in qualifica di grandi opportunità aggiuntive che tutti possono conseguire in forma gratuita, in quanto il nostro ideale è aggiornare sempre in considerazione di un progetto di amore di vita che è anche di ogni vita, in grande rilievo di valore da conseguite in Terra.

La Conoscenza Aperta diviene così una grande opportunità per tutti per elevare le proprie coscienze ed essere in amore di verità libera e fruibile in alto livello di valori e anche strumento per il Ben Essere di ogni persona in una forma unificatoria in ogni livello di analisi.`;

const ABOUT_QUOTE = `La Conoscenza Aperta è il ponte tra ciò che sei e ciò che puoi diventare.
Non ti dice cosa pensare, ti insegna come ascoltare.
Non ti promette la guarigione, ti offre gli strumenti per ritrovare la tua armonia, perché il Ben Essere non è una meta, ma un viaggio e in questo viaggio, ogni sapere è un gradino, ogni esperienza è una lezione, ogni incontro è un dono e ogni conoscenza è una virtù acquisita.
Tutto questo può essere vissuto assieme, in supporto e Amore, perché è il viaggio della Vita che riguarda in Vita tutti in sintonia di Ben Essere!`;

const ABOUT_IDEATORI = `Siamo un gruppo di Anime in ricerca di verità che si occupano da decenni di Conoscenza in differenti ambiti e che collaborano alla diffusione delle proprie conoscenze spesso, anche attraverso Convegni Nazionali o incontri dibattiti che proponiamo a tutti in vari parti di Italia, in condivisione di Centri che si aprono al nostro approccio di Conoscenza che è finalizzato al recupero del valore in vita della vita e pertanto del Ben Essere in verità di esperienza, da recuperare per Tutti in sintonia e in Conoscenza attiva e possibile in armonia di intenti.`;

const ABOUT_CREDO = `Crediamo che il Ben Essere non sia un privilegio, ma un diritto di ogni essere umano e crediamo che la strada per raggiungerlo passi attraverso la Conoscenza Aperta: un sapere che non si chiude in steccati disciplinari ma che abbraccia la complessità della vita in risorse da conseguire in scambio di anima e di anime in valori autentici e qualificati di conoscenza.

Qui non troverai dogmi né ricette magiche. Troverai strumenti, prospettive, storie, ricerche e pratiche che ti aiuteranno a:`;

const ABOUT_LIST = [
  "Comprendere il tuo corpo come un sistema vivo e informato.",
  "Ascoltare la tua mente come una voce che merita attenzione.",
  "Riconoscere il tuo spirito come una presenza che ti guida.",
  "Costruire relazioni che nutrono e sostengono.",
  "Vivere la vita in sacralità realizzativa.",
  "Conoscere l'armonia del Sacro in virtù di Anima.",
  "Conseguire saperi elevativi in Ben Essere.",
  "Essere partecipe della tua esistenza in vita in grande modello esemplare di realizzo in correttezza e in virtù acquisite e conosciute.",
  "Amare la vita in amabilità conseguita e riposta in alto.",
];

const ABOUT_CLOSING = `Conoscere e amare è il dono di Anima e pertanto è Anima in dono per voi Tutti in Ben Essere in sintonia dell'Essere in Benevolenza acquisita e riuscita in espressione in Vita.

La Conoscenza Aperta è il nostro dono e il Ben-Essere è il tuo conseguito.

L'App ha anche un suo corrisposto in Telegram con il nome Conoscenza Aperta e con contenuti prevalentemente tutti differenti ed è conseguibile per tutti in approdo di articoli. È consigliato il vostro contributo in adesione nel nostro canale di divulgazione Telegram: in questo modo sarete sempre aggiornati su tutti gli eventi e le innovazioni in contributi vari e in differenti modalità.`;

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

        <View style={styles.quoteBox}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quoteText}>{ABOUT_QUOTE}</Text>
          <Text style={[styles.quoteMark, styles.quoteMarkClose]}>”</Text>
        </View>

        <Text style={styles.sectionTitle}>IDEATORI</Text>
        <Text style={styles.body}>{ABOUT_IDEATORI}</Text>

        <View style={styles.quoteBox}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quoteText}>{ABOUT_CREDO}</Text>
          <View style={{ height: spacing.md }} />
          {ABOUT_LIST.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={styles.bullet}>◆</Text>
              <Text style={styles.listItem}>{item}</Text>
            </View>
          ))}
          <Text style={[styles.quoteMark, styles.quoteMarkClose]}>”</Text>
        </View>

        <Text style={styles.body}>{ABOUT_CLOSING}</Text>

        <Card style={styles.tgCard}>
          <Text style={styles.tgTitle}>📡  Unisciti al canale Telegram</Text>
          <Muted style={{ marginTop: 4, marginBottom: spacing.md }}>
            Contenuti esclusivi, eventi e aggiornamenti dal progetto Conoscenza Aperta.
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
