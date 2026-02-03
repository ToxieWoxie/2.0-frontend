// FILE: Syn/app/submissions/[id]/[userId].tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { deleteSubmission, initDb, listSubmissions, loadProject } from "../../../lib/db";
import type { LoadedProject, SubmissionListItem } from "../../../lib/models";

type QuestionDraft = any;

type MainTab = "answers" | "longevity";
type ConsistencyStatus = "consistent" | "changed" | "na";

const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

function fmtDate(raw: string): string {
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : raw;
}

function shortId(v: string): string {
  const s = String(v || "");
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-2)}` : s;
}

function normalizeHex(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("#") && /^[#][0-9a-f]{6}$/.test(s)) return s;
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  return "";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  const n = parseInt(h.slice(1), 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function colorSimilarity(aHex: string, bHex: string): number {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  if (!a || !b) return 0;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  const maxDist = Math.sqrt(255 * 255 * 3);
  const sim = 1 - dist / maxDist;
  return Math.max(0, Math.min(1, sim));
}

function optionLabel(opt: unknown, idx: number): string {
  const s = String(opt ?? "").trim();
  return s || `Option ${idx + 1}`;
}

function getAnswer(sub: SubmissionListItem | null, q: QuestionDraft): string {
  if (!sub) return "";
  const answers: any = (sub as any)?.answers ?? {};
  const v = answers?.[q.id];
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return q.type === "color_wheel" ? normalizeHex(s) : s;
}

function isEligibleForLongevity(q: QuestionDraft): boolean {
  return q?.type === "multiple_choice" || q?.type === "color_wheel";
}

function computePerQuestionStatus(
  q: QuestionDraft,
  attemptsOldestToNewest: SubmissionListItem[],
  threshold = 0.8
): { status: ConsistencyStatus; similarityMin?: number } {
  if (!isEligibleForLongevity(q)) return { status: "na" };
  if (attemptsOldestToNewest.length < 2) return { status: "na" };

  const baseline = attemptsOldestToNewest[0];
  const baseAns = getAnswer(baseline, q);
  if (!baseAns) return { status: "changed" };

  if (q.type === "multiple_choice") {
    for (const s of attemptsOldestToNewest) {
      const a = getAnswer(s, q);
      if (!a || a !== baseAns) return { status: "changed" };
    }
    return { status: "consistent" };
  }

  if (q.type === "color_wheel") {
    let minSim = 1;
    for (const s of attemptsOldestToNewest) {
      const a = getAnswer(s, q);
      if (!a) return { status: "changed", similarityMin: 0 };
      const sim = colorSimilarity(a, baseAns);
      minSim = Math.min(minSim, sim);
      if (sim < threshold) return { status: "changed", similarityMin: minSim };
    }
    return { status: "consistent", similarityMin: minSim };
  }

  return { status: "na" };
}

export default function SubmissionUserScreen() {
  const params = useLocalSearchParams<{ id?: string; userId?: string }>();
  const projectId = String(params.id ?? "").trim();
  const userId = String(params.userId ?? "").trim();

  const [project, setProject] = useState<LoadedProject | null>(null);
  const [subs, setSubs] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<MainTab>("answers");

  const active = subs[activeIdx] ?? null;

  const attemptsOldestToNewest = useMemo(() => subs.slice().reverse(), [subs]);

  const questions: QuestionDraft[] = useMemo(() => (project as any)?.questions ?? [], [project]);

  const displayName = useMemo(() => {
    const found = subs.find((s) => Boolean((s as any)?.username));
    const u = found ? (found as any)?.username : null;
    return u ? String(u) : `User ${shortId(userId)}`;
  }, [subs, userId]);

  const goBack = () => router.replace((`/submissions/${encodeURIComponent(projectId)}` as any));

  const reload = async () => {
    setLoading(true);
    try {
      await initDb();
      const [p, all] = await Promise.all([loadProject(projectId), listSubmissions(projectId)]);

      const mine = (all ?? [])
        .filter((s) => String((s as any).userId) === userId)
        .sort((a, b) => (Date.parse((b as any).createdAt) || 0) - (Date.parse((a as any).createdAt) || 0));

      setProject(p);
      setSubs(mine);
      setActiveIdx((idx) => Math.min(idx, Math.max(0, mine.length - 1)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setStatus("");
        if (!projectId) {
          setStatus("Missing projectId param.");
          return;
        }
        if (!userId) {
          setStatus("Missing userId param.");
          return;
        }
        await reload();
        if (!alive) return;
      } catch (e: any) {
        if (!alive) return;
        setStatus(String(e?.message ?? e));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, userId]);

  const confirmThen = (run: () => Promise<void>) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const ok = window.confirm("Delete response? This cannot be undone.");
      if (!ok) return;
      void run();
      return;
    }

    Alert.alert("Delete response?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void run() },
    ]);
  };

  const onDeleteActive = () => {
    if (!projectId || !active || deleting) return;

    confirmThen(async () => {
      try {
        setDeleting(true);
        await deleteSubmission(projectId, active.id);
        await reload();
        if (subs.length <= 1) goBack();
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (Platform.OS === "web" && typeof window !== "undefined") window.alert(`Delete failed: ${msg}`);
        else Alert.alert("Delete failed", msg);
      } finally {
        setDeleting(false);
      }
    });
  };

  const perQuestion = useMemo(() => {
    const map = new Map<string, { status: ConsistencyStatus; similarityMin?: number }>();
    for (const q of questions) {
      map.set(q.id, computePerQuestionStatus(q, attemptsOldestToNewest, 0.8));
    }
    return map;
  }, [questions, attemptsOldestToNewest]);

  const longevity = useMemo(() => {
    if (attemptsOldestToNewest.length < 2 || !questions.length) {
      return { available: false, percent: 0, eligible: 0, matched: 0 };
    }

    const eligibleQs = questions.filter(isEligibleForLongevity);
    if (!eligibleQs.length) {
      return { available: false, percent: 0, eligible: 0, matched: 0 };
    }

    let matched = 0;
    for (const q of eligibleQs) {
      const st = perQuestion.get(q.id)?.status ?? "changed";
      if (st === "consistent") matched += 1;
    }

    const eligible = eligibleQs.length;
    const percent = eligible ? Math.round((matched / eligible) * 100) : 0;
    return { available: true, percent, eligible, matched };
  }, [attemptsOldestToNewest.length, questions, perQuestion]);

  const renderConsistencyBadge = (q: QuestionDraft) => {
    const meta = perQuestion.get(q.id) ?? { status: "na" as const };
    if (meta.status === "na") {
      return (
        <View style={[styles.badge, styles.badgeNa]}>
          <Text style={styles.badgeTextNa}>—</Text>
        </View>
      );
    }

    if (meta.status === "consistent") {
      return (
        <View style={[styles.badge, styles.badgeOk]}>
          <Text style={styles.badgeTextOk}>✅</Text>
        </View>
      );
    }

    return (
      <View style={[styles.badge, styles.badgeWarn]}>
        <Text style={styles.badgeTextWarn}>⚠️</Text>
      </View>
    );
  };

  const renderAnswerBlock = (q: QuestionDraft, sub: SubmissionListItem | null, showLongevityBadge: boolean) => {
    const type = String(q?.type ?? "");
    const prompt = String(q?.prompt ?? "") || "Untitled question";

    const header = (
      <View style={styles.previewQHeaderRow}>
        <Text style={styles.previewQTitle}>{prompt}</Text>
        {showLongevityBadge ? renderConsistencyBadge(q) : null}
      </View>
    );

    if (type === "multiple_choice") {
      const opts = (q.options ?? []).map((o: unknown, i: number) => optionLabel(o, i));
      const selected = getAnswer(sub, q);

      return (
        <View style={styles.previewQCard}>
          {header}
          <View style={styles.previewOptions}>
            {opts.map((o, idx) => {
              const isSel = selected === o;

              // ✅ FIX: return JSX (not "return [")
              return (
                <View key={`${idx}:${o}`} style={styles.previewOptionRow}>
                  <View style={[styles.radioOuter, isSel && styles.radioOuterActive]}>
                    {isSel ? <View style={styles.radioInner} /> : null}
                  </View>
                  <Text style={styles.previewOptionText}>{o}</Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    if (type === "color_wheel") {
      const hex = normalizeHex(getAnswer(sub, q));
      return (
        <View style={styles.previewQCard}>
          {header}
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, hex ? { backgroundColor: hex } : styles.colorEmpty]} />
            <Text style={styles.colorText}>{hex || "—"}</Text>
          </View>
        </View>
      );
    }

    const value = String(getAnswer(sub, q) ?? "").trim() || "—";
    return (
      <View style={styles.previewQCard}>
        {header}
        <Text style={styles.previewTextAnswer}>{value}</Text>
      </View>
    );
  };

  const renderAnswersTab = () => {
    if (!active) return null;

    return (
      <View style={styles.whiteCard}>
        <Text style={styles.whiteCardTitle}>Answers</Text>

        <View style={styles.previewOuter}>
          {questions.map((q, i) => (
            <View key={`${active.id}_${q.id}_${i}`} style={styles.previewItem}>
              <Text style={styles.previewNumber}>{i + 1}.</Text>
              <View style={{ flex: 1 }}>{renderAnswerBlock(q, active, false)}</View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderLongevityTab = () => {
    return (
      <View style={styles.whiteCard}>
        <Text style={styles.whiteCardTitle}>Longevity</Text>

        {attemptsOldestToNewest.length < 2 ? (
          <Text style={styles.longevityMuted}>Longevity results cannot be quantified at this time.</Text>
        ) : (
          <View style={styles.longevityTop}>
            <Text style={styles.longevityPercent}>{longevity.percent}% consistent</Text>
            <Text style={styles.longevityMeta}>
              Based on {longevity.matched}/{longevity.eligible} multiple-choice + color question(s)
            </Text>
          </View>
        )}

        <View style={styles.longevityBox}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.longevityRow}>
            {attemptsOldestToNewest.map((s, idx) => {
              const attemptNo = idx + 1;
              return (
                <View key={s.id} style={styles.longevityCol}>
                  <Text style={styles.longevityColTitle}>{`Test ${attemptNo}`}</Text>
                  <Text style={styles.longevityColSub}>{fmtDate((s as any).createdAt)}</Text>

                  <View style={styles.previewOuter}>
                    {questions.map((q, i) => (
                      <View key={`${s.id}_${q.id}_${i}`} style={styles.previewItem}>
                        <Text style={styles.previewNumber}>{i + 1}.</Text>
                        <View style={{ flex: 1 }}>{renderAnswerBlock(q, s, true)}</View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={["#061A40", "#0F766E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.heroHeader}>
          <View style={styles.heroHeaderInner}>
            <View style={styles.heroLeft}>
              <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.heroBackBtn, pressed && styles.pressed]}>
                <Text style={styles.heroBackText}>←</Text>
              </Pressable>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.heroTitleRow}>
                  <Text style={styles.heroTitle}>Synesthete</Text>
                  <Text style={styles.heroEmail}>thetesynes@gmail.com</Text>
                </View>
                <Text style={styles.heroSubtitle}>Submission</Text>
              </View>
            </View>

            <View style={styles.heroRight}>
              <Pressable
                onPress={onDeleteActive}
                style={({ pressed }) => [
                  styles.heroBtn,
                  styles.heroDangerBtn,
                  deleting && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.heroBtnText}>{deleting ? "Deleting…" : "Delete"}</Text>
              </Pressable>

              <Pressable onPress={goBack} style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}>
                <Text style={styles.heroBtnText}>Back</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <Text style={styles.h1}>{project?.title || "Untitled project"}</Text>
            <Text style={styles.help}>{displayName}</Text>
            {active?.createdAt ? <Text style={styles.help}>Attempt: {fmtDate(active.createdAt)}</Text> : null}
            <Text style={styles.help}>Attempts: {subs.length}</Text>
          </View>

          {subs.length > 1 ? (
            <View style={styles.tabBar}>
              {attemptsOldestToNewest.map((s, idx) => {
                const realIdx = subs.length - 1 - idx;
                const isActive = realIdx === activeIdx;
                return (
                  <Pressable key={s.id} onPress={() => setActiveIdx(realIdx)} style={styles.tabItem}>
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{`Test ${idx + 1}`}</Text>
                    <View style={[styles.tabUnderline, isActive && styles.tabUnderlineActive]} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.tabBar2}>
            {[
              { key: "answers" as const, label: "Answers" },
              { key: "longevity" as const, label: "Longevity" },
            ].map((t) => {
              const activeTab = tab === t.key;
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
                  <Text style={[styles.tabText, activeTab && styles.tabTextActive]}>{t.label}</Text>
                  <View style={[styles.tabUnderline, activeTab && styles.tabUnderlineActive]} />
                </Pressable>
              );
            })}
          </View>

          {loading ? <Text style={styles.help}>Loading…</Text> : null}
          {status ? <Text style={styles.help}>Status: {status}</Text> : null}

          {!loading && !active ? (
            <View style={styles.card}>
              <Text style={styles.help}>No submissions for this user.</Text>
            </View>
          ) : null}

          {active ? (tab === "answers" ? renderAnswersTab() : renderLongevityTab()) : null}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },

  container: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
    maxWidth: 980,
    alignSelf: "center",
    width: "100%",
  },

  heroHeader: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  heroHeaderInner: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(38, 83, 108, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  heroLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1, minWidth: 0 },
  heroRight: { flexDirection: "row", alignItems: "center", gap: 12 },

  heroBackBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBackText: { fontSize: 18, fontWeight: "900", color: "#fff", fontFamily: SERIF },

  heroTitleRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 10 },
  heroTitle: { fontSize: 44, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  heroEmail: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    fontFamily: SERIF,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.85)",
  },
  heroSubtitle: { marginTop: 4, fontSize: 18, fontWeight: "900", color: "rgba(255,255,255,0.90)", fontFamily: SERIF },

  heroBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255, 255, 255, 0.20)",
  },
  heroDangerBtn: { borderColor: "rgba(255,180,180,0.35)" },
  heroBtnText: { fontWeight: "900", color: "#fff", fontFamily: SERIF },

  card: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 16,
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.22)",
  },

  h1: { fontSize: 18, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  help: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontFamily: SERIF },

  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.15)" },
  tabBar2: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
    marginTop: -2,
  },
  tabItem: { paddingHorizontal: 12, paddingVertical: 10 },
  tabText: { fontSize: 13, fontWeight: "800", color: "rgba(255,255,255,0.75)", fontFamily: SERIF },
  tabTextActive: { color: "#fff" },
  tabUnderline: { marginTop: 6, height: 3, borderRadius: 999, backgroundColor: "transparent" },
  tabUnderlineActive: { backgroundColor: "rgba(255,255,255,0.9)" },

  whiteCard: {
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 18,
  },
  whiteCardTitle: { fontSize: 20, fontWeight: "900", color: "#111827", marginBottom: 12 },

  previewOuter: {
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 12,
  },
  previewItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  previewNumber: { width: 22, fontWeight: "900", color: "#111827" },

  previewQCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 10,
  },
  previewQHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  previewQTitle: { flex: 1, fontSize: 14, fontWeight: "900", color: "#111827" },

  previewOptions: { gap: 10 },
  previewOptionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  radioOuterActive: { borderColor: "#111827" },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#111827" },
  previewOptionText: { color: "#111827", fontWeight: "700" },

  previewTextAnswer: { color: "#111827", lineHeight: 18 },

  colorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  colorEmpty: { backgroundColor: "#f1f5f9" },
  colorText: { color: "#111827", fontWeight: "800" },

  badge: {
    minWidth: 28,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  badgeWarn: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  badgeNa: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  badgeTextOk: { fontWeight: "900" },
  badgeTextWarn: { fontWeight: "900" },
  badgeTextNa: { fontWeight: "900", color: "#475569" },

  longevityTop: { marginBottom: 14, gap: 6 },
  longevityPercent: { fontSize: 28, fontWeight: "900", color: "#111827" },
  longevityMeta: { color: "#475569", fontWeight: "700" },
  longevityMuted: { color: "#475569", fontWeight: "700", marginBottom: 14 },

  longevityBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 12,
  },
  longevityRow: { gap: 14, paddingRight: 4 },
  longevityCol: { width: 420, maxWidth: 420 },
  longevityColTitle: { fontSize: 16, fontWeight: "900", color: "#111827", marginBottom: 4 },
  longevityColSub: { color: "#64748b", fontWeight: "700", marginBottom: 10 },

  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
});
