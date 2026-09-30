/**
 * Floating navigation menu shown on detail/sub-pages that are outside the tab layout.
 *
 * Small circular gold button anchored bottom-right. Tapping it opens a compact
 * popover with quick shortcuts to the 6 main tabs (Home, Biblioteca, Media, Corsi,
 * Messaggi, Profilo). Solves the UX issue where users on a detail page can only
 * navigate back through the top-left arrow.
 */
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, Platform } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "@/src/theme";
import { useLang } from "@/src/i18n";

type Dest =
  | "/(tabs)"
  | "/(tabs)/library"
  | "/(tabs)/media"
  | "/(tabs)/corsi"
  | "/(tabs)/messages"
  | "/(tabs)/profile";

interface MenuItem {
  key: string;
  icon: string;
  labelKey: string;
  dest: Dest;
}

const MENU: MenuItem[] = [
  { key: "home", icon: "✦", labelKey: "tab_home", dest: "/(tabs)" },
  { key: "library", icon: "◈", labelKey: "tab_library", dest: "/(tabs)/library" },
  { key: "media", icon: "◉", labelKey: "tab_media", dest: "/(tabs)/media" },
  { key: "corsi", icon: "◇", labelKey: "tab_courses", dest: "/(tabs)/corsi" },
  { key: "messages", icon: "✉", labelKey: "tab_messages", dest: "/(tabs)/messages" },
  { key: "profile", icon: "◐", labelKey: "tab_profile", dest: "/(tabs)/profile" },
];

interface FabMenuProps {
  /**
   * Additional bottom offset (px). Use this when the underlying screen already
   * has a fixed footer (audio player, action buttons, quiz nav, etc.) to avoid
   * overlapping the FAB with the footer.
   */
  bottomOffset?: number;
}

export default function FabMenu({ bottomOffset = 0 }: FabMenuProps) {
  const router = useRouter();
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const go = (dest: Dest) => {
    setOpen(false);
    // Use replace so that history doesn't grow when the user hops between
    // detail pages via the FAB.
    // @ts-expect-error expo-router typed href
    router.replace(dest);
  };

  return (
    <>
      {/* Floating action button */}
      <Pressable
        testID="fab-menu-button"
        accessibilityLabel="Menu di navigazione"
        onPress={() => setOpen(true)}
        style={[styles.fab, { bottom: 24 + bottomOffset }]}
      >
        <Text style={styles.fabIcon}>≡</Text>
      </Pressable>

      {/* Popover overlay */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          testID="fab-menu-overlay"
          style={styles.overlay}
          onPress={() => setOpen(false)}
        >
          <View style={[styles.card, { bottom: 92 + bottomOffset }]}>
            <Text style={styles.cardTitle}>Vai a…</Text>
            {MENU.map((it) => (
              <Pressable
                key={it.key}
                testID={`fab-menu-item-${it.key}`}
                onPress={() => go(it.dest)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.surfaceTertiary },
                ]}
              >
                <Text style={styles.rowIcon}>{it.icon}</Text>
                <Text style={styles.rowLabel}>{t(it.labelKey)}</Text>
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
      default: { elevation: 8 },
    }),
    zIndex: 999,
  },
  fabIcon: {
    color: colors.surface,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 28,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  card: {
    position: "absolute",
    right: 20,
    left: 20,
    maxWidth: 360,
    alignSelf: "flex-end",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 12 },
      default: { elevation: 12 },
    }),
  },
  cardTitle: {
    color: colors.brandPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    color: colors.brandPrimary,
    fontSize: 18,
    width: 28,
  },
  rowLabel: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "600",
  },
  rowChevron: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: "300",
  },
});
