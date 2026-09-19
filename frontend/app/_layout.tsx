import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { LogBox, Platform, Linking as RNLinking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AdOverlay } from "@/src/AdOverlay";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { initLang } from "@/src/i18n";

LogBox.ignoreAllLogs(true);

// Module-scope: disable browser auto-translation on the web preview so that
// brand names like WhatsApp / Telegram and the user-selected language don't get
// silently rewritten by Google Chrome / Safari page translators.
if (Platform.OS === "web" && typeof document !== "undefined") {
  try {
    document.documentElement.setAttribute("translate", "no");
    document.documentElement.classList.add("notranslate");
    if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "google");
      meta.setAttribute("content", "notranslate");
      document.head.appendChild(meta);
    }
  } catch {}
}

// Module-scope: foreground handler (guarded from web)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Module-scope: Android default channel
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const router = useRouter();

  // Kick off language init exactly once at app boot.
  useEffect(() => {
    initLang();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response.notification.request.content.data || {};
      const url = data.deeplink || data.action_url;
      if (!url) return;
      if (typeof url === "string" && url.startsWith("http")) {
        RNLinking.openURL(url);
      } else {
        router.push(url as any);
      }
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data: any = response.notification.request.content.data || {};
      const url = data.deeplink || data.action_url;
      if (!url) return;
      if (typeof url === "string" && url.startsWith("http")) {
        RNLinking.openURL(url);
      } else {
        router.push(url as any);
      }
    });

    return () => {
      tapSub.remove();
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0A0F0D" },
            animation: "fade",
          }}
        />
        <AdOverlay />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
