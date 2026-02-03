// FILE: lib/models.ts
/**
 * Shared, serializable domain models used by the Expo app and API client.
 *
 * Notes:
 * - `ProjectDraft.id === ""` means "new project not yet saved".
 * - Keep shapes JSON-friendly (no Dates, Maps, etc).
 */

export type ProjectRole = "owner" | "editor" | "viewer";

export type QuestionType = "multiple_choice" | "short_answer" | "long_answer" | "color_wheel";

export type QuestionDraft = {
  id: string;
  type: QuestionType;
  prompt: string;
  required: boolean;
  options: string[]; // only used for multiple_choice
  imageUrl?: string | null;
  audioUrl?: string | null;
};

export type ProjectDraft = {
  id: string;
  title: string;
  description: string;
  includeAssessment: boolean;
    recordUserEnabled?: boolean;
  questions: QuestionDraft[];
  updatedAt?: number;
};

export type LoadedProject = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  includeAssessment: boolean;
   recordUserEnabled?: boolean;
  questions: QuestionDraft[];
  updatedAt: number;
  published?: boolean;
};

export type ProjectListItem = {
  id: string;
  title: string;
  updatedAt: number;
  role?: ProjectRole;
  published?: boolean;
};

export type AnswerValue = string | string[] | number | boolean | null;
export type AnswerMap = Record<string, AnswerValue>;

export type SubmissionListItem = {
  id: string;
  userId: string;
  createdAt: string;
  answers: AnswerMap;
};

export type ShareInfo = {
  id: string;
  title: string;
  viewerCode: string;
  viewerJoinPath: string;
  viewerPreviewPath: string;
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function makeEmptyQuestion(type: QuestionType = "short_answer"): QuestionDraft {
  return {
    id: makeId("q"),
    type,
    prompt: "",
    required: false,
    options: type === "multiple_choice" ? ["", ""] : [],
    imageUrl: null,
    audioUrl: null,
  };
}

export function makeEmptyProject(): ProjectDraft {
  return {
    id: "",
    title: "",
    description: "",
    includeAssessment: false,
    questions: [makeEmptyQuestion("short_answer")],
    updatedAt: Date.now(),
  };
}
