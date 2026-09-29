/**
 * ShareButton — Cross-platform "Condividi" affordance.
 *
 * Behavior:
 *  - iOS/Android native: opens the OS share sheet via react-native Share API.
 *  - Web with Web Share API (Chrome/Safari mobile): uses `navigator.share`.
 *  - Web without Web Share: falls back to a small popup with WhatsApp,
 *    Telegram, Facebook, Email direct links and a "Copy" button.
 *
 * Shared URL: `/api/share/{type}/{id}` — this hits the backend which serves an
 * HTML page with Open Graph meta tags. Social crawlers (WhatsApp, Facebook,
 * Telegram, iMessage) can read those tags to display a rich preview card.
 * Human visitors are auto-redirected to the real app page after 150ms.
 */
import React, { useState } from "react";
import { Share, Platform, Pressable, Text, View, StyleSheet, Modal, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors, spacing, radius } from "@/src/theme";

type ContentType = "meditation" | "course" | "article";

type Props = {
  contentType: ContentType;
  contentId: string;
  title: string;
  size?: "sm" | "md";
};

function backendBase(): string {
  const url = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_BACKEND_URL || "";
  if (url) return url.replace(/\/+$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "";
}

function buildShareUrl(contentType: ContentType, contentId: string): string {
  return `${backendBase()}/api/share/${contentType}/${contentId}`;
}

async function tryWebShare(title: string, url: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !(navigator as any).share) return false;
  try {
    await (navigator as any).share({ title, text: title, url });
    return true;
  } catch {
    return false;
  }
}

export default function ShareButton({ contentType, contentId, title, size = "md" }: Props) {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const onPress = async () => {
    const url = buildShareUrl(contentType, contentId);
    const message = `${title}\n\n${url}`;

    if (Platform.OS === "web") {
      if (await tryWebShare(title, url)) return;
      setFallbackOpen(true);
      return;
    }
    try {
      await Share.share({ message, url, title });
    } catch {
      // ignore user-dismissed
    }
  };

  const url = buildShareUrl(contentType, contentId);
  const encoded = encodeURIComponent(`${title} — ${url}`);

  const doCopy = async () => {
    try {
      await Clipboard.setStringAsync(url);
    } catch {
      if (typeof navigator !== "undefined" && (navigator as any).clipboard) {
        try {
          await (navigator as any).clipboard.writeText(url);
        } catch {}
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const openExternal = async (target: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(target, "_blank", "noopener,noreferrer");
    } else {
      await Linking.openURL(target);
    }
  };

  const dim = size === "sm" ? 32 : 40;

  return (
    <>
      <Pressable
        onPress={onPress}
        style={[s.iconBtn, { width: dim, height: dim, borderRadius: dim / 2 }]}
        hitSlop={8}
        accessibilityLabel="Condividi"
        accessibilityRole="button"
      >
        <Text style={[s.iconTxt, size === "sm" && { fontSize: 15 }]}>↗</Text>
      </Pressable>

      {/* Web fallback modal */}
      <Modal
        visible={fallbackOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFallbackOpen(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setFallbackOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.sheetTitle}>Condividi questo contenuto</Text>
            <Text style={s.sheetSub} numberOfLines={2}>{title}</Text>

            <View style={s.grid}>
              <Pressable
                style={s.tile}
                onPress={() => openExternal(`https://wa.me/?text=${encoded}`)}
              >
                <Text style={s.tileIcon}>💬</Text>
                <Text style={s.tileTxt}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={s.tile}
                onPress={() => openExternal(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`)}
              >
                <Text style={s.tileIcon}>✈️</Text>
                <Text style={s.tileTxt}>Telegram</Text>
              </Pressable>
              <Pressable
                style={s.tile}
                onPress={() => openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}
              >
                <Text style={s.tileIcon}>🌐</Text>
                <Text style={s.tileTxt}>Facebook</Text>
              </Pressable>
              <Pressable
                style={s.tile}
                onPress={() => openExternal(`https://twitter.com/intent/tweet?text=${encoded}`)}
              >
                <Text style={s.tileIcon}>🐦</Text>
                <Text style={s.tileTxt}>X / Twitter</Text>
              </Pressable>
              <Pressable
                style={s.tile}
                onPress={() => openExternal(`mailto:?subject=${encodeURIComponent(title)}&body=${encoded}`)}
              >
                <Text style={s.tileIcon}>✉️</Text>
                <Text style={s.tileTxt}>Email</Text>
              </Pressable>
              <Pressable style={s.tile} onPress={doCopy}>
                <Text style={s.tileIcon}>{copied ? "✅" : "🔗"}</Text>
                <Text style={s.tileTxt}>{copied ? "Copiato!" : "Copia link"}</Text>
              </Pressable>
            </View>

            <Pressable style={s.closeBtn} onPress={() => setFallbackOpen(false)}>
              <Text style={s.closeTxt}>Chiudi</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  iconBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconTxt: {
    color: colors.brandPrimary,
    fontSize: 18,
    fontWeight: "700",
    transform: [{ rotate: "-45deg" }],
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.brandPrimary,
  },
  sheetTitle: {
    color: colors.brandPrimary,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  sheetSub: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    textAlign: "center",
    marginBottom: spacing.lg,
    fontStyle: "italic",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: spacing.md,
  },
  tile: {
    width: "30%",
    minWidth: 92,
    paddingVertical: spacing.md,
    marginVertical: 6,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileIcon: { fontSize: 24, marginBottom: 6 },
  tileTxt: {
    color: colors.onSurface,
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
  },
  closeTxt: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
  },
});
