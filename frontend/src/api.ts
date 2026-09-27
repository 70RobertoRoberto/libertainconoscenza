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
    let msg: string;
    if (data && Array.isArray(data.detail)) {
      // FastAPI validation errors: array of {loc, msg, type}
      msg = data.detail
        .map((e: any) => (e.loc ? `${e.loc.slice(-1)[0]}: ${e.msg}` : e.msg))
        .join(" · ");
    } else {
      msg = (data && (data.detail || data.message)) || `Errore ${res.status}`;
    }
    // Auto-logout on session expired (single-session invalidation) to force
    // the user back to the login screen.
    if (
      res.status === 401 &&
      typeof msg === "string" &&
      /sessione scaduta/i.test(msg)
    ) {
      await setToken(null);
    }
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

/**
 * Upload a file (image, audio, video) via multipart streaming.
 * Uses FileSystem.uploadAsync on native to avoid JS-memory blowup / Expo Go crashes
 * on Android with large files. Returns { url } from the /admin/upload endpoint.
 */
export async function adminUpload(
  fileUri: string,
  contentType: string,
  fileName = "upload.bin",
): Promise<{ url: string }> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (Platform.OS === "web") {
    // On web, expo returns a blob URL; fetch it into a Blob and post as FormData.
    const blob = await (await fetch(fileUri)).blob();
    const fd = new FormData();
    fd.append("file", blob as any, fileName);
    const r = await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers, body: fd });
    if (!r.ok) throw new Error(`Upload fallito (${r.status})`);
    return r.json();
  }

  // Native: stream from disk via FileSystem
  const FileSystem = await import("expo-file-system/legacy");
  const res = await FileSystem.uploadAsync(`${BASE}/api/admin/upload`, fileUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType: contentType,
    headers,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Upload fallito (${res.status})`);
  try {
    return JSON.parse(res.body);
  } catch {
    throw new Error("Risposta upload non valida");
  }
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
  async register(phone: string, password: string, name?: string, referral_code?: string, email?: string, first_name?: string, last_name?: string) {
    const r = await api<{ access_token: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ phone, password, name, referral_code, email, first_name, last_name }),
    });
    await setToken(r.access_token);
    return r.user;
  },
  async me() {
    return await api<any>("/auth/me");
  },
  async logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    await setToken(null);
  },
  async hasToken() {
    return !!(await getToken());
  },
};
