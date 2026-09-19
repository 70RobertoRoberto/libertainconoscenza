import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AdOverlay } from "@/src/AdOverlay";

LogBox.ignoreAllLogs(true);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

export default function RootLayout() {
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
