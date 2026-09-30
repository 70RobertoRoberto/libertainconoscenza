import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import FabMenu from "@/src/FabMenu";

type SessionStatus = {
  session_id: string;
  status?: string | null;
  payment_status?: string | null;
  paid: boolean;
  kind?: "subscription" | "course" | null;
  order_id?: string | null;
  course_order_id?: string | null;
};

export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams<{ session_id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<"loading" | "success" | "pending" | "error">("loading");
  const [data, setData] = useState<SessionStatus | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    const sid = params.session_id;
    if (!sid) {
      setState("error");
      setErrMsg("Sessione di pagamento non trovata.");
      return;
    }
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const r = await api<SessionStatus>(`/payments/stripe/session/${encodeURIComponent(sid)}`);
        if (cancelled) return;
        setData(r);
        if (r.paid) {
          setState("success");
          return;
        }
        if (attempts < 6) {
          setTimeout(poll, 1500);
        } else {
          setState("pending");
        }
      } catch (e: any) {
        if (cancelled) return;
        setErrMsg(e?.message || "Errore verifica pagamento");
        setState("error");
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [params.session_id]);

  const goHome = () => router.replace("/" as any);
  const goProfile = () => router.replace("/profile" as any);
  const goCourses = () => router.replace("/courses" as any);

  if (state === "loading") {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
        <Text style={s.subtle}>Stiamo verificando il tuo pagamento…</Text>
      </View>
    );
  }

  if (state === "error") {
    return (
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top }]}>
        <Text style={s.emoji}>⚠️</Text>
        <Text style={s.title}>Non siamo riusciti a verificare il pagamento</Text>
        <Text style={s.subtle}>{errMsg}</Text>
        <Text style={s.smallHint}>
          Se hai completato il pagamento su Stripe, l&apos;abbonamento si attiverà entro pochi minuti.
        </Text>
        <Pressable onPress={goHome} style={s.btn}>
          <Text style={s.btnTxt}>Torna alla home</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (state === "pending") {
    return (
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top }]}>
        <Text style={s.emoji}>⏳</Text>
        <Text style={s.title}>Pagamento in elaborazione</Text>
        <Text style={s.subtle}>
          Stripe sta ancora confermando il tuo pagamento. L&apos;abbonamento si attiverà automaticamente entro pochi minuti.
        </Text>
        <Pressable onPress={goProfile} style={s.btn}>
          <Text style={s.btnTxt}>Vai al mio profilo</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // success
  const isCourse = data?.kind === "course";
  return (
    <>
    <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top }]}>
      <Text style={s.emoji}>🎉</Text>
      <Text style={s.title}>
        {isCourse ? "Corso acquistato con successo!" : "Benvenuto in Libertà in Conoscenza"}
      </Text>
      <Text style={s.subtle}>
        {isCourse
          ? "Il corso è ora disponibile nella tua area personale. Buon cammino!"
          : "Il tuo abbonamento annuale è attivo. Accedi a tutti i corsi, meditazioni e alla biblioteca completa."}
      </Text>
      <Pressable onPress={isCourse ? goCourses : goProfile} style={s.btn}>
        <Text style={s.btnTxt}>
          {isCourse ? "Vai ai miei corsi" : "Vai al mio profilo"}
        </Text>
      </Pressable>
      <Pressable onPress={goHome} style={[s.btn, s.btnGhost]}>
        <Text style={[s.btnTxt, s.btnGhostTxt]}>Torna alla home</Text>
      </Pressable>
      <Text style={s.smallHint}>Riceverai una ricevuta via email a breve.</Text>
    </ScrollView>
    <FabMenu />
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  emoji: { fontSize: 72, marginBottom: spacing.md },
  title: {
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtle: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  smallHint: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: spacing.md,
    textAlign: "center",
  },
  btn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radius.md,
    marginTop: spacing.md,
    minWidth: 240,
    alignItems: "center",
  },
  btnTxt: {
    color: colors.onBrandPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    marginTop: spacing.sm,
  },
  btnGhostTxt: {
    color: colors.brandPrimary,
  },
});
