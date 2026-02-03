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
  return (
    msg.includes("not authenticated") ||
    msg.includes("unauthorized") ||
    msg.includes("401") ||
    msg.includes("permission denied")
  );
}

function AuthRequiredScreen(props: { onLogin: () => void; onBack: () => void }) {
  return (
    <LinearGradient
      colors={["#061A40", "#0F766E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={stylesAuth.screen}
    >
      <ScrollView
        style={stylesAuth.scrollView}
        contentContainerStyle={stylesAuth.scrollContent}
        showsVerticalScrollIndicator
      >
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
          <Text style={stylesAuth.p}>
            You need to be logged in to take this quiz.
          </Text>

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
      <View style={[styles.checkboxBox, props.value && styles.checkboxBoxOn]}>
        {props.value ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
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
      <RNImage
        source={{ uri }}
        style={[styles.qImageNative, aspect ? { aspectRatio: aspect, height: undefined } : null]}
        resizeMode="contain"
      />
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
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTime);
      audioRef.current = null;
    };
  }, [src]);

  if (Platform.OS !== "web" || !WebDiv) return null;

  const pct = duration > 0 ? clamp(current / duration, 0, 1) : 0;

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) await a.play();
    else a.pause();
  };

  const seek = (e: any) => {
    const a = audioRef.current;
    if (!a || duration <= 0) return;

    const rect = e?.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;

    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    a.currentTime = x * duration;
    setCurrent(a.currentTime);
  };

  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 as any }}>
        <Pressable onPress={() => void toggle()} style={({ pressed }) => [styles.btnSm, pressed && styles.pressed]}>
          <Text style={styles.btnSmText}>{playing ? "Pause" : "Play"}</Text>
        </Pressable>

        <Text style={[styles.timeText, tabularNumsStyle] as any}>
          {formatTime(current)} / {formatTime(duration)}
        </Text>
      </View>

      {React.createElement(WebDiv, {
        role: "progressbar",
        "aria-valuemin": 0,
        "aria-valuemax": duration || 0,
        "aria-valuenow": current || 0,
        onClick: seek,
        style: {
          marginTop: 10,
          height: 12,
          borderRadius: 999,
          background: "#f3f4f6",
          overflow: "hidden",
          cursor: duration > 0 ? "pointer" : "default",
          border: "1px solid #e5e7eb",
        },
        children: React.createElement(WebDiv, {
          style: {
            height: "100%",
            width: `${Math.round(pct * 100)}%`,
            background: "#9ca3af",
          },
        }),
      })}
    </View>
  );
}

export default function TakeScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = String(params.id ?? "");

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

  const goLogin = () => router.replace(("/login" as any) ?? ("/login" as any));
  const goBack = () => router.back();

  if (authRequired) {
    return <AuthRequiredScreen onLogin={goLogin} onBack={goBack} />;
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
            <Text style={styles.loadingText}>{loadErr ? loadErr : "Project not found."}</Text>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.btnSm, pressed && styles.pressed]}>
              <Text style={styles.btnSmText}>Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#ffffff", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.flex}>
            <ScrollView contentContainerStyle={styles.container}>
              <View style={styles.headerWide}>
                <View style={styles.headerRow}>
                  <Text style={styles.title}>{title}</Text>
                  <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.btnSm, pressed && styles.pressed]}>
                    <Text style={styles.btnSmText}>Back</Text>
                  </Pressable>
                </View>

                {project.description ? <Text style={styles.desc}>{project.description}</Text> : null}

                {project.recordUserEnabled ? (
                  <View style={{ marginTop: 10 }}>
                    <CheckboxRow label="Allow to record user" value={recordConsent} onChange={setRecordConsent} />
                    {recordConsent && meUsername ? <Text style={styles.subtle}>Username: {meUsername}</Text> : null}
                  </View>
                ) : null}
              </View>

              {project.questions.map((q, idx) => (
                <Question
                  key={q.id}
                  q={q}
                  index={idx}
                  value={String(answers[q.id] ?? "")}
                  onChange={(v) => setAnswer(q.id, v)}
                />
              ))}

              <Pressable
                onPress={onSubmit}
                disabled={submitting || (project?.recordUserEnabled && !recordConsent)}
                style={({ pressed }) => [styles.btnWide, submitting && styles.disabled, pressed && !submitting && styles.pressed]}
              >
                <Text style={styles.btnWideText}>{submitting ? "Submitting…" : "Submit"}</Text>
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
    <View style={styles.cardNarrow}>
      <View style={styles.qHeaderRow}>
        <Text style={styles.qTitle}>
          {index + 1}. {q.prompt || "Untitled question"}
        </Text>
        {q.required ? <Text style={styles.requiredStar}>*</Text> : null}
      </View>

      {img ? <ResponsiveImage uri={img} /> : null}

      {audio ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.subtle}>Audio:</Text>
          {Platform.OS === "web" ? <WebAudioPlayer src={audio} /> : null}
          {Platform.OS !== "web" ? (
            <Pressable onPress={openAudio} style={({ pressed }) => [styles.btnSm, pressed && styles.pressed]}>
              <Text style={styles.btnSmText}>Open audio</Text>
            </Pressable>
          ) : null}
        </View>
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
                style={({ pressed }) => [styles.choiceRow, pressed && styles.pressed]}
              >
                <View style={[styles.radio, picked && styles.radioOn]} />
                <Text style={styles.choiceText}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={styles.colorRow}>
            <TextInput
              value={value}
              onChangeText={(t) => onChange(t)}
              placeholder="#RRGGBB"
              placeholderTextColor="#9ca3af"
              style={[styles.input, { flex: 1 }]}
              autoCapitalize="none"
            />
            <WebColorPicker value={value} onChange={onChange} />
          </View>

          <View style={styles.swatchGrid}>
            {PRESET.map((hex) => {
              const on = normalizeHex(value) === hex;
              return (
                <Pressable
                  key={hex}
                  onPress={() => onChange(hex)}
                  style={({ pressed }) => [
                    styles.swatchBox,
                    { backgroundColor: hex },
                    on && { borderColor: "#111827" },
                    pressed && styles.pressed,
                  ]}
                />
              );
            })}
          </View>

          {!value.trim() || isValidHex(value) ? null : <Text style={styles.error}>Invalid hex. Use #RRGGBB.</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7f9" },
  safeArea: { flex: 1, backgroundColor: "#f6f7f9" },
  flex: { flex: 1 },

  container: { paddingTop: 18, paddingHorizontal: 18, gap: 14, width: "100%", backgroundColor: "#f6f7f9" },

  headerWide: {
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#ffffff",
    gap: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", rowGap: 10 },

  title: { fontSize: 34, fontWeight: "900", color: "#111827", flexShrink: 1, minWidth: 0 },
  desc: { color: "#374151", fontSize: 14, lineHeight: 22 },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: { color: "#111827", fontSize: 16, fontWeight: "800" },

  cardNarrow: {
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    backgroundColor: "#ffffff",
  },

  qHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  qTitle: { flex: 1, fontSize: 14, fontWeight: "900", color: "#111827" },
  requiredStar: { fontSize: 18, fontWeight: "900", color: "#b00020", marginLeft: 6 },

  qImageNative: { width: "100%", height: 240, borderRadius: 12, backgroundColor: "#f3f4f6" },

  subtle: { color: "#6b7280", fontSize: 12 },
  error: { color: "#111827", fontSize: 12, fontWeight: "900" },

  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  longInput: { height: 120, paddingTop: 10, textAlignVertical: "top" },

  choiceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, borderColor: "#d1d5db" },
  radioOn: { backgroundColor: "#111827", borderColor: "#111827" },
  choiceText: { fontSize: 14, color: "#111827" },

  btnSm: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f3f4f6",
  },
  btnSmText: { fontWeight: "900", color: "#111827" },

  btnWide: {
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  btnWideText: { fontWeight: "900", color: "#111827" },

  timeText: { fontWeight: "900", color: "#111827" },

  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },

  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 as any },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxOn: { backgroundColor: "#111827", borderColor: "#111827" },
  checkboxMark: { color: "#fff", fontSize: 12, fontWeight: "900" },
  checkboxLabel: { fontSize: 13, fontWeight: "900", color: "#111827" },

  colorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  swatchGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  swatchBox: { width: 34, height: 34, borderRadius: 12, borderWidth: 2, borderColor: "#e5e7eb" },
});

const stylesAuth = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  header: {
    marginTop: -50,
    paddingTop: 50,
    backgroundColor: "rgba(38, 83, 108, 0.62)",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: 12,
  },

  title: {
    fontSize: 80,
    fontWeight: "bold",
    color: "#fff",
    fontFamily: SERIF,
    flexShrink: 1,
    minWidth: 0,
  },

  topButtons: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  bodyWrap: {
    paddingHorizontal: 24,
    paddingTop: 20,
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },

  h1: {
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 18,
    textAlign: "center",
    color: "#fff",
    fontFamily: SERIF,
    marginTop: 40,
  },

  p: {
    fontSize: 16,
    lineHeight: 30,
    opacity: 0.92,
    color: "#fff",
    fontFamily: SERIF,
    textAlign: "center",
  },

  actions: {
    marginTop: 28,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },

  pressed: { opacity: 0.75 },

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

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontFamily: SERIF,
  },
});
