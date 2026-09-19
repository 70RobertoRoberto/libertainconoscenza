// Push notification registration helper.
// Call after login/app open to relay device token to backend.
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "./api";

export async function registerForPush(userId: string) {
  if (Platform.OS === "web") return { skipped: "web" } as const;
  if (!Device.isDevice) return { skipped: "simulator" } as const;

  try {
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
