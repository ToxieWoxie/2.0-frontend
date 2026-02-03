// FILE: Syn/app/submissions/[id].tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  Linking,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { deleteSubmission, getMyRole, initDb, listSubmissions, loadProject } from "../../lib/db";
import type { LoadedProject, QuestionDraft, SubmissionListItem } from "../../lib/models";
import Svg, { Path, G, Circle } from "react-native-svg";

function fmtDate(raw: string): string {
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : raw;
}

function normalizeHex(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("#") && /^[#][0-9a-f]{6}$/.test(s)) return s;
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  return "";
}

function getAnswer(sub: SubmissionListItem, q: QuestionDraft): string {
  const ansObj: any = (sub as any)?.answers ?? {};
  const v = ansObj?.[q.id];
  if (v === null || v === undefined) return "";
  const s = String(v);
  return q.type === "color_wheel" ? normalizeHex(s) : s;
}

type ModalSpec =
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      onConfirm: () => void;
    }
  | { kind: "info"; title: string; message: string; confirmText?: string; onConfirm?: () => void };

function PopupModal({ spec, onClose }: { spec: ModalSpec | null; onClose: () => void }) {
  if (!spec) return null;

  const confirmText = spec.confirmText ?? (spec.kind === "confirm" ? "Delete" : "OK");
  const cancelText = (spec as any).cancelText ?? "Cancel";

  return (
    <View style={styles.modalOverlay} pointerEvents="auto">
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalCard} accessibilityLabel={spec.title} accessibilityViewIsModal>
        <Text style={styles.modalTitle}>{spec.title}</Text>
        <Text style={styles.modalMsg}>{spec.message}</Text>

        <View style={styles.modalRow}>
          {spec.kind === "confirm" ? (
            <Pressable onPress={onClose} style={({ pressed }) => [styles.modalBtn, pressed && styles.pressed]}>
              <Text style={styles.modalBtnText}>{cancelText}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              onClose();
              spec.onConfirm?.();
            }}
            style={({ pressed }) => [
              styles.modalBtn,
              spec.kind === "confirm" ? styles.modalDangerBtn : null,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.modalBtnText, spec.kind === "confirm" ? styles.modalDangerText : null]}>
              {confirmText}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
  const end = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function PieChart({ labels, counts, size = 160 }: { labels: string[]; counts: number[]; size?: number }) {
  const total = counts.reduce((a, b) => a + b, 0);

  if (total <= 0) {
    return (
      <View style={[styles.pieFallback, { width: size, height: size }]}>
        <Text style={styles.helpText}>No responses</Text>
      </View>
    );
  }

  const ROYGBIV = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#5856d6", "#af52de"];
  const r = size / 2;

  const nonZero = counts.map((v, i) => ({ v, i })).filter((x) => x.v > 0);
  const full = nonZero.length === 1 && nonZero[0].v === total;
  const fullIdx = full ? nonZero[0].i : -1;

  let start = 0;

  return (
    <View style={{ flexDirection: "row", gap: 14 as any, alignItems: "flex-start" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G>
            {full ? (
              <Circle cx={r} cy={r} r={r} fill={ROYGBIV[fullIdx % ROYGBIV.length]} />
            ) : (
              counts.map((c, idx) => {
                if (c <= 0) return null;
                const slice = (c / total) * Math.PI * 2;
                const end = start + slice;
                const d = arcPath(r, r, r, start, end);
                start = end;
                return <Path key={idx} d={d} fill={ROYGBIV[idx % ROYGBIV.length]} />;
              })
            )}
          </G>
        </Svg>
      </View>

      <View style={{ gap: 8, flex: 1 }}>
        {labels.map((label, idx) => (
          <View key={idx} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: ROYGBIV[idx % ROYGBIV.length] }]} />
            <Text style={styles.legendText} numberOfLines={2}>
              {label || "—"}
            </Text>
            <Text style={styles.legendCount}>{counts[idx] ?? 0}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function countMultipleChoice(subs: SubmissionListItem[], q: QuestionDraft) {
  // Match take/preview behavior: fallback labels "Option 1/2/..."
  const opts = (q.options ?? []).map((o, i) => {
    const s = String(o ?? "").trim();
    return s || `Option ${i + 1}`;
  });

  const counts = new Map<string, number>();
  for (const o of opts) counts.set(o, 0);

  for (const s of subs) {
    const a = String(getAnswer(s, q) ?? "").trim();
    if (!a) continue;
    if (!counts.has(a)) counts.set(a, 0);
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }

  const labels = Array.from(counts.keys());
  const values = labels.map((l) => counts.get(l) ?? 0);
  return { labels, values };
}

function countColorWheel(subs: SubmissionListItem[], q: QuestionDraft) {
  const map = new Map<string, number>();
  for (const s of subs) {
    const a = normalizeHex(getAnswer(s, q));
    if (!a) continue;
    map.set(a, (map.get(a) ?? 0) + 1);
  }

  const rows = Array.from(map.entries())
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count);

  return rows.slice(0, 50);
}

function groupTextAnswers(subs: SubmissionListItem[], q: QuestionDraft) {
  const map = new Map<string, number>();
  for (const s of subs) {
    const a = getAnswer(s, q).trim();
    if (!a) continue;
    map.set(a, (map.get(a) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([answer, count]) => ({ answer, count }))
    .sort((a, b) => b.count - a.count);
}

type TabKey = "responses" | "summary" | "questions";

export default function SubmissionsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const projectId = useMemo(() => String(params?.id ?? "").trim(), [params?.id]);

  const [role, setRole] = useState<string | null>(null);
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [subs, setSubs] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalSpec | null>(null);
  const [tab, setTab] = useState<TabKey>("responses");

  const [qIdx, setQIdx] = useState(0);
  const [qPickerOpen, setQPickerOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    await initDb();

    const r = await getMyRole(projectId);
    setRole(r);

    if (r !== "owner") {
      setProject(null);
      setSubs([]);
      setErr("Only the project owner can view results.");
      setLoading(false);
      return;
    }

    const [p, s] = await Promise.all([loadProject(projectId), listSubmissions(projectId)]);
    setProject(p);
    setSubs(s);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? e));
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  useEffect(() => {
    setQIdx(0);
  }, [projectId, project?.questions?.length]);

  const openProject = () => {
    if (!projectId) return;
    router.push({ pathname: "/preview/[id]" as any, params: { id: projectId } } as any);
  };

  const confirm = (spec: Omit<Extract<ModalSpec, { kind: "confirm" }>, "kind">) =>
    setModal({ kind: "confirm", ...spec });
  const info = (title: string, message: string) => setModal({ kind: "info", title, message });

  const onDeleteSubmission = (submissionId: string) => {
    if (!projectId) return;
    if (deletingId) return;

    confirm({
      title: "Delete response?",
      message: "This cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          setDeletingId(submissionId);
          await deleteSubmission(projectId, submissionId);
          await refresh();
        } catch (e: any) {
          info("Delete failed", String(e?.message ?? e));
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const groupedResponses = useMemo(() => {
    if (!project) return [];

    if (!(project as any)?.recordUserEnabled) {
      return subs
        .slice()
        .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
        .map((s) => ({
          key: s.id,
          kind: "single" as const,
          userId: String((s as any).userId ?? ""),
          username: (s as any).username ?? null,
          attempts: 1,
          latest: s,
        }));
    }

    const map = new Map<string, SubmissionListItem[]>();
    for (const s of subs) {
      const uid = String((s as any).userId ?? "");
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid)!.push(s);
    }

    const rows = Array.from(map.entries()).map(([uid, arr]) => {
      const sorted = arr.slice().sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
      const username = sorted.find((x) => Boolean((x as any).username))
        ? (sorted.find((x) => Boolean((x as any).username)) as any).username
        : null;
      return {
        key: uid,
        kind: "user" as const,
        userId: uid,
        username: username ? String(username) : null,
        attempts: sorted.length,
        latest: sorted[0],
      };
    });

    rows.sort((a, b) => (Date.parse(b.latest.createdAt) || 0) - (Date.parse(a.latest.createdAt) || 0));
    return rows;
  }, [project, subs]);

  const summaries = useMemo(() => {
    if (!project) return [];

    return (project.questions ?? []).map((q) => {
      if (q.type === "multiple_choice") {
        const { labels, values } = countMultipleChoice(subs, q);
        return { q, kind: "pie" as const, labels, values };
      }

      if (q.type === "color_wheel") {
        const swatches = countColorWheel(subs, q);
        return { q, kind: "swatches" as const, swatches };
      }

      const rows = groupTextAnswers(subs, q);
      return { q, kind: "text" as const, rows, total: subs.length };
    });
  }, [project, subs]);

  const activeQuestion = useMemo(() => {
    const qs = project?.questions ?? [];
    if (!qs.length) return null;
    const idx = Math.max(0, Math.min(qIdx, qs.length - 1));
    return { q: qs[idx], idx, total: qs.length };
  }, [project?.questions, qIdx]);

  const renderResponsesTab = () => {
    if (!project) return null;

    return (
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Responses</Text>
          <Text style={styles.helpText}>{subs.length} total</Text>
        </View>

        {groupedResponses.length === 0 ? <Text style={styles.helpText}>No submissions yet.</Text> : null}

        {groupedResponses.map((row) => {
          const latest = row.latest;
          const label =
            row.kind === "user"
              ? row.username
                ? `${row.username}`
                : `User ${String(row.userId).slice(0, 6)}`
              : `User ${String((latest as any).userId ?? "").slice(0, 6)}`;

          return (
            <View key={row.key} style={styles.responseRowCard}>
              <View style={styles.responseTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.responseTitle} numberOfLines={1}>
                    {fmtDate(latest.createdAt)} • {label}
                  </Text>
                  {row.kind === "user" ? <Text style={styles.helpText}>{row.attempts} attempt(s)</Text> : null}
                </View>

                <Pressable
                  onPress={() => onDeleteSubmission(latest.id)}
                  disabled={deletingId === latest.id}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    deletingId === latest.id && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.deleteBtnText}>
                    {deletingId === latest.id ? "Deleting…" : "Delete"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  if (row.kind === "user" && (project as any)?.recordUserEnabled) {
                    router.push({
                      pathname: "/submissions/[id]/[userId]" as any,
                      params: { id: projectId, userId: row.userId },
                    } as any);
                    return;
                  }
                  router.push({
                    pathname: "/submissions/[id]/[userId]" as any,
                    params: { id: projectId, userId: String((latest as any).userId ?? "") },
                  } as any);
                }}
                style={({ pressed }) => [styles.viewBtn, pressed && styles.pressed]}
              >
                <Text style={styles.viewBtnText}>View</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };

  const renderSummaryTab = () => {
    if (!project) return null;

    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Summary</Text>

        {(summaries ?? []).map((s) => (
          <View key={s.q.id} style={styles.summaryBlock}>
            <View style={styles.qHeaderRow}>
              <Text style={styles.qPrompt} numberOfLines={3}>
                {s.q.prompt || "Untitled question"}
              </Text>
              {s.q.required ? <Text style={styles.requiredStar}>*</Text> : null}
            </View>

            {s.kind === "pie" ? <PieChart labels={s.labels} counts={s.values} size={160} /> : null}

            {s.kind === "swatches" ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchStrip}>
                {s.swatches.map((x) => (
                  <View key={`${x.hex || "none"}:${x.count}`} style={styles.swatchMini}>
                    <View style={[styles.swatchMiniBox, x.hex ? { backgroundColor: x.hex } : styles.swatchEmpty]} />
                    <Text style={styles.swatchMiniText} numberOfLines={1}>
                      {x.hex || "—"}
                    </Text>
                    <Text style={styles.swatchMiniCount}>{x.count}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {s.kind === "text" ? (
              <View style={{ gap: 10, marginTop: 10 }}>
                <Text style={styles.helpText}>{(s.rows ?? []).reduce((acc, r) => acc + r.count, 0)} responses</Text>
                {(s.rows ?? []).slice(0, 10).map((r, idx) => (
                  <View key={`${idx}:${r.answer}`} style={styles.textRespCard}>
                    <Text style={styles.textResp}>{r.answer}</Text>
                    <Text style={styles.textRespCount}>{r.count}</Text>
                  </View>
                ))}
                {(s.rows ?? []).length > 10 ? <Text style={styles.helpText}>+ more…</Text> : null}
              </View>
            ) : null}
          </View>
        ))}
      </View>
    );
  };

  const renderQuestionsTab = () => {
    if (!project) return null;

    const qs = project.questions ?? [];
    if (!qs.length) {
      return (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Questions</Text>
          <Text style={styles.helpText}>No questions in this project.</Text>
        </View>
      );
    }

    const aq = activeQuestion!;
    const q = aq.q;

    const goPrev = () => setQIdx((i) => Math.max(0, i - 1));
    const goNext = () => setQIdx((i) => Math.min(qs.length - 1, i + 1));

    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Questions</Text>

        <View style={styles.qNavRow}>
          <Pressable
            onPress={goPrev}
            disabled={aq.idx <= 0}
            style={({ pressed }) => [styles.navBtn, aq.idx <= 0 && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>

          <Pressable onPress={() => setQPickerOpen(true)} style={({ pressed }) => [styles.qSelect, pressed && styles.pressed]}>
            <Text style={styles.qSelectText} numberOfLines={1}>
              {q.prompt || "Untitled question"}
            </Text>
          </Pressable>

          <Text style={styles.qNavCount}>
            {aq.idx + 1} of {aq.total}
          </Text>

          <Pressable
            onPress={goNext}
            disabled={aq.idx >= aq.total - 1}
            style={({ pressed }) => [styles.navBtn, aq.idx >= aq.total - 1 && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.summaryBlock}>
          <View style={styles.qHeaderRow}>
            <Text style={styles.qPrompt} numberOfLines={4}>
              {q.prompt || "Untitled question"}
            </Text>
            {q.required ? <Text style={styles.requiredStar}>*</Text> : null}
          </View>

          {q.type === "multiple_choice" ? (
            (() => {
              const { labels, values } = countMultipleChoice(subs, q);
              return <PieChart labels={labels} counts={values} size={180} />;
            })()
          ) : q.type === "color_wheel" ? (
            (() => {
              const swatches = countColorWheel(subs, q);
              return (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchStrip}>
                  {swatches.map((x) => (
                    <View key={`${x.hex || "none"}:${x.count}`} style={styles.swatchMini}>
                      <View style={[styles.swatchMiniBox, x.hex ? { backgroundColor: x.hex } : styles.swatchEmpty]} />
                      <Text style={styles.swatchMiniText} numberOfLines={1}>
                        {x.hex || "—"}
                      </Text>
                      <Text style={styles.swatchMiniCount}>{x.count}</Text>
                    </View>
                  ))}
                </ScrollView>
              );
            })()
          ) : (
            (() => {
              const rows = groupTextAnswers(subs, q);
              const total = rows.reduce((a, b) => a + b.count, 0);
              return (
                <View style={{ gap: 10, marginTop: 10 }}>
                  <Text style={styles.helpText}>{total} responses</Text>
                  <View style={{ gap: 10 }}>
                    {rows.map((r, idx) => (
                      <View key={`${idx}:${r.answer}`} style={styles.longAnswerCard}>
                        <Text style={styles.longAnswerText}>{r.answer}</Text>
                        <Text style={styles.longAnswerCount}>{r.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()
          )}
        </View>

        <Modal visible={qPickerOpen} transparent animationType="fade" onRequestClose={() => setQPickerOpen(false)}>
          <View style={styles.modalOverlay} pointerEvents="auto">
            <Pressable style={styles.modalBackdrop} onPress={() => setQPickerOpen(false)} />
            <View style={[styles.modalCard, { maxHeight: "70%", width: "92%" }]} accessibilityViewIsModal>
              <Text style={styles.modalTitle}>Choose a question</Text>
              <ScrollView contentContainerStyle={{ gap: 10 }}>
                {qs.map((qq, idx) => (
                  <Pressable
                    key={qq.id}
                    onPress={() => {
                      setQIdx(idx);
                      setQPickerOpen(false);
                    }}
                    style={({ pressed }) => [styles.qPickItem, idx === aq.idx && styles.qPickItemActive, pressed && styles.pressed]}
                  >
                    <Text style={styles.qPickText} numberOfLines={2}>
                      {qq.prompt || "Untitled question"}
                    </Text>
                    <Text style={styles.helpText}>
                      {idx + 1}/{qs.length} • {qq.type}
                      {qq.required ? " • required" : ""}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  const renderTabBody = () => {
    if (!project) return null;
    if (tab === "responses") return renderResponsesTab();
    if (tab === "summary") return renderSummaryTab();
    return renderQuestionsTab();
  };

  return (
    <LinearGradient
      colors={["#061A40", "#0F766E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.heroHeader}>
          <View style={styles.heroHeaderInner}>
            <View style={styles.heroTitleRow}>
              <Text style={styles.heroTitle}>
                Synesthete{" "}
                <Text
                  style={styles.heroEmail}
                  onPress={() => Linking.openURL("mailto:thetesynes@gmail.com")}
                >
                  thetesynes@gmail.com
                </Text>
              </Text>
            </View>

            <Text style={styles.heroSubtitle}>Results</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          {loading ? <Text style={styles.helpText}>Loading…</Text> : null}

          {err ? (
            <View style={styles.card}>
              <Text style={styles.errorText}>{err}</Text>
              <View style={styles.row}>
                <Pressable onPress={openProject} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
                  <Text style={styles.btnText}>View Project</Text>
                </Pressable>
                <Pressable onPress={() => void refresh()} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
                  <Text style={styles.btnText}>Refresh</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {project ? (
            <View style={styles.card}>
              <Text style={styles.title}>{project.title || "Untitled Project"}</Text>
              <Text style={styles.helpText}>{subs.length} submission(s)</Text>
              <Text style={styles.helpText}>Role: {role ?? "unknown"}</Text>
            </View>
          ) : null}

          {project ? (
            <View style={styles.tabBar}>
              {[
                { key: "responses" as const, label: "Responses" },
                { key: "summary" as const, label: "Summary" },
                { key: "questions" as const, label: "Question" },
              ].map((t) => {
                const active = tab === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                    <View style={[styles.tabUnderline, active && styles.tabUnderlineActive]} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {project ? renderTabBody() : null}

          <View style={{ height: 24 }} />
        </ScrollView>

        <PopupModal spec={modal} onClose={() => setModal(null)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },

  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  heroHeaderInner: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: "rgba(38, 83, 108, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 10,
  },
  heroTitle: { fontSize: 44, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  heroEmail: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    fontFamily: SERIF,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.85)",
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "900",
    color: "rgba(255,255,255,0.90)",
    fontFamily: SERIF,
  },

  container: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },

  card: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.22)",
    gap: 10,
  },

  title: { fontSize: 18, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#fff", fontFamily: SERIF },

  helpText: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontFamily: SERIF },
  errorText: { color: "#ffd1d1", fontWeight: "800", fontFamily: SERIF },

  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  btnText: { fontWeight: "900", color: "#fff", fontFamily: SERIF },
  pressed: { opacity: 0.75 },

  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.15)" },
  tabItem: { paddingHorizontal: 12, paddingVertical: 10 },
  tabText: { fontSize: 13, fontWeight: "800", color: "rgba(255,255,255,0.75)", fontFamily: SERIF },
  tabTextActive: { color: "#fff" },
  tabUnderline: { marginTop: 6, height: 3, borderRadius: 999, backgroundColor: "transparent" },
  tabUnderlineActive: { backgroundColor: "rgba(255,255,255,0.9)" },

  summaryBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: 10,
    gap: 10,
  },

  qHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  qPrompt: { flex: 1, fontSize: 14, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  requiredStar: { fontSize: 18, fontWeight: "900", color: "#ffd1d1", marginLeft: 6, fontFamily: SERIF },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  responseRowCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 12,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  responseTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  responseTitle: { fontSize: 12, fontWeight: "900", color: "#fff", fontFamily: SERIF },

  deleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,180,180,0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.20)",
  },
  deleteBtnText: { fontWeight: "900", color: "#ffd1d1", fontFamily: SERIF },

  viewBtn: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255, 255, 255, 0.20)",
  },
  viewBtnText: { fontWeight: "900", color: "#fff", fontFamily: SERIF },

  disabled: { opacity: 0.55 },

  pieFallback: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 999 },
  legendText: { flex: 1, fontSize: 12, color: "#fff", fontWeight: "800", fontFamily: SERIF },
  legendCount: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "900", fontFamily: SERIF },

  textRespCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  textResp: { flex: 1, fontSize: 13, color: "#fff", fontFamily: SERIF },
  textRespCount: { fontSize: 12, fontWeight: "900", color: "rgba(255,255,255,0.85)", fontFamily: SERIF },

  swatchStrip: { gap: 10, paddingVertical: 6 },
  swatchMini: { width: 84, gap: 4 },
  swatchMiniBox: { width: 84, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  swatchEmpty: { backgroundColor: "rgba(255,255,255,0.10)" },
  swatchMiniText: { fontSize: 11, fontWeight: "800", color: "#fff", fontFamily: SERIF },
  swatchMiniCount: { fontSize: 11, fontWeight: "900", color: "rgba(255,255,255,0.85)", fontFamily: SERIF },

  qNavRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255, 255, 255, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: { fontSize: 18, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  qSelect: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  qSelectText: { fontSize: 12, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  qNavCount: { fontSize: 12, fontWeight: "900", color: "rgba(255,255,255,0.78)", fontFamily: SERIF },

  longAnswerCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  longAnswerText: { flex: 1, fontSize: 13, color: "#fff", lineHeight: 18, fontFamily: SERIF },
  longAnswerCount: { fontSize: 12, fontWeight: "900", color: "rgba(255,255,255,0.85)", fontFamily: SERIF },

  qPickItem: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12, backgroundColor: "#fff", gap: 6 },
  qPickItemActive: { backgroundColor: "#faf5ff", borderColor: "#d9d6ff" },
  qPickText: { fontSize: 13, fontWeight: "900", color: "#111827" },

  modalOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "center", alignItems: "center" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  modalCard: { width: "90%", maxWidth: 420, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff", gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  modalMsg: { fontSize: 13, color: "#374151", lineHeight: 18 },
  modalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f3f4f6" },
  modalBtnText: { fontWeight: "900", color: "#111827" },
  modalDangerBtn: { borderColor: "#f1b6b6", backgroundColor: "#fff5f5" },
  modalDangerText: { color: "#b00020" },
});

