import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { LogBox, Platform, Linking as RNLinking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AdOverlay } from "@/src/AdOverlay";
import Constants from "expo-constants";
import { useEffect } from "react";
import { initLang } from "@/src/i18n";

LogBox.ignoreAllLogs(true);

// Expo Go on SDK 53+ removed remote-push support on Android and any call to
// expo-notifications crashes the whole bundle. Detect Expo Go and skip.
// Constants.appOwnership === "expo" only in Expo Go; undefined in dev builds.
const IS_EXPO_GO = Constants.appOwnership === "expo";
const NOTIFICATIONS_ENABLED = !IS_EXPO_GO && Platform.OS !== "web";

// Lazy require so the import itself never crashes at bundle time.
function safeNotifications(): any | null {
  if (!NOTIFICATIONS_ENABLED) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications");
  } catch {
    return null;
  }
}

// Module-scope: disable browser auto-translation on web so brand names / language don't get rewritten.
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

// Module-scope: notification handler & Android channel — only outside Expo Go.
try {
  const N = safeNotifications();
  if (N) {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === "android") {
      N.setNotificationChannelAsync("default", {
        name: "Default",
        importance: N.AndroidImportance?.MAX ?? 5,
        sound: "default",
      });
    }
  }
} catch {}

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
    const N = safeNotifications();
    if (!N) return;
    let tapSub: any = null;
    try {
      tapSub = N.addNotificationResponseReceivedListener((response: any) => {
        const data: any = response?.notification?.request?.content?.data || {};
        const url = data.deeplink || data.action_url;
        if (!url) return;
        if (typeof url === "string" && url.startsWith("http")) {
          RNLinking.openURL(url);
        } else {
          router.push(url as any);
        }
      });

      N.getLastNotificationResponseAsync?.().then((response: any) => {
        if (!response) return;
        const data: any = response?.notification?.request?.content?.data || {};
        const url = data.deeplink || data.action_url;
        if (!url) return;
        if (typeof url === "string" && url.startsWith("http")) {
          RNLinking.openURL(url);
        } else {
          router.push(url as any);
        }
      }).catch(() => {});
    } catch {}

    return () => {
      try { tapSub?.remove?.(); } catch {}
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
