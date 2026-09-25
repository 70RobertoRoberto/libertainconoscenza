import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/src/theme";
import { useLang } from "@/src/i18n";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, color: focused ? colors.brandPrimary : colors.muted }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { t } = useLang();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tab_home"), tabBarIcon: ({ focused }) => <TabIcon label="✦" focused={focused} /> }} />
      <Tabs.Screen name="library" options={{ title: t("tab_library"), tabBarIcon: ({ focused }) => <TabIcon label="◈" focused={focused} /> }} />
      <Tabs.Screen name="media" options={{ title: t("tab_media"), tabBarIcon: ({ focused }) => <TabIcon label="◉" focused={focused} /> }} />
      <Tabs.Screen name="corsi" options={{ title: t("tab_courses"), tabBarIcon: ({ focused }) => <TabIcon label="◇" focused={focused} /> }} />
      <Tabs.Screen name="messages" options={{ title: t("tab_messages"), tabBarIcon: ({ focused }) => <TabIcon label="✉" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("tab_profile"), tabBarIcon: ({ focused }) => <TabIcon label="◐" focused={focused} /> }} />
    </Tabs>
  );
}
