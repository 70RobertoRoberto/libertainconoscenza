// API client for Conoscenza Aperta
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const TOKEN_KEY = "ca_token";

// Web-safe storage
async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(t: string | null) {
  if (Platform.OS === "web") {
    try {
      if (t) window.localStorage.setItem(TOKEN_KEY, t);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch {}
    return;
  }
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Errore ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const auth = {
  async login(phone: string, password: string) {
    const r = await api<{ access_token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
    await setToken(r.access_token);
    return r.user;
  },
  async register(phone: string, password: string, name?: string) {
    const r = await api<{ access_token: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ phone, password, name }),
    });
    await setToken(r.access_token);
    return r.user;
  },
  async me() {
    return await api<any>("/auth/me");
  },
  async logout() {
    await setToken(null);
  },
  async hasToken() {
    return !!(await getToken());
  },
};
