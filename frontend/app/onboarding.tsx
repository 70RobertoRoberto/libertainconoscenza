import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { LOGO_URL } from "@/src/assets";
import { storage } from "@/src/utils/storage";

/**
 * 3-slide onboarding for "Libertà in Conoscenza".
 * Palette: gradient blu notte (#0B1B3A) → oro tenue (#E8C87A).
 * Text: bianco / oro chiaro per titoli, bianco tenue per il corpo.
 * CTA: oro (#D4AF37) con testo blu notte.
 * The "has_seen_onboarding" flag is persisted so this screen is shown only on first launch.
 */

const NIGHT_BLUE = "#0B1B3A";
const NIGHT_BLUE_MID = "#122A55";
const GOLD_SOFT = "#E8C87A";
const GOLD = "#D4AF37";
const WHITE_SOFT = "rgba(255,255,255,0.90)";
const WHITE = "#FFFFFF";

const ONBOARDING_KEY = "has_seen_onboarding";

type Slide = {
  title: string;
  body: string[]; // paragraphs
  bullets?: string[];
  footer?: string;
  cta: string;
};

const SLIDES: Slide[] = [
  {
    title: "Benvenuto in\nLibertà in Conoscenza",
    body: [
      "Qui attiva la libertà in conoscenza in autonomia e preferenza.",
      "Sei libero di conoscere e di riporti in valore di te stesso.",
      "Puoi conoscere, informarti, formarti.",
      "Il valore è tuo e il tuo inizio è ora.",
    ],
    cta: "Avanti",
  },
  {
    title: "Tutto ciò che ti serve per crescere",
    body: ["Qua puoi trovare:"],
    bullets: [
      "Articoli per informarti.",
      "Meditazioni per star bene.",
      "Corsi per formarti.",
    ],
    footer:
      "Due livelli di accesso:\n\n• Base — aperto a tutti per iniziare, esplorare e costruire basi solide.\n• Premium — approfondimento qualificato per professionisti e per la tua evoluzione personale.\n\nLa libertà resta di tutti.",
    cta: "Avanti",
  },
  {
    title: "Indipendenza. Crescita.\nSuccesso. Libertà.",
    body: [
      "Conosci ciò che vuoi.",
      "Scegli con consapevolezza.",
      "Esprimiti in opportunità di scelta.",
      "Il tuo valore prende forma.",
      "Scegli il tuo ritmo. Esplora liberamente.",
      "Consegui la tua volontà in realizzo.",
    ],
    footer:
      "La libertà è il tuo metodo.\nLa conoscenza è il tuo campo.\nIl tuo valore è il risultato.",
    cta: "Entra in Libertà in Conoscenza",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = Dimensions.get("window");
  const scrollRef = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);

  const finish = async () => {
    try {
      await storage.setItem(ONBOARDING_KEY, true);
    } catch {}
    router.replace("/login");
  };

  const goNext = () => {
    if (idx < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (idx + 1) * W, animated: true });
      setIdx(idx + 1);
    } else {
      finish();
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / W);
    if (newIdx !== idx) setIdx(newIdx);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[NIGHT_BLUE, NIGHT_BLUE_MID, GOLD_SOFT]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject as any}
      />

      {/* Skip link (top-right) — hidden on last slide */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {idx < SLIDES.length - 1 ? (
          <Pressable
            testID="onboarding-skip"
            onPress={finish}
            hitSlop={12}
            style={styles.skipBtn}
          >
            <Text style={styles.skipTxt}>Salta</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width: W }]}>
            {/* Logo on first slide, small logo on others */}
            <View style={styles.logoWrap}>
              <Image
                source={{ uri: LOGO_URL }}
                style={i === 0 ? styles.logoLarge : styles.logoMedium}
                resizeMode="contain"
              />
            </View>

            <ScrollView
              style={{ flex: 1, width: "100%" }}
              contentContainerStyle={styles.slideContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title}>{s.title}</Text>

              <View style={styles.bodyBlock}>
                {s.body.map((p, k) => (
                  <Text key={k} style={styles.bodyTxt}>
                    {p}
                  </Text>
                ))}
              </View>

              {s.bullets ? (
                <View style={styles.bulletBlock}>
                  {s.bullets.map((b, k) => (
                    <View key={k} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>◆</Text>
                      <Text style={styles.bulletTxt}>{b}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {s.footer ? <Text style={styles.footer}>{s.footer}</Text> : null}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Bottom: dots + CTA */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === idx ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        <Pressable
          testID={`onboarding-cta-${idx}`}
          onPress={goNext}
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaTxt}>{SLIDES[idx].cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NIGHT_BLUE,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  skipTxt: {
    color: GOLD_SOFT,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 90,
    paddingBottom: 140,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 18,
  },
  logoLarge: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  logoMedium: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  slideContent: {
    paddingBottom: 40,
  },
  title: {
    color: WHITE,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: 0.3,
    marginBottom: 24,
    // gold-tinged shadow for elegance
    textShadowColor: "rgba(212,175,55,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  bodyBlock: {
    gap: 10,
    alignItems: "center",
  },
  bodyTxt: {
    color: WHITE_SOFT,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    fontFamily: "Georgia",
  },
  bulletBlock: {
    marginTop: 20,
    gap: 12,
    alignSelf: "stretch",
    paddingHorizontal: 12,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  bulletDot: {
    color: GOLD,
    fontSize: 14,
    marginTop: 4,
  },
  bulletTxt: {
    color: WHITE,
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
    fontWeight: "600",
  },
  footer: {
    color: WHITE_SOFT,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 22,
    fontFamily: "Georgia",
    fontStyle: "italic",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: GOLD,
    width: 24,
  },
  dotInactive: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  ctaBtn: {
    backgroundColor: GOLD,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 999,
    alignSelf: "stretch",
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaTxt: {
    color: NIGHT_BLUE,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
