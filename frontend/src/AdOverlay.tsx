// Ad overlay: shows a 5-second banner ad every 10 minutes of app usage.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, auth } from "./api";
import { colors, spacing, radius } from "./theme";

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const DISPLAY_MS = 5000; // 5 seconds

type Ad = { id: string; image_url: string; click_url?: string; caption?: string };

export function AdOverlay() {
  const insets = useSafeAreaInsets();
  const [ads, setAds] = useState<Ad[]>([]);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<Ad | null>(null);
  const idxRef = useRef(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await auth.hasToken())) return;
        const r = await api<{ items: Ad[] }>("/ads/active");
        if (!cancelled) setAds(r.items || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ads.length) return;
    const iv = setInterval(() => {
      const ad = ads[idxRef.current % ads.length];
      idxRef.current += 1;
      setCurrent(ad);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), DISPLAY_MS);
    }, INTERVAL_MS);
    return () => {
      clearInterval(iv);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ads]);

  if (!visible || !current) return null;

  const onPress = () => {
    if (current.click_url) Linking.openURL(current.click_url);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <Pressable testID="ad-banner" onPress={onPress} style={styles.banner}>
        <Image source={{ uri: current.image_url }} style={styles.img} />
        <View style={styles.textCol}>
          <Text style={styles.spon}>SPONSOR</Text>
          {current.caption ? (
            <Text style={styles.caption} numberOfLines={2}>{current.caption}</Text>
          ) : null}
        </View>
        <Pressable testID="ad-close" onPress={() => setVisible(false)} style={styles.close}>
          <Text style={{ color: colors.onSurface, fontSize: 14 }}>✕</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.md, right: spacing.md },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    padding: spacing.sm,
    gap: spacing.md,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
      default: {},
    }),
  },
  img: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  textCol: { flex: 1 },
  spon: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  caption: { color: colors.onSurface, fontSize: 13, marginTop: 2, fontWeight: "600" },
  close: { padding: spacing.sm },
});
