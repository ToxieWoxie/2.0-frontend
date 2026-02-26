// FILE: Syn/app/battery/_lib/batteryApi.ts
import { Platform } from "react-native";

export const API_BASE: string =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ||
  (Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin // prefer same-origin on web to avoid CORS
    : "http://localhost:3001"); // dev fallback (breaks on device/emulator unless env is set)

type ApiOk<T> = { ok: true; payload?: T; runId?: string };
type ApiErr = { ok: false; error?: string };

function asErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;

  try {
    res = await fetch(url, init);
  } catch (e: unknown) {
    const hint =
      Platform.OS === "web"
        ? "Likely CORS or API not reachable. If API is on another port, enable CORS w/ credentials or proxy /api."
        : "If running on device/emulator, localhost won't reach your computer. Set EXPO_PUBLIC_API_BASE_URL to your LAN IP.";
    throw new Error(`Network error: ${url} -> ${asErrorMessage(e)}. ${hint}`);
  }

  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url} -> ${data?.error ?? JSON.stringify(data)}`);
  return data as T;
}

export async function saveRun<T = any>(runId: string, payload: any): Promise<ApiOk<T>> {
  const url = `${API_BASE}/api/battery/runs/${encodeURIComponent(runId)}`;
  return fetchJson<ApiOk<T> | ApiErr>(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }) as Promise<ApiOk<T>>;
}

export async function loadRun<T = any>(runId: string): Promise<ApiOk<T>> {
  const url = `${API_BASE}/api/battery/runs/${encodeURIComponent(runId)}`;
  return fetchJson<ApiOk<T> | ApiErr>(url, {
    method: "GET",
    credentials: "include",
  }) as Promise<ApiOk<T>>;
}

export async function getResults(runId: string, repeats = 3) {
  const url = `${API_BASE}/api/battery/runs/${encodeURIComponent(runId)}/results?repeats=${repeats}`;
  return fetchJson<any>(url, {
    method: "GET",
    credentials: "include",
  });
}

export const batteryApiUtils = { asErrorMessage };
