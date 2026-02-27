// FILE: lib/db.shared.ts
// ================================
import type {
  AnswerMap,
  LoadedProject,
  ProjectDraft,
  ProjectListItem,
  ProjectRole,
  ShareInfo,
  SubmissionListItem,
} from "./models";
import { getCurrentUser } from "./auth";

type ApiErrorShape =
  | { code?: string; error?: string; message?: string }
  | { errors?: Array<{ message?: string }> };

function getApiBase(): string {

  return (
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.REACT_APP_API_BASE_URL?.trim() ||
    ""
  );
}

const API_BASE = getApiBase();

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function normalizeId(v: any): string {
  return String(v?._id ?? v?.id ?? "");
}

function normalizeUpdatedAtMs(v: any): number {
  const raw = v?.updatedAt ?? v?.createdAt ?? 0;
  if (typeof raw === "number") return raw;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : 0;
}

async function readErrorMessage(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return (text || `${res.status} ${res.statusText}`).trim();
  }

  try {
    const body = (await res.json()) as ApiErrorShape;
    if (typeof (body as any)?.message === "string") return String((body as any).message);
    if (typeof (body as any)?.error === "string") return String((body as any).error);
    if (Array.isArray((body as any)?.errors) && (body as any).errors[0]?.message) {
      return String((body as any).errors[0].message);
    }
  } catch {
    // ignore
  }

  return `${res.status} ${res.statusText}`.trim();
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE && path.startsWith("/api/")) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_BASE_URL. Set it to your backend base URL (e.g. http://localhost:3000) so /api/* requests don’t hit the Expo dev server."
    );
  }

  const url = joinUrl(API_BASE, path);
  const headers = new Headers(init.headers);

  if (!headers.has("accept")) headers.set("accept", "application/json");

  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers,
    // ✅ REQUIRED for cookie-auth to work on web
    credentials: "include",
    // ✅ Helps browsers treat cross-origin requests correctly when base != current origin
    mode: "cors",
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(msg || `Request failed: ${res.status} ${res.statusText}`);
  }

  if (res.status === 204) return undefined as unknown as T;

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return (await res.text()) as unknown as T;

  return (await res.json()) as T;
}

/**
 * IMPORTANT:
 * Some auth helpers elsewhere may NOT send cookies on web.
 * This file's apiFetch() always sends cookies, so we use /api/auth/me as a fallback.
 */
async function getCurrentUserViaApiFetch(): Promise<any | null> {
  const data = await apiFetch<{ user: any | null }>("/api/auth/me", { method: "GET" });
  return data?.user ?? null;
}

async function requireUser() {
  // Try app-level helper first
  try {
    const user = await getCurrentUser();
    if (user?.id) return user;
  } catch {
    // ignore; we'll retry via apiFetch which includes cookies
  }

  // Fallback: guaranteed cookie-including request
  const user = await getCurrentUserViaApiFetch();
  if (!user?.id) throw new Error("Not authenticated");
  return user;
}

export function resolvePublicUrl(maybeRelative: string): string {
  if (!maybeRelative) return "";
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  if (!API_BASE) return maybeRelative;
  return joinUrl(API_BASE, maybeRelative);
}

/** Keep for screens calling initDb() */
export async function initDb(): Promise<void> {
  return;
}

export async function getMyRole(projectId: string): Promise<ProjectRole | null> {
  await requireUser();
  const data = await apiFetch<{ role: ProjectRole | "none" | null }>(
    `/api/projects/${encodeURIComponent(projectId)}/my-role`,
    { method: "GET" }
  );
  const role = data?.role ?? null;
  if (!role || role === "none") return null;
  return role as ProjectRole;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  await requireUser();
  const data = await apiFetch<{ projects: any[] }>(`/api/projects`, { method: "GET" });

  return (data?.projects ?? []).map((p) => ({
    id: normalizeId(p),
    title: String(p?.title ?? "").trim(),
    updatedAt: normalizeUpdatedAtMs(p),
    published: Boolean(p?.published ?? false),
  }));
}

export async function loadProject(id: string): Promise<LoadedProject | null> {
  await requireUser();
  const data = await apiFetch<{ project: any }>(`/api/projects/${encodeURIComponent(id)}`, { method: "GET" });
  const p = data?.project;
  if (!p) return null;

  return {
    id: normalizeId(p),
    ownerId: String(p?.ownerId ?? p?.owner ?? ""),
    title: String(p?.title ?? ""),
    description: String(p?.description ?? ""),
    includeAssessment: Boolean(p?.includeAssessment ?? false),
    recordUserEnabled: Boolean(p?.recordUserEnabled ?? false),
    questions: Array.isArray(p?.questions) ? (p.questions as any) : [],
    updatedAt: normalizeUpdatedAtMs(p),
    published: Boolean(p?.published ?? false),
  } as LoadedProject;
}

export async function joinByViewerCode(code: string): Promise<string> {
  await requireUser();
  const viewerCode = code.trim().toUpperCase();

  const data = await apiFetch<{ projectId: string }>(`/api/join`, {
    method: "POST",
    body: JSON.stringify({ viewerCode }),
  });

  const projectId = String(data?.projectId ?? "");
  if (!projectId) throw new Error("Invalid code");
  return projectId;
}

/** Save draft + return project id (required by Create/Preview flows). */
export async function saveProjectDraft(draft: ProjectDraft): Promise<string> {
  await requireUser();

  const id = String(draft.id ?? "").trim();
  const payload = {
    title: String(draft.title ?? "").trim(),
    description: String(draft.description ?? ""),
    includeAssessment: Boolean(draft.includeAssessment ?? false),
    recordUserEnabled: Boolean(draft.recordUserEnabled ?? false),
    questions: Array.isArray(draft.questions) ? draft.questions : [],
  };

  if (!payload.title) throw new Error("Title is required.");

  if (!id) {
    const created = await apiFetch<{ project: any }>(`/api/projects`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const newId = normalizeId(created?.project);
    if (!newId) throw new Error("Failed to create project.");
    return newId;
  }

  await apiFetch<{ project: any }>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return id;
}

export async function publishProject(draft: ProjectDraft): Promise<string> {
  const id = await saveProjectDraft(draft);
  await apiFetch<{ project: any }>(`/api/projects/${encodeURIComponent(id)}/publish`, { method: "POST" });
  return id;
}

export async function uploadProjectMedia(
  projectId: string,
  file: Blob | File | { uri: string; name?: string; type?: string },
  contentType: string
): Promise<string> {
  await requireUser();
  if (!projectId) throw new Error("Missing project id.");
  if (!file) throw new Error("Missing file.");

  const fd = new FormData();

  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasUri = typeof (file as any)?.uri === "string";

  if (hasUri) {
    const f = file as { uri: string; name?: string; type?: string };
    const name = f.name ?? `upload.${(contentType.split("/")[1] || "bin").toLowerCase()}`;
    const type = f.type ?? contentType;

    if (isBrowser) {
      // ✅ WEB FIX: convert the URI into a real Blob/File before appending to FormData
      const resp = await fetch(f.uri);
      if (!resp.ok) throw new Error(`Failed to read selected file: ${resp.status} ${resp.statusText}`);
      const blob = await resp.blob();

      const fileObj = typeof File !== "undefined" ? new File([blob], name, { type }) : (blob as Blob);
      fd.append("file", fileObj);
    } else {
      // ✅ NATIVE (iOS/Android): RN expects the { uri, name, type } object
      fd.append("file", { uri: f.uri, name, type } as unknown as Blob);
    }
  } else {
    // File or Blob (web dropzone path)
    fd.append("file", file as Blob);
  }

  fd.append("contentType", contentType);

  const data = await apiFetch<{ url: string }>(`/api/projects/${encodeURIComponent(projectId)}/media`, {
    method: "POST",
    body: fd,
  });

  const url = String(data?.url ?? "");
  if (!url) throw new Error("Upload failed.");
  return url;
}

export async function deleteProject(id: string): Promise<void> {
  await requireUser();
  await apiFetch<void>(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function ensureShareInfo(id: string): Promise<ShareInfo> {
  await requireUser();

  const p = await loadProject(id);
  const title = String((p as any)?.title ?? "").trim();

  const data = await apiFetch<{ viewerCode: string }>(`/api/projects/${encodeURIComponent(id)}/share`, {
    method: "POST",
  });

  const viewerCode = String(data?.viewerCode ?? "").trim().toUpperCase();
  if (!viewerCode) throw new Error("Failed to generate viewer code.");

  return {
    id,
    title,
    viewerCode,
    viewerJoinPath: `/join?code=${encodeURIComponent(viewerCode)}`,
    viewerPreviewPath: `/preview/${encodeURIComponent(id)}`,
  };
}

export async function submitAnswers(
  projectId: string,
  answers: AnswerMap,
  opts: { recordUserConsent?: boolean } = {}
): Promise<void> {
  await requireUser();
  await apiFetch<void>(`/api/projects/${encodeURIComponent(projectId)}/submissions`, {
    method: "POST",
    body: JSON.stringify({ answers, recordUserConsent: Boolean(opts.recordUserConsent) }),
  });
}
// FILE: Syn/lib/db.shared.ts
export async function deleteSubmission(projectId: string, submissionId: string): Promise<void> {
  await requireUser();
  await apiFetch<any>(
    `/api/projects/${encodeURIComponent(projectId)}/submissions/${encodeURIComponent(submissionId)}`,
    { method: "DELETE" }
  );
}


export async function listSubmissions(projectId: string): Promise<SubmissionListItem[]> {
  await requireUser();
  const data = await apiFetch<any>(`/api/projects/${encodeURIComponent(projectId)}/submissions`, {
    method: "GET",
  });

  const rows: any[] = Array.isArray(data) ? data : (data?.submissions ?? []);

  return (rows ?? []).map((s) => {
    // Supports BOTH shapes:
    // 1) backend DTO: { id, userId, createdAt, answers, username?, recordUserConsent? }
    // 2) older/raw:   { _id, createdBy, createdAt, payload: { answers, ... } }
    const payload = s?.payload ?? {};
    const answersFromPayload =
      payload?.answers && typeof payload.answers === "object" ? payload.answers : payload;

    const answers =
      s?.answers && typeof s.answers === "object" ? s.answers : (answersFromPayload ?? {});

    const username =
      s?.username ?? payload?.recordedUsername ?? null;

    const recordUserConsent = Boolean(
      s?.recordUserConsent ?? payload?.recordUserConsent ?? false
    );

    return {
      id: String(s?.id ?? s?._id ?? normalizeId(s)),
      userId: String(s?.userId ?? s?.createdBy ?? ""),
      createdAt: String(s?.createdAt ?? ""),
      answers: (answers ?? {}) as AnswerMap,
      username,
      recordUserConsent,
    };
  });
}

const db = {
  initDb,
  getMyRole,
  listProjects,
  loadProject,
  saveProjectDraft,
  publishProject,
  uploadProjectMedia,
  deleteProject,
  ensureShareInfo,
  submitAnswers,
  deleteSubmission,
  listSubmissions,
};
export default db;

export async function acceptInvite(token: string): Promise<string> {
  const data = await apiFetch<{ projectId: string }>("/api/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  const projectId = String(data?.projectId ?? "");
  if (!projectId) throw new Error("Invalid invite");
  return projectId;
}
