import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

const CONTACT_EMAIL = "info@scienzebiofisiche.it";

/**
 * Disclaimer page. Text provided by the client (Direzione Conoscenza Aperta).
 * Split into logical paragraphs for readability while preserving the exact
 * wording supplied.
 */
const PARAGRAPHS: string[] = [
  `Le informazioni contenute in questa App, pur fornite in buona fede e ritenute accurate, potrebbero contenere inesattezze o essere viziate da errori tipografici. Gli Autori si riservano pertanto il diritto di modificare, aggiornare o cancellare i contenuti dell'App, video e meditazioni senza preavviso.`,
  `Le attività svolte in questo portale sono di tipo formativo in ambito olistico in base alla Legge 4/2013. Pertanto le informazioni, tecniche e gli strumenti acquisiti nei vari corsi, le meditazioni e i video non intendono essere sostitutivi dell'attività medica.`,
  `Qui non si fanno diagnosi né si prescrive iter terapeutici, si svolge attività informativa e formativa in ambito professionale legata al Benessere della persona utilizzando un'ampia gamma di metodologie con l'intento di preservare, educare e coltivare il benessere, aiutando la persona a raggiungere uno stato di profondo cambiamento Psico-Fisico e Spirituale, attraverso modificazioni positive dello stile di vita.`,
  `Gli Autori non si assumono nessuna responsabilità per eventuali danni di qualsiasi natura che l'utilizzatore di tali informazioni può causare a se stesso o a terzi, derivanti dall'uso improprio o illecito delle informazioni riportate o da errori e imprecisioni relativi al loro contenuto o da libere interpretazioni, o da qualsiasi azione che possiate intraprendere autonomamente.`,
  `Come sempre buonsenso, professionalità e responsabilità sono alla base di una buona e corretta interazione con le persone.`,
  `Questa App quindi, non fornisce consigli medici, non fornisce prescrizioni di alcun tipo e il suo compito è quello di far conoscere tecniche e pratiche per il miglioramento del benessere psico-fisico-spirituale.`,
  `Gli Autori non si assumono nessuna responsabilità per eventuali danni di qualsiasi natura che potreste causare a Voi stessi o a terzi, derivanti dall'uso improprio o illecito delle informazioni riportate o da errori e imprecisioni relativi al loro contenuto o da libere interpretazioni, o da qualsiasi azione che possiate intraprendere autonomamente.`,
  `Gli Autori dell'App di Conoscenza Aperta non sono responsabili per quanto pubblicato dai lettori nei commenti ad ogni post. Verranno cancellati i commenti ritenuti offensivi o lesivi dell'immagine o dell'onorabilità di terzi, di genere spam, razzisti o che contengano dati personali non conformi al rispetto delle norme sulla Privacy e, in ogni caso, ritenuti inadatti ad insindacabile giudizio dell'amministratore dell'App stessa.`,
  `Alcuni testi o immagini inserite in questa App possono essere tratte da internet (raramente) e, pertanto, considerate di pubblico dominio; qualora la loro pubblicazione violasse eventuali diritti d'autore, vogliate comunicarlo via e-mail a: ${CONTACT_EMAIL} e saranno immediatamente rimossi.`,
];

export default function Disclaimer() {
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
        <Pressable testID="back-disclaimer" onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={{ color: colors.onSurface, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Disclaimer</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.intro}>
          Prima di utilizzare i contenuti dell&apos;App leggi con attenzione le seguenti informazioni.
        </Text>

        {PARAGRAPHS.map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <View style={styles.signatureBox}>
          <Text style={styles.signatureTxt}>Grazie</Text>
          <Text style={styles.signatureTxt}>Direzione Conoscenza Aperta</Text>
        </View>

        <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
          <Text style={styles.contact}>📧  {CONTACT_EMAIL}</Text>
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
  intro: {
    color: colors.onSurfaceSecondary,
    fontSize: 15, lineHeight: 24, marginTop: spacing.md,
    fontFamily: "Georgia",
    fontStyle: "italic",
  },
  paragraph: {
    color: colors.onSurfaceSecondary,
    fontSize: 14, lineHeight: 22,
    marginTop: spacing.lg,
    fontFamily: "Georgia",
  },
  signatureBox: {
    marginTop: spacing.xxxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.brandPrimary,
    alignItems: "center",
  },
  signatureTxt: {
    color: colors.brandPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  contact: {
    color: colors.brandPrimary, fontWeight: "700",
    textAlign: "center", marginTop: spacing.xl, fontSize: 13,
  },
});
