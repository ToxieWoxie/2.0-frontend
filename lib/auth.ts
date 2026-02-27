// Syn/lib/auth.ts
import type { AuthUser, LoginInput, SignUpInput } from "./auth.types";
import { AuthError } from "./auth.types";

type ApiErrorBody = { code?: string; error?: string; message?: string };

function getApiBaseUrl(): string {
 

  return (
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.REACT_APP_API_BASE_URL?.trim() ||
    ""
  );
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

function toAuthError(status: number, body: unknown): AuthError {
  const parsed = (body ?? {}) as ApiErrorBody;

  const code =
    parsed.code ??
    (typeof parsed.error === "string" ? parsed.error : undefined) ??
    `http_${status}`;

  const message =
    (typeof parsed.message === "string" && parsed.message) ||
    (typeof parsed.error === "string" && parsed.error) ||
    `Request failed (${status})`;

  return new AuthError(String(code), String(message));
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!base && path.startsWith("/api/")) {
    throw new AuthError(
      "missing_api_base",
      "Missing EXPO_PUBLIC_API_BASE_URL. Set it to your backend base URL (e.g. http://localhost:3000)."
    );
  }

  const url = joinUrl(base, path);
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  if (!isFormData) {
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = 8000;
  const t = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: "include", // ✅ cookie auth
      mode: "cors", // ✅ web cross-origin stability
      signal: controller?.signal,
    });
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    if (err?.name === "AbortError") {
      throw new AuthError("network_timeout", `Request timed out (${timeoutMs}ms): ${path}`);
    }
    throw new AuthError("network_error", String(err?.message ?? e));
  } finally {
    if (t) clearTimeout(t);
  }

  if (res.status === 204) return undefined as unknown as T;

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) throw toAuthError(res.status, body);
  return body as T;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { user } = await apiFetch<{ user: AuthUser | null }>("/api/auth/me", { method: "GET" });
  return user ?? null;
}

export async function signUp(input: SignUpInput): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const username = input.username.trim();

  if (!email || !password || !username) throw new AuthError("invalid_input", "Missing required fields.");

  const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
  });

  return user;
}

export async function logIn(input: LoginInput): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) throw new AuthError("invalid_input", "Missing required fields.");

  const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  return user;
}

export async function logOut(): Promise<void> {
  await apiFetch<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export async function updateProfile(patch: {
  username?: string;
  bio?: string | null;
  avatarUrl?: string | null;
}): Promise<AuthUser> {
  const body: Record<string, unknown> = {};
  if (patch.username !== undefined) body.username = patch.username.trim();
  if (patch.bio !== undefined) body.bio = patch.bio;
  if (patch.avatarUrl !== undefined) body.avatarUrl = patch.avatarUrl;

  const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return user;
}

/**
 * Upload avatar file and return URL.
 * Cookie-only auth. No localStorage.
 */
export async function uploadAvatar(
  file: Blob | File | { uri: string; name?: string; type?: string },
  contentType = "image/jpeg"
): Promise<string> {
  if (!file) throw new AuthError("invalid_input", "Missing file.");

  const fd = new FormData();
  const ext = (contentType.split("/")[1] || "jpg").toLowerCase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasUri = typeof (file as any)?.uri === "string";

  if (hasUri) {
    // Native (or picked asset object)
    const f = file as { uri: string; name?: string; type?: string };
    fd.append(
      "file",
      {
        uri: f.uri,
        name: f.name ?? `avatar.${ext}`,
        type: f.type ?? contentType,
      } as unknown as Blob
    );
  } else {
    // Web File/Blob
    fd.append("file", file as Blob, `avatar.${ext}`);
  }

  fd.append("contentType", contentType);

  const data = await apiFetch<{ url: string }>("/api/auth/avatar", {
    method: "POST",
    body: fd,
  });

  const url = String(data?.url ?? "");
  if (!url) throw new AuthError("upload_failed", "Avatar upload failed.");
  return url;
}
