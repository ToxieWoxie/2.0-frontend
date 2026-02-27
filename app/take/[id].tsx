// FILE: Syn/app/take/[id].tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image as RNImage } from "react-native";

import { BackButtonBar } from "../../components/BackButtonBar";
import { getCurrentUser } from "../../lib/auth";
import { getMyRole, initDb, loadProject, resolvePublicUrl, submitAnswers } from "../../lib/db";
import type { AnswerMap, LoadedProject, QuestionDraft } from "../../lib/models";

const WebImg: any = Platform.OS === "web" ? ("img" as any) : null;
const WebDiv: any = Platform.OS === "web" ? ("div" as any) : null;
const tabularNumsStyle: any = Platform.OS === "web" ? { fontVariantNumeric: "tabular-nums" } : null;

const SERIF = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "serif",
});

function isAuthError(e: any): boolean {
  const msg = String(e?.message ?? e ?? "").toLowerCase();
  return msg.includes("not authenticated") || msg.includes("unauthorized") || msg.includes("401") || msg.includes("permission denied");
}

function AuthRequiredScreen(props: { onLogin: () => void; onBack: () => void }) {
  return (
    <LinearGradient colors={["#061A40", "#0F766E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={stylesAuth.screen}>
      <ScrollView style={stylesAuth.scrollView} contentContainerStyle={stylesAuth.scrollContent} showsVerticalScrollIndicator>
        <View style={stylesAuth.header}>
          <Text style={stylesAuth.title}>Synesthete</Text>
          <View style={stylesAuth.topButtons}>
            <Pressable
              onPress={props.onLogin}
              style={({ pressed }) => [stylesAuth.buttonPrimary, pressed && stylesAuth.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Log in"
            >
              <Text style={stylesAuth.buttonText}>Log In</Text>
            </Pressable>
          </View>
        </View>

        <View style={stylesAuth.bodyWrap}>
          <Text style={stylesAuth.h1}>Login required</Text>
          <Text style={stylesAuth.p}>You need to be logged in to take this quiz.</Text>

          <View style={stylesAuth.actions}>
            <Pressable
              onPress={props.onLogin}
              style={({ pressed }) => [stylesAuth.buttonPrimary, pressed && stylesAuth.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Go to login"
            >
              <Text style={stylesAuth.buttonText}>Go to Login</Text>
            </Pressable>

            <Pressable
              onPress={props.onBack}
              style={({ pressed }) => [stylesAuth.buttonDark, pressed && stylesAuth.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={stylesAuth.buttonText}>Go Back</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </LinearGradient>
  );
}

function CheckboxRow(props: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <Pressable
      onPress={() => props.onChange(!props.value)}
      style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.value }}
      accessibilityLabel={props.label}
    >
      <View style={[styles.checkboxBox, props.value && styles.checkboxBoxOn]}>{props.value ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
      <Text style={styles.checkboxLabel}>{props.label}</Text>
    </Pressable>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function normalizeHex(v: string): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  if (s.startsWith("#")) return s.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return s.toLowerCase();
}

function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(normalizeHex(v));
}

const PRESET = ["#cbbfb8", "#1f1a17", "#d8a2e5", "#9fd0eb", "#a8db9a"];

function WebColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  if (Platform.OS !== "web") return null;

  const safe = isValidHex(value) ? normalizeHex(value) : "#66072c";

  return React.createElement("input" as any, {
    type: "color",
    value: safe,
    onChange: (e: any) => onChange(String(e?.target?.value ?? safe)),
    style: { width: 56, height: 40, border: "none", background: "transparent", padding: 0 },
    "aria-label": "Pick color",
  });
}

function ResponsiveImage({ uri }: { uri: string }) {
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    if (!uri) return;
    if (Platform.OS === "web") return;

    let alive = true;
    RNImage.getSize(
      uri,
      (w, h) => {
        if (!alive) return;
        if (w > 0 && h > 0) setAspect(w / h);
      },
      () => {
        if (!alive) return;
        setAspect(null);
      }
    );

    return () => {
      alive = false;
    };
  }, [uri]);

  if (Platform.OS === "web" && WebImg && WebDiv) {
    return (
      <View style={{ marginTop: 10 }}>
        {React.createElement(WebDiv, {
          style: { display: "flex", justifyContent: "flex-start", alignItems: "flex-start" },
          children: React.createElement(WebImg, {
            src: uri,
            alt: "",
            style: {
              display: "block",
              maxWidth: "100%",
              width: "auto",
              height: "auto",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            },
          }),
        })}
      </View>
    );
  }

  return (
    <View style={{ marginTop: 10 }}>
      <RNImage source={{ uri }} style={[styles.qImageNative, aspect ? { aspectRatio: aspect, height: undefined } : null]} resizeMode="contain" />
    </View>
  );
}

function WebAudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<any>(null);
  const rafRef = useRef<any>(null);

  const stopRaf = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const tick = () => {
    const a = audioRef.current;
    if (a) setCurrent(a.currentTime || 0);
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const a = new Audio(src);
    audioRef.current = a;

    const onLoaded = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onPlay = () => {
      setPlaying(true);
      stopRaf();
      rafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      stopRaf();
    };
    const onEnded = () => {
      setPlaying(false);
      stopRaf();
      setCurrent(a.duration || 0);
    };
    const onTime = () => setCurrent(a.currentTime || 0);

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTime);

    return () => {
      stopRaf();
      a.pause();
      a.src = "";
      audioRef.current = null;
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTime);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  };

  const pct = duration > 0 ? clamp(current / duration, 0, 1) : 0;

  return (
    <View style={{ marginTop: 10, gap: 10 }}>
      <Pressable onPress={toggle} style={({ pressed }) => [styles.btnSmall, pressed && styles.pressed]}>
        <Text style={styles.btnSmallText}>{playing ? "Pause audio" : "Play audio"}</Text>
      </Pressable>

      <View style={{ gap: 6 }}>
        <View style={styles.audioMetaRow}>
          <Text style={styles.audioMetaText}>{formatTime(current)}</Text>
          <Text style={styles.audioMetaText}>{formatTime(duration)}</Text>
        </View>
        <View style={styles.audioBarOuter}>
          {React.createElement(WebDiv, {
            style: {
              width: `${Math.round(pct * 100)}%`,
              height: "100%",
              background: "#9ca3af",
            },
          })}
        </View>
      </View>
    </View>
  );
}

export default function TakeScreen() {
  const { id, assessmentDone } = useLocalSearchParams<{ id: string; assessmentDone?: string }>();

  const [project, setProject] = useState<LoadedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recordConsent, setRecordConsent] = useState(false);
  const [meUsername, setMeUsername] = useState<string>("");

  const [authRequired, setAuthRequired] = useState(false);
  const [loadErr, setLoadErr] = useState<string>("");

  useEffect(() => {
    initDb().catch(() => {});
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setMeUsername(String((u as any)?.username ?? "")))
      .catch(() => setMeUsername(""));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setAuthRequired(false);
        setLoadErr("");

        const p = await loadProject(id);
        if (!mounted) return;

        setProject(p);
      } catch (e: any) {
        if (!mounted) return;

        if (isAuthError(e)) {
          setAuthRequired(true);
          setProject(null);
          return;
        }

        setLoadErr(String(e?.message ?? e));
        setProject(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    getMyRole(id).catch(() => {});
  }, [id]);

  const title = useMemo(() => project?.title ?? "Take", [project?.title]);

  const assessmentRequired = Boolean((project as any)?.includeAssessment);
  const hasCompletedAssessment = String(assessmentDone ?? "") === "1";

  // ✅ PATCH: go to your real assessment route (/assessment/[id])
  const goToAssessment = useCallback(() => {
    const returnTo = `/take/${encodeURIComponent(id)}`;
    router.replace((`/assessment/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(returnTo)}` as any));
  }, [id]);

  const setAnswer = useCallback((qId: string, v: string) => setAnswers((m) => ({ ...m, [qId]: v })), []);

  const missingRequired = useMemo(() => {
    if (!project) return [];
    const missing: string[] = [];
    for (const q of project.questions ?? []) {
      if (!q.required) continue;
      const v = String(answers[q.id] ?? "").trim();
      if (!v) missing.push(q.prompt || "Untitled question");
    }
    return missing;
  }, [answers, project]);

  const onSubmit = useCallback(async () => {
    if (!project) return;

    if (project.recordUserEnabled && !recordConsent) {
      Alert.alert("Consent required", "You must allow recording the user to submit this quiz.");
      return;
    }

    if (missingRequired.length) {
      Alert.alert("Missing required answers", missingRequired.slice(0, 6).join("\n"));
      return;
    }

    try {
      setSubmitting(true);
      const payload: AnswerMap = {};
      for (const q of project.questions ?? []) {
        const raw = String(answers[q.id] ?? "");
        payload[q.id] = q.type === "color_wheel" ? normalizeHex(raw) : raw;
      }

      await submitAnswers(project.id, payload, { recordUserConsent: recordConsent });
      Alert.alert("Submitted", "Your answers were submitted.");
      router.replace("/library");
    } catch (e: any) {
      Alert.alert("Submit failed", String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  }, [answers, missingRequired, project, recordConsent]);

  if (authRequired) {
    return <AuthRequiredScreen onLogin={() => router.replace("/login")} onBack={() => router.back()} />;
  }

  if (loading) {
    return (
      <LinearGradient colors={["#ffffff", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!project) {
    return (
      <LinearGradient colors={["#ffffff", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>Could not load quiz.</Text>
            {loadErr ? <Text style={styles.subtle}>{loadErr}</Text> : null}
            <Pressable onPress={() => router.replace("/library")} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
              <Text style={styles.submitButtonText}>Back to library</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ✅ existing gate behavior preserved (now routes correctly)
  if (assessmentRequired && !hasCompletedAssessment) {
    return (
      <LinearGradient colors={["#ffffff", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={{ flex: 1 }}>
              <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.btnSmall, pressed && styles.pressed]}>
                    <Text style={styles.btnSmallText}>Back</Text>
                  </Pressable>
                </View>

                {project.description ? <Text style={styles.description}>{project.description}</Text> : null}

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Assessment required</Text>
                  <Text style={styles.paragraph}>
                    The test administrator has enabled a required assessment. Please complete the assessment before you can proceed to the quiz.
                  </Text>

                  <Pressable onPress={goToAssessment} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
                    <Text style={styles.submitButtonText}>Begin Assessment</Text>
                  </Pressable>
                </View>

                <View style={{ height: 120 }} />
              </ScrollView>

              <BackButtonBar />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#ffffff", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flex: 1 }}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.btnSmall, pressed && styles.pressed]}>
                  <Text style={styles.btnSmallText}>Back</Text>
                </Pressable>
              </View>

              {project.description ? <Text style={styles.description}>{project.description}</Text> : null}

              {project.recordUserEnabled ? (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Recording consent</Text>
                  <Text style={styles.paragraph}>This quiz records the user. You must provide consent to submit.</Text>

                  <View style={{ marginTop: 10 }}>
                    <CheckboxRow label="Allow to record user" value={recordConsent} onChange={setRecordConsent} />
                    {recordConsent && meUsername ? <Text style={styles.subtle}>Username: {meUsername}</Text> : null}
                  </View>
                </View>
              ) : null}

              <View style={{ height: 8 }} />

              {project.questions.map((q, idx) => (
                <Question key={q.id} q={q} index={idx} value={String(answers[q.id] ?? "")} onChange={(v) => setAnswer(q.id, v)} />
              ))}

              <Pressable
                onPress={onSubmit}
                disabled={submitting || (project?.recordUserEnabled && !recordConsent)}
                style={({ pressed }) => [styles.submitButton, submitting && styles.disabled, pressed && !submitting && styles.pressed]}
              >
                <Text style={styles.submitButtonText}>{submitting ? "Submitting…" : "Submit"}</Text>
              </Pressable>

              <View style={{ height: 120 }} />
            </ScrollView>

            <BackButtonBar />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Question({ q, index, value, onChange }: { q: QuestionDraft; index: number; value: string; onChange: (v: string) => void }) {
  const img = q.imageUrl ? resolvePublicUrl(q.imageUrl) : "";
  const audio = q.audioUrl ? resolvePublicUrl(q.audioUrl) : "";

  const openAudio = useCallback(async () => {
    if (!audio) return;
    try {
      await Linking.openURL(audio);
    } catch {
      Alert.alert("Can't open audio", audio);
    }
  }, [audio]);

  return (
    <View style={styles.card}>
      <View style={styles.qHeaderRow}>
        <Text style={styles.sectionTitle}>
          <Text style={tabularNumsStyle}>
            {index + 1}
            {q.required ? "*" : ""}.
          </Text>{" "}
          {q.prompt || "Untitled question"}
        </Text>
      </View>

      {img ? <ResponsiveImage uri={img} /> : null}

      {audio ? (
        Platform.OS === "web" ? (
          <WebAudioPlayer src={audio} />
        ) : (
          <Pressable onPress={openAudio} style={({ pressed }) => [styles.btnSmall, pressed && styles.pressed]}>
            <Text style={styles.btnSmallText}>Open audio</Text>
          </Pressable>
        )
      ) : null}

      {q.type === "short_answer" ? (
        <TextInput value={value} onChangeText={onChange} placeholder="Short answer…" placeholderTextColor="#9ca3af" style={styles.input} />
      ) : q.type === "long_answer" ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Long answer…"
          placeholderTextColor="#9ca3af"
          style={[styles.input, styles.longInput]}
          multiline
        />
      ) : q.type === "multiple_choice" ? (
        <View style={{ gap: 12 }}>
          {(q.options ?? []).map((opt, i) => {
            const label = String(opt || `Option ${i + 1}`);
            const picked = value === label;

            return (
              <Pressable
                key={`${q.id}_${i}`}
                onPress={() => onChange(label)}
                style={({ pressed }) => [styles.choiceRow, picked && styles.choiceRowOn, pressed && styles.pressed]}
              >
                <View style={[styles.choiceDot, picked && styles.choiceDotOn]} />
                <Text style={styles.choiceText}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : q.type === "color_wheel" ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <View style={[styles.colorSwatch, { backgroundColor: isValidHex(value) ? normalizeHex(value) : "#ffffff" }]} />
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder="#RRGGBB"
              placeholderTextColor="#9ca3af"
              style={[styles.input, { flex: 1, minWidth: 180 }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <WebColorPicker value={value} onChange={onChange} />
          </View>

          <View style={styles.presetRow}>
            {PRESET.map((hex) => {
              const active = normalizeHex(value) === normalizeHex(hex);
              return (
                <Pressable
                  key={hex}
                  onPress={() => onChange(hex)}
                  style={({ pressed }) => [styles.presetDot, { backgroundColor: hex }, active && styles.presetDotOn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Preset color ${hex}`}
                />
              );
            })}
          </View>

          <Text style={styles.subtle}>Enter a hex color (e.g., #ff8800).</Text>
        </View>
      ) : (
        <Text style={styles.subtle}>Unsupported question type: {String((q as any)?.type ?? "")}</Text>
      )}
    </View>
  );
}

const stylesAuth = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 40, paddingBottom: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", rowGap: 10 },
  title: { fontSize: 40, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  topButtons: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  buttonPrimary: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    cursor: Platform.OS === "web" ? "pointer" : "auto",
  },
  buttonDark: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    cursor: Platform.OS === "web" ? "pointer" : "auto",
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontFamily: SERIF },
  pressed: { opacity: 0.75 },
  bodyWrap: { marginTop: 20, backgroundColor: "rgba(38, 83, 108, 0.62)", borderRadius: 14, padding: 16 },
  h1: { fontSize: 26, fontWeight: "900", color: "#fff", fontFamily: SERIF },
  p: { marginTop: 10, color: "rgba(255,255,255,0.9)", lineHeight: 22 },
  actions: { marginTop: 16, flexDirection: "row", gap: 12, flexWrap: "wrap" },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },

  scrollView: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 120, maxWidth: 920, alignSelf: "center", width: "100%" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontWeight: "900", color: "#0b2545" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  title: { fontSize: 34, fontWeight: "900", color: "#0b2545", fontFamily: SERIF, flexShrink: 1, minWidth: 0 },
  description: { color: "#374151", lineHeight: 22, marginTop: 10 },

  subtle: { color: "#6b7280", marginTop: 8 },

  card: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },

  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#0b2545", fontFamily: SERIF },
  paragraph: { color: "#1f2937", lineHeight: 22 },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    backgroundColor: "#fff",
  },
  longInput: { minHeight: 110, textAlignVertical: "top" },

  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  choiceRowOn: { borderColor: "#0F766E" },
  choiceDot: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, borderColor: "#9ca3af" },
  choiceDotOn: { borderColor: "#0F766E" },
  choiceText: { color: "#111827" },

  colorSwatch: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: "#d1d5db" },
  presetRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  presetDot: { width: 28, height: 28, borderRadius: 999, borderWidth: 2, borderColor: "rgba(0,0,0,0.08)" },
  presetDotOn: { borderColor: "#0F766E" },

  qImageNative: { width: "100%", height: 220, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb" },

  btnSmall: {
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.25)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(15, 118, 110, 0.08)",
  },
  btnSmallText: { color: "#0b2545", fontWeight: "900", fontFamily: SERIF },

  submitButton: { marginTop: 16, borderRadius: 14, backgroundColor: "#0b2545", alignItems: "center", paddingVertical: 14 },
  submitButtonText: { color: "#fff", fontWeight: "900", fontFamily: SERIF, fontSize: 16 },

  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.8 },

  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkboxBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: "#9ca3af", alignItems: "center", justifyContent: "center" },
  checkboxBoxOn: { borderColor: "#0F766E" },
  checkboxMark: { fontWeight: "900", color: "#0F766E" },
  checkboxLabel: { color: "#111827" },

  qHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },

  audioMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  audioMetaText: { color: "#6b7280", fontFamily: SERIF },
  audioBarOuter: { width: "100%", height: 10, borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: "#e5e7eb" },
});
