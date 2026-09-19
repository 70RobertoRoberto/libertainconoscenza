import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { colors, spacing, radius } from "./theme";

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ url, onComplete }: { url: string; onComplete?: () => void }) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    return () => {
      try { player.pause(); } catch {}
    };
  }, [player]);

  useEffect(() => {
    if (!triggered && status?.duration && status.currentTime >= status.duration - 1 && status.duration > 5) {
      setTriggered(true);
      onComplete?.();
    }
  }, [status, triggered, onComplete]);

  const toggle = () => {
    if (status?.playing) player.pause();
    else player.play();
  };

  const seek = (delta: number) => {
    const to = Math.max(0, Math.min((status?.duration || 0), (status?.currentTime || 0) + delta));
    player.seekTo(to);
  };

  const progress = status?.duration ? (status.currentTime / status.duration) * 100 : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{fmt(status?.currentTime || 0)}</Text>
        <Text style={styles.time}>{fmt(status?.duration || 0)}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable testID="audio-back-15" onPress={() => seek(-15)} style={styles.btn}>
          <Text style={styles.btnTxt}>−15s</Text>
        </Pressable>
        <Pressable testID="audio-toggle" onPress={toggle} style={[styles.btn, styles.play]}>
          <Text style={styles.playTxt}>{status?.playing ? "❚❚" : "▶"}</Text>
        </Pressable>
        <Pressable testID="audio-fwd-15" onPress={() => seek(15)} style={styles.btn}>
          <Text style={styles.btnTxt}>+15s</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bar: {
    height: 4,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  fill: { height: 4, backgroundColor: colors.brandPrimary },
  times: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  time: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  controls: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.lg },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 60,
    alignItems: "center",
  },
  btnTxt: { color: colors.onSurface, fontWeight: "600" },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  playTxt: { color: colors.onBrandPrimary, fontSize: 22, fontWeight: "700" },
});
