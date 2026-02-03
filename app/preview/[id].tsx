
// FILE: Syn/app/preview/[id].tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image as RNImage } from "react-native";

import { BackButtonBar } from "../../components/BackButtonBar";
import LoginRequiredScreen from "../../components/LoginRequiredScreen";
import { useAuth } from "../../components/AuthProvider";
import { initDb, loadProject, resolvePublicUrl } from "../../lib/db";
import type { LoadedProject, QuestionDraft } from "../../lib/models";

const WebImg: any = Platform.OS === "web" ? ("img" as any) : null;
const WebDiv: any = Platform.OS === "web" ? ("div" as any) : null;
const tabularNumsStyle: any = Platform.OS === "web" ? { fontVariantNumeric: "tabular-nums" } : null;

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
            style: { display: "block", maxWidth: "100%", width: "auto", height: "auto", borderRadius: 12, border: "1px solid #e5e7eb" },
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
        style: { marginTop: 10, height: 12, borderRadius: 999, background: "#f3f4f6", overflow: "hidden", cursor: duration > 0 ? "pointer" : "default", border: "1px solid #e5e7eb" },
        children: React.createElement(WebDiv, { style: { height: "100%", width: `${Math.round(pct * 100)}%`, background: "#9ca3af" } }),
      })}
    </View>
  );
}

export default function PreviewScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = String(params.id ?? "");

  const { user, loading: authLoading } = useAuth();

  const [project, setProject] = useState<LoadedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordConsent, setRecordConsent] = useState(false);

  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const p = await loadProject(id);
        if (mounted) setProject(p);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, user]);

  if (authLoading) {
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

  if (!user) {
    return (
      <LoginRequiredScreen
        title="Login required"
        message="You need to log in to preview this quiz."
        onPrimary={() => router.push("/login")}
        onSecondary={() => router.back()}
      />
    );
  }

  const title = useMemo(() => project?.title ?? "Preview", [project?.title]);

  return (
    <LinearGradient colors={["#ffffff", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.flex}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
              <View style={styles.headerWide}>
                <View style={styles.headerRow}>
                  <Text style={styles.title}>{title}</Text>
                  <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.btnSm, pressed && styles.pressed]}>
                    <Text style={styles.btnSmText}>Back</Text>
                  </Pressable>
                </View>

                {project?.description ? <Text style={styles.desc}>{project.description}</Text> : null}

                {project?.recordUserEnabled ? (
                  <View style={{ marginTop: 10 }}>
                    <CheckboxRow label="Allow to record user" value={recordConsent} onChange={setRecordConsent} />
                  </View>
                ) : null}

                {loading ? <Text style={styles.subtle}>Loading…</Text> : null}
              </View>

              {project ? (
                <>
                  {project.questions.map((q, i) => (
                    <QuestionPreview key={q.id} q={q} index={i} />
                  ))}
                  <View style={{ height: 10 }} />
                </>
              ) : !loading ? (
                <Text style={styles.subtle}>Project not found.</Text>
              ) : null}

              <View style={{ height: 120 }} />
            </ScrollView>

            <BackButtonBar />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function QuestionPreview({ q, index }: { q: QuestionDraft; index: number }) {
  const img = q.imageUrl ? resolvePublicUrl(q.imageUrl) : "";
  const audio = q.audioUrl ? resolvePublicUrl(q.audioUrl) : "";

  const openAudio = useMemo(() => {
    if (!audio) return null;
    return async () => {
      try {
        await Linking.openURL(audio);
      } catch {
        // no-op
      }
    };
  }, [audio]);

  return (
    <View style={styles.cardNarrow}>
      <View style={styles.qHeaderRow}>
        <Text style={styles.qHeader}>
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
            <Pressable onPress={openAudio ?? undefined} style={({ pressed }) => [styles.btnSm, pressed && styles.pressed]}>
              <Text style={styles.btnSmText}>Open audio</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {q.type === "multiple_choice" ? (
        <View style={{ gap: 12 }}>
          {(q.options ?? []).map((opt, i) => (
            <View key={`${q.id}_${i}`} style={styles.choiceRow}>
              <View style={styles.radio} />
              <Text style={styles.choiceText}>{opt || `Option ${i + 1}`}</Text>
            </View>
          ))}
        </View>
      ) : q.type === "short_answer" ? (
        <TextInput placeholder="Short answer" placeholderTextColor="#9ca3af" style={styles.input} />
      ) : q.type === "long_answer" ? (
        <TextInput placeholder="Long answer" placeholderTextColor="#9ca3af" style={[styles.input, styles.longAnswer]} multiline />
      ) : (
        <View style={styles.choiceRow}>
          <View style={styles.colorSwatch} />
          <Text style={styles.choiceText}>Color wheel answer (hex)</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7f9" },
  safeArea: { flex: 1, backgroundColor: "#f6f7f9" },
  flex: { flex: 1 },

  scrollView: { flex: 1 },
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
  subtle: { color: "#6b7280", fontSize: 12 },

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
  qHeader: { fontSize: 14, fontWeight: "900", color: "#111827" },
  requiredStar: { fontSize: 18, fontWeight: "900", color: "#b00020", marginLeft: 6 },

  qImageNative: { width: "100%", height: 240, borderRadius: 12, backgroundColor: "#f3f4f6" },

  choiceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, borderColor: "#d1d5db" },
  choiceText: { fontSize: 14, color: "#111827" },

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
  longAnswer: { height: 120, paddingTop: 10, textAlignVertical: "top" },

  colorSwatch: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f3f4f6" },

  btnSm: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f3f4f6",
  },
  btnSmText: { fontWeight: "900", color: "#111827" },

  timeText: { fontWeight: "900", color: "#111827" },

  pressed: { opacity: 0.78 },

  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 as any },
  checkboxBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  checkboxBoxOn: { backgroundColor: "#111827", borderColor: "#111827" },
  checkboxMark: { color: "#fff", fontSize: 12, fontWeight: "900" },
  checkboxLabel: { fontSize: 13, fontWeight: "900", color: "#111827" },
});