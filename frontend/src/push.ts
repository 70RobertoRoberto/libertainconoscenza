// Push notification registration helper.
// Call after login/app open to relay device token to backend.
// Safe on Expo Go SDK 53+ (which no longer supports remote push on Android).
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "./api";

const IS_EXPO_GO = Constants.appOwnership === "expo";

export async function registerForPush(userId: string) {
  if (Platform.OS === "web") return { skipped: "web" } as const;
  if (IS_EXPO_GO) return { skipped: "expo-go" } as const;
  if (!Device.isDevice) return { skipped: "simulator" } as const;

  try {
    // Lazy-require so the whole module doesn't crash on Expo Go / web bundlers.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications");
    const perms = await Notifications.getPermissionsAsync();
    let status = perms.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return { skipped: "denied" } as const;

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await api("/register-push", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        platform: Platform.OS,
        device_token: tokenResp.data,
      }),
    });
    return { ok: true, token: tokenResp.data } as const;
  } catch (e) {
    return { error: String(e) } as const;
  }
}
