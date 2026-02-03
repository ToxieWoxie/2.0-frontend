// FILE: Syn/lib/assessment.store.ts
// =======================================================
import { Platform } from "react-native";

export type AssessmentAnswer = "yes" | "no" | "unsure";

const mem = new Map<string, AssessmentAnswer>();
const keyOf = (projectId: string) => `syn.assessment.${projectId}`;

export function getAssessmentAnswer(projectId: string): AssessmentAnswer | null {
  const k = keyOf(projectId);

  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    const v = window.localStorage.getItem(k);
    return v === "yes" || v === "no" || v === "unsure" ? v : null;
  }

  return mem.get(k) ?? null;
}

export function setAssessmentAnswer(projectId: string, answer: AssessmentAnswer): void {
  const k = keyOf(projectId);

  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(k, answer);
    return;
  }

  mem.set(k, answer);
}

export function clearAssessmentAnswer(projectId: string): void {
  const k = keyOf(projectId);

  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(k);
    return;
  }

  mem.delete(k);
}
