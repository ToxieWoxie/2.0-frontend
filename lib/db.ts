// lib/db.ts
import type {
  AnswerMap,
  LoadedProject,
  ProjectDraft,
  ProjectListItem,
  ProjectRole,
  ShareInfo,
  SubmissionListItem,
} from "./models";

type ApiErrorShape =
  | { code?: string; error?: string; message?: string }
  | { errors: Array<{ message?: string }> };

function getApiBase(): string {
  // Expo (Metro): env is available on process.env with EXPO_PUBLIC_*
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env =
    ((typeof process !== "undefined" ? (process as any).env : undefined) ??
      (globalThis as any)?.process?.env) as Record<string, string> | undefined;

  return (
    env?.EXPO_PUBLIC_API_BASE_URL?.trim() ||
    env?.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    env?.REACT_APP_API_BASE_URL?.trim() ||
    ""
  );
}

const API_BASE = getApiBase();

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
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
    credentials: "include",
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res);
    throw new Error(msg || "Request failed");
  }

  if (res.status === 204) return undefined as unknown as T;

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return (await res.text()) as unknown as T;

  return (await res.json()) as T;
}

/**
 * Auth:
 *   GET /api/auth/me -> { id: string, email?: string | null }
 */
async function requireUser(): Promise<{ id: string; email?: string | null }> {
  const data = await apiFetch<any>("/api/auth/me", { method: "GET" });
  const u = (data as any)?.user ?? data;
  if (!u?.id) throw new Error("Not authenticated");
  return { id: String(u.id), email: (u as any)?.email ?? null };
}

/**
 * With Express, DB init is server-side. Keep this for older screens calling initDb().
 */
export async function initDb(): Promise<void> {
  return;
}

export async function getMyRole(projectId: string): Promise<ProjectRole | null> {
  await requireUser();
  const data = await apiFetch<{ role: ProjectRole | null }>(
    `/api/projects/${encodeURIComponent(projectId)}/my-role`,
    { method: "GET" }
  );
  return (data?.role ?? null) as ProjectRole | null;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  await requireUser();
  const data = await apiFetch<{ projects: ProjectListItem[] }>("/api/projects", { method: "GET" });
  const items = (data?.projects ?? []) as any[];

  return items
    .map((p) => ({
      id: String((p as any).id),
      title: String((p as any).title ?? "").trim(),
      updatedAt: Number((p as any).updatedAt ?? 0),
      published: Boolean((p as any).published),
    }))
    .filter((p) => p.id && p.title);
}

export async function loadProject(id: string): Promise<LoadedProject | null> {
  const data = await apiFetch<{ project: any } | null>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  const p = (data as any)?.project ?? null;
  if (!p) return null;

  return {
    id: String((p as any).id),
    ownerId: String((p as any).ownerId),
    title: String((p as any).title ?? ""),
    description: String((p as any).description ?? ""),
    includeAssessment: Boolean((p as any).includeAssessment),
    recordUserEnabled: Boolean((p as any).recordUserEnabled ?? false),
    questions: Array.isArray((p as any).questions) ? ((p as any).questions as any) : [],
    updatedAt: Number((p as any).updatedAt ?? 0),
    published: Boolean((p as any).published),
  } as LoadedProject;
}

export async function saveProjectDraft(draft: ProjectDraft): Promise<string> {
  const u = await requireUser();

  // New draft (no id yet): create server project and return its id
  if (!draft.id) {
    const data = await apiFetch<{ project: any }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ ...draft, ownerId: u.id }),
    });
    const createdId = String((data as any)?.project?.id ?? "");
    if (!createdId) throw new Error("Failed to create project");
    return createdId;
  }

  const existing = await loadProject(draft.id);
  if (!existing) {
    // Project id provided but missing on server: create anew
    const data = await apiFetch<{ project: any }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ ...draft, ownerId: u.id }),
    });
    const createdId = String((data as any)?.project?.id ?? "");
    if (!createdId) throw new Error("Failed to create project");
    return createdId;
  }

  const role = await getMyRole(draft.id);
  if (!role || (role !== "owner" && role !== "editor")) throw new Error("Permission denied");

  await apiFetch<void>(`/api/projects/${encodeURIComponent(draft.id)}`, {
    method: "PUT",
    body: JSON.stringify(draft),
  });

  return draft.id;
}


export async function publishProjectToLibrary(draft: ProjectDraft): Promise<void> {
  const projectId = await saveProjectDraft(draft);

  await apiFetch<void>(`/api/projects/${encodeURIComponent(projectId)}/publish`, {
    method: "POST",
    body: JSON.stringify({ ...draft, id: projectId }),
  });
}

export async function publishProject(draft: ProjectDraft): Promise<string> {
  const id = await saveProjectDraft(draft);
  await apiFetch<{ project: any }>(`/api/projects/${encodeURIComponent(id)}/publish`, {
    method: "POST",
  });
  return id;
}


export async function deleteProject(id: string): Promise<void> {
  await apiFetch<void>(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function ensureShareInfo(id: string): Promise<ShareInfo> {
  const p = await loadProject(id);
  const title = String((p as any)?.title ?? "").trim();

  const data = await apiFetch<{ viewerCode: string }>(
    `/api/projects/${encodeURIComponent(id)}/share`,
    { method: "POST" }
  );

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

export async function joinByViewerCode(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  const data = await apiFetch<{ projectId: string }>("/api/join", {
    method: "POST",
    body: JSON.stringify({ code: normalized }),
  });
  const projectId = String(data?.projectId ?? "");
  if (!projectId) throw new Error("Invalid code");
  return projectId;
}

export async function createEditorInvite(projectId: string): Promise<string> {
  const data = await apiFetch<{ token: string }>(
    `/api/projects/${encodeURIComponent(projectId)}/invites/editor`,
    { method: "POST" }
  );
  const token = String(data?.token ?? "");
  if (!token) throw new Error("Failed to create invite");
  return token;
}

export async function acceptInvite(token: string): Promise<string> {
  const data = await apiFetch<{ projectId: string }>("/api/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  const projectId = String(data?.projectId ?? "");
  if (!projectId) throw new Error("Invalid invite");
  return projectId;
}

export async function listMembers(
  projectId: string
): Promise<Array<{ userId: string; role: ProjectRole; username?: string; avatarUrl?: string | null }>> {
  const rows = await apiFetch<
    Array<{ userId: string; role: ProjectRole; username?: string; avatarUrl?: string | null }>
  >(`/api/projects/${encodeURIComponent(projectId)}/members`, { method: "GET" });

  return (rows ?? []).map((r) => ({
    userId: String((r as any).userId),
    role: String((r as any).role) as ProjectRole,
    username: (r as any).username,
    avatarUrl: (r as any).avatarUrl ?? null,
  }));
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  await apiFetch<void>(
    `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
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
// FILE: Syn/lib/db.ts
export async function deleteSubmission(projectId: string, submissionId: string): Promise<void> {
  const pid = encodeURIComponent(String(projectId || "").trim());
  const sid = encodeURIComponent(String(submissionId || "").trim());
  if (!pid || !sid) throw new Error("Missing projectId/submissionId.");

  // ✅ must include /api
  await apiFetch<void>(`/api/projects/${pid}/submissions/${sid}`, {
    method: "DELETE",
  });
}



export async function listSubmissions(projectId: string): Promise<SubmissionListItem[]> {
  const data = await apiFetch<any>(`/api/projects/${encodeURIComponent(projectId)}/submissions`, {
    method: "GET",
  });

  const rows: any[] = Array.isArray(data) ? data : (data?.submissions ?? []);

  return (rows ?? []).map((r) => ({
    id: String((r as any).id),
    userId: String((r as any).userId),
    createdAt: String((r as any).createdAt),
    answers: ((r as any).answers ?? {}) as any,
    username: (r as any).username ?? null,
    recordUserConsent: Boolean((r as any).recordUserConsent ?? false),
  }));
}

/**
 * Compatibility: if any file does `import db from "../lib/db"`, this keeps it working.
 */
export { resolvePublicUrl, uploadProjectMedia } from "./db.shared";
const db = {
  initDb,
  getMyRole,
  listProjects,
  loadProject,
  saveProjectDraft,
  deleteProject,
  ensureShareInfo,
  joinByViewerCode,
  createEditorInvite,
  acceptInvite,
  listMembers,
  removeMember,
  submitAnswers,
  deleteSubmission,
  listSubmissions,
};
export default db;