// FILE: Syn/components/ProjectEditor.tsx
// (Add red * marks + keep existing functionality)
// =======================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import type { ProjectDraft, QuestionDraft, QuestionType } from "../lib/models";
import { makeEmptyQuestion } from "../lib/models";
import { resolvePublicUrl, saveProjectDraft, uploadProjectMedia } from "../lib/db";

type Props = {
  draft: ProjectDraft;
  onChange: (next: ProjectDraft) => void;
  onSave: () => void | Promise<void>;
  onPreview: () => void;
  modeLabel: "Create Project" | "Edit Project";
  autoSaveIntervalMs?: number;
};

const WebImg: any = Platform.OS === "web" ? ("img" as any) : null;
const WebDiv: any = Platform.OS === "web" ? ("div" as any) : null;
const tabularNumsStyle: any = Platform.OS === "web" ? { fontVariantNumeric: "tabular-nums" } : null;

function RequiredStar() {
  return <Text style={styles.requiredStar}>*</Text>;
}

function CheckboxRow(props: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel?: string;
  requiredMark?: boolean;
}) {
  return (
    <Pressable
      onPress={() => props.onChange(!props.value)}
      style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.value }}
      accessibilityLabel={props.accessibilityLabel ?? props.label}
    >
      <View style={[styles.checkboxBox, props.value && styles.checkboxBoxOn]}>
        {props.value ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={styles.checkboxLabel}>{props.label}</Text>
        {props.requiredMark ? <RequiredStar /> : null}
      </View>
    </Pressable>
  );
}

function setQuestion(draft: ProjectDraft, qId: string, patch: Partial<QuestionDraft>): ProjectDraft {
  return { ...draft, questions: draft.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)) };
}
function deleteQuestion(draft: ProjectDraft, qId: string): ProjectDraft {
  return { ...draft, questions: draft.questions.filter((q) => q.id !== qId) };
}
function changeQuestionType(draft: ProjectDraft, qId: string, nextType: QuestionType): ProjectDraft {
  return {
    ...draft,
    questions: draft.questions.map((q) => {
      if (q.id !== qId) return q;
      return {
        ...q,
        type: nextType,
        options: nextType === "multiple_choice" ? (q.options?.length ? q.options : ["", ""]) : [],
      };
    }),
  };
}
function addOption(draft: ProjectDraft, qId: string): ProjectDraft {
  return { ...draft, questions: draft.questions.map((q) => (q.id === qId ? { ...q, options: [...(q.options ?? []), ""] } : q)) };
}
function updateOption(draft: ProjectDraft, qId: string, idx: number, value: string): ProjectDraft {
  return {
    ...draft,
    questions: draft.questions.map((q) => {
      if (q.id !== qId) return q;
      const options = [...(q.options ?? [])];
      options[idx] = value;
      return { ...q, options };
    }),
  };
}
function removeOption(draft: ProjectDraft, qId: string, idx: number): ProjectDraft {
  return {
    ...draft,
    questions: draft.questions.map((q) => {
      if (q.id !== qId) return q;
      const options = [...(q.options ?? [])];
      options.splice(idx, 1);
      return { ...q, options };
    }),
  };
}

function signatureOfDraft(draft: ProjectDraft): string {
  const minimal = {
    id: draft.id,
    title: draft.title,
    description: draft.description,
    includeAssessment: draft.includeAssessment,
    recordUserEnabled: Boolean((draft as any).recordUserEnabled),
    questions: (draft.questions ?? []).map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      required: q.required,
      options: q.options ?? [],
      imageUrl: q.imageUrl ?? "",
      audioUrl: q.audioUrl ?? "",
    })),
  };
  return JSON.stringify(minimal);
}

async function pickImage(): Promise<{ uri: string; name?: string; type?: string } | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
  });

  if ((res as any)?.canceled) return null;
  const asset = (res as any)?.assets?.[0];
  if (!asset?.uri) return null;

  const type = String(asset.mimeType || "image/jpeg");
  const name = String(asset.fileName || `image.${(type.split("/")[1] || "jpg").toLowerCase()}`);
  return { uri: String(asset.uri), name, type };
}

async function pickAudio(): Promise<{ uri: string; name?: string; type?: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: "audio/*",
    multiple: false,
    copyToCacheDirectory: true,
  });

  if ((res as any)?.canceled) return null;
  const asset = (res as any)?.assets?.[0];
  if (!asset?.uri) return null;

  const type = String(asset.mimeType || "audio/mpeg");
  const name = String(asset.name || `audio.${(type.split("/")[1] || "mp3").toLowerCase()}`);
  return { uri: String(asset.uri), name, type };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function WebImagePreview(props: { src: string }) {
  if (Platform.OS !== "web" || !WebDiv || !WebImg) return null;

  return (
    <View style={{ marginTop: 10 }}>
      {React.createElement(WebDiv, {
        style: { display: "flex", justifyContent: "flex-start", alignItems: "flex-start" },
        children: React.createElement(WebImg, {
          src: props.src,
          alt: "",
          style: { display: "block", maxWidth: "100%", width: "auto", height: "auto", borderRadius: 12, border: "1px solid #e5e7eb" },
        }),
      })}
    </View>
  );
}

function WebAudioPlayer(props: { src: string }) {
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

    const a = new Audio(props.src);
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
  }, [props.src]);

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

export function ProjectEditor(props: Props) {
  const { draft, onChange, onSave, onPreview, modeLabel } = props;
  const autoSaveIntervalMs = props.autoSaveIntervalMs ?? 3000;

  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [statusText, setStatusText] = useState<string>("");
  const [showSavedCheck, setShowSavedCheck] = useState(false);

  const debounceRef = useRef<any>(null);
  const lastSavedSigRef = useRef<string>("");

  const canProceed = useMemo(() => draft.title.trim().length > 0, [draft.title]);
  const sig = useMemo(() => signatureOfDraft(draft), [draft]);

  const runSave = useCallback(
    async (showToast: boolean) => {
      if (!draft.title.trim()) {
        Alert.alert("Title is required", "Please enter a project title before saving.");
        return;
      }
      try {
        setStatusText(showToast ? "Saving…" : "");
        const id = await saveProjectDraft(draft);
        if (!draft.id) onChange({ ...draft, id });
        lastSavedSigRef.current = sig;
        setShowSavedCheck(true);
        setTimeout(() => setShowSavedCheck(false), 1000);
        setStatusText(showToast ? "Saved" : "");
        if (showToast) setTimeout(() => setStatusText(""), 1500);
      } catch (e: any) {
        setStatusText("");
        Alert.alert("Save failed", String(e?.message ?? e));
      }
    },
    [draft, onChange, sig]
  );

  useEffect(() => {
    if (!draft.title?.trim()) return;
    if (!sig) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (lastSavedSigRef.current === sig) return;
      runSave(false).catch(() => {});
    }, autoSaveIntervalMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, [sig, autoSaveIntervalMs, runSave, draft.title]);

  const ensureProjectId = useCallback(async (): Promise<string> => {
    if (draft.id) return draft.id;
    if (!draft.title.trim()) throw new Error("Title is required.");
    const id = await saveProjectDraft(draft);
    onChange({ ...draft, id });
    return id;
  }, [draft, onChange]);

  const attachImage = useCallback(
    async (q: QuestionDraft) => {
      const key = `${q.id}:image`;
      setUploading((m) => ({ ...m, [key]: true }));
      try {
        const file = await pickImage();
        if (!file) return;

        const projectId = await ensureProjectId();
        const contentType = String(file.type || "image/jpeg");
        const url = await uploadProjectMedia(projectId, file, contentType);
        onChange(setQuestion(draft, q.id, { imageUrl: url }));
      } catch (e: any) {
        Alert.alert("Image upload failed", String(e?.message ?? e));
      } finally {
        setUploading((m) => ({ ...m, [key]: false }));
      }
    },
    [draft, ensureProjectId, onChange]
  );

  const attachAudio = useCallback(
    async (q: QuestionDraft) => {
      const key = `${q.id}:audio`;
      setUploading((m) => ({ ...m, [key]: true }));
      try {
        const file = await pickAudio();
        if (!file) return;

        const projectId = await ensureProjectId();
        const contentType = String(file.type || "audio/mpeg");
        const url = await uploadProjectMedia(projectId, file, contentType);
        onChange(setQuestion(draft, q.id, { audioUrl: url }));
      } catch (e: any) {
        Alert.alert("Audio upload failed", String(e?.message ?? e));
      } finally {
        setUploading((m) => ({ ...m, [key]: false }));
      }
    },
    [draft, ensureProjectId, onChange]
  );

  const addQuestionUI = useCallback(
    (type: QuestionType) => onChange({ ...draft, questions: [...(draft.questions ?? []), makeEmptyQuestion(type)] }),
    [draft, onChange]
  );

  const onPressSave = useCallback(async () => {
    if (!canProceed) {
      Alert.alert("Title is required", "Please enter a project title before saving.");
      return;
    }
    await Promise.resolve(onSave());
  }, [canProceed, onSave]);

  const onPressPreview = useCallback(() => {
    if (!canProceed) {
      Alert.alert("Title is required", "Please enter a project title before previewing.");
      return;
    }
    onPreview();
  }, [canProceed, onPreview]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>{modeLabel}</Text>

        <View style={styles.headerActions}>
          <View style={styles.statusWrap} accessibilityRole="text">
            {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
            {showSavedCheck ? <Text style={styles.savedCheck}>✓</Text> : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save project"
            onPress={() => void onPressSave()}
            disabled={!canProceed}
            style={({ pressed }) => [styles.btnSm, !canProceed && styles.disabled, pressed && canProceed && styles.pressed]}
          >
            <Text style={styles.btnSmText}>Save</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Preview project"
            onPress={onPressPreview}
            disabled={!canProceed}
            style={({ pressed }) => [styles.btnSm, !canProceed && styles.disabled, pressed && canProceed && styles.pressed]}
          >
            <Text style={styles.btnSmText}>Preview</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.cardWide}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={draft.title}
          onChangeText={(t) => onChange({ ...draft, title: t })}
          placeholder="Project title"
          placeholderTextColor="#9ca3af"
          style={styles.input}
          accessibilityLabel="Project title"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={draft.description}
          onChangeText={(t) => onChange({ ...draft, description: t })}
          placeholder="Optional description"
          placeholderTextColor="#9ca3af"
          style={[styles.input, styles.multiline]}
          multiline
          accessibilityLabel="Project description"
        />

        <View style={{ height: 10 }} />

        
<View style={styles.switchRow}>
  <View style={{ flex: 1 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={styles.label}>Record user</Text>
      <Text style={styles.requiredStar}>*</Text>
    </View>
    <Text style={styles.helpText}>
      If enabled, respondents must allow recording their username before submitting.
    </Text>
  </View>

  <Switch
    value={Boolean((draft as any).recordUserEnabled)}
    onValueChange={(v) => onChange({ ...draft, recordUserEnabled: v } as any)}
  />
</View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.label}>Include built-in assessment quiz</Text>
              <RequiredStar />
            </View>
            <Text style={styles.helpText}>If enabled, respondents must complete the assessment before taking the quiz.</Text>
          </View>
          <Switch value={Boolean(draft.includeAssessment)} onValueChange={(v) => onChange({ ...draft, includeAssessment: v } as any)} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Questions</Text>
        <View style={styles.addRow}>
          <Pressable onPress={() => addQuestionUI("multiple_choice")} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
            <Text style={styles.chipText}>+ Multiple</Text>
          </Pressable>
          <Pressable onPress={() => addQuestionUI("short_answer")} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
            <Text style={styles.chipText}>+ Short</Text>
          </Pressable>
          <Pressable onPress={() => addQuestionUI("long_answer")} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
            <Text style={styles.chipText}>+ Long</Text>
          </Pressable>
          <Pressable onPress={() => addQuestionUI("color_wheel")} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
            <Text style={styles.chipText}>+ Color</Text>
          </Pressable>
        </View>
      </View>

      {draft.questions.length === 0 ? (
        <View style={styles.cardNarrow}>
          <Text style={styles.helpText}>No questions yet. Add one above.</Text>
        </View>
      ) : null}

      {(draft.questions ?? []).map((q, index) => {
        const imageKey = `${q.id}:image`;
        const audioKey = `${q.id}:audio`;

        const isUploadingImage = Boolean(uploading[imageKey]);
        const isUploadingAudio = Boolean(uploading[audioKey]);

        const imageSrc = q.imageUrl ? resolvePublicUrl(String(q.imageUrl)) : "";
        const audioSrc = q.audioUrl ? resolvePublicUrl(String(q.audioUrl)) : "";

        return (
          <View key={q.id} style={styles.cardNarrow}>
            <View style={styles.qTopRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.qIndex}>Question {index + 1}</Text>
                {q.required ? <RequiredStar /> : null}
              </View>

              <Pressable onPress={() => onChange(deleteQuestion(draft, q.id))} style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}>
                <Text style={styles.dangerBtnText}>Delete</Text>
              </Pressable>
            </View>

            <TextInput
              value={q.prompt}
              onChangeText={(t) => onChange(setQuestion(draft, q.id, { prompt: t }))}
              placeholder="Question prompt"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              accessibilityLabel={`Question ${index + 1} prompt`}
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.label}>Required</Text>
                  <RequiredStar />
                </View>
                <Text style={styles.helpText}>If enabled, respondents must answer.</Text>
              </View>
              <Switch value={Boolean(q.required)} onValueChange={(v) => onChange(setQuestion(draft, q.id, { required: v }))} accessibilityLabel="Required" />
            </View>

            <View style={styles.typeRow}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeButtons}>
                {(["multiple_choice", "short_answer", "long_answer", "color_wheel"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => onChange(changeQuestionType(draft, q.id, t))}
                    style={({ pressed }) => [styles.typeBtn, q.type === t && styles.typeBtnActive, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Set question type to ${t}`}
                  >
                    <Text style={styles.typeBtnText}>
                      {t === "multiple_choice" ? "Multiple" : t === "short_answer" ? "Short" : t === "long_answer" ? "Long" : "Color"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.attachRow}>
              <Text style={styles.label}>Attachments</Text>

              {imageSrc ? (Platform.OS === "web" ? <WebImagePreview src={imageSrc} /> : <Image source={{ uri: imageSrc }} style={styles.qImage} contentFit="contain" />) : null}
              {Platform.OS === "web" && audioSrc ? <WebAudioPlayer src={audioSrc} /> : null}

              <View style={styles.attachBtns}>
                <Pressable onPress={() => attachImage(q)} disabled={isUploadingImage} style={({ pressed }) => [styles.btnSm, isUploadingImage && styles.disabled, pressed && styles.pressed]}>
                  <Text style={styles.btnSmText}>{isUploadingImage ? "Uploading…" : imageSrc ? "Replace image" : "Upload image"}</Text>
                </Pressable>

                {imageSrc ? (
                  <Pressable onPress={() => onChange(setQuestion(draft, q.id, { imageUrl: null }))} style={({ pressed }) => [styles.btnSm, pressed && styles.pressed]}>
                    <Text style={styles.btnSmText}>Remove image</Text>
                  </Pressable>
                ) : null}

                <Pressable onPress={() => attachAudio(q)} disabled={isUploadingAudio} style={({ pressed }) => [styles.btnSm, isUploadingAudio && styles.disabled, pressed && styles.pressed]}>
                  <Text style={styles.btnSmText}>{isUploadingAudio ? "Uploading…" : audioSrc ? "Replace audio" : "Upload audio"}</Text>
                </Pressable>

                {audioSrc ? (
                  <Pressable onPress={() => onChange(setQuestion(draft, q.id, { audioUrl: null }))} style={({ pressed }) => [styles.btnSm, pressed && styles.pressed]}>
                    <Text style={styles.btnSmText}>Remove audio</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {q.type === "multiple_choice" ? (
              <View style={{ gap: 10 }}>
                <Text style={styles.label}>Options</Text>

                {(q.options ?? []).map((opt, idx) => (
                  <View key={`${q.id}_${idx}`} style={styles.optionRow}>
                    <Text style={styles.bullet}>•</Text>
                    <TextInput
                      value={String(opt)}
                      onChangeText={(t) => onChange(updateOption(draft, q.id, idx, t))}
                      placeholder={`Option ${idx + 1}`}
                      placeholderTextColor="#9ca3af"
                      style={[styles.input, { flex: 1 }]}
                      accessibilityLabel={`Option ${idx + 1}`}
                    />
                    <Pressable onPress={() => onChange(removeOption(draft, q.id, idx))} style={({ pressed }) => [styles.miniBtn, pressed && styles.pressed]}>
                      <Text style={styles.miniBtnText}>–</Text>
                    </Pressable>
                  </View>
                ))}

                <Pressable onPress={() => onChange(addOption(draft, q.id))} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                  <Text style={styles.chipText}>+ Add option</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 110, gap: 14, backgroundColor: "#f6f7f9", width: "100%" },

  headerRow: { maxWidth: 1200, width: "100%", alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", rowGap: 10, paddingHorizontal: 6 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: "#111827" },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" },

  statusWrap: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 70, justifyContent: "flex-end" },
  statusText: { color: "#6b7280", fontSize: 13, fontWeight: "700" },
  savedCheck: { color: "#6b7280", fontSize: 16, fontWeight: "900" },

  cardWide: { maxWidth: 1200, width: "100%", alignSelf: "center", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, padding: 16, gap: 12, backgroundColor: "#ffffff" },
  cardNarrow: { maxWidth: 760, width: "100%", alignSelf: "center", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, padding: 16, gap: 12, backgroundColor: "#ffffff" },

  sectionHeader: { maxWidth: 760, width: "100%", alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, flexWrap: "wrap", rowGap: 10, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },

  label: { fontSize: 13, fontWeight: "800", color: "#111827" },
  helpText: { color: "#6b7280", fontSize: 12, lineHeight: 18 },

  requiredStar: { fontSize: 16, fontWeight: "900", color: "#b00020", marginTop: -1 },

  input: { height: 44, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 12, fontSize: 14, backgroundColor: "#ffffff", color: "#111827" },
  multiline: { height: 110, paddingTop: 10, textAlignVertical: "top" },

  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },

  addRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },

  chip: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb" },
  chipText: { fontSize: 12, fontWeight: "800", color: "#111827" },

  qTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  qIndex: { fontSize: 13, fontWeight: "900", color: "#111827" },

  dangerBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f3f4f6" },
  dangerBtnText: { color: "#111827", fontWeight: "900" },

  typeRow: { gap: 8 },
  typeButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#ffffff" },
  typeBtnActive: { backgroundColor: "#f3f4f6" },
  typeBtnText: { fontSize: 12, fontWeight: "800", color: "#111827" },

  optionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bullet: { fontSize: 16, marginTop: -2, color: "#111827" },

  miniBtn: { width: 40, height: 44, borderRadius: 12, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  miniBtnText: { fontSize: 18, fontWeight: "900", color: "#111827" },

  attachRow: { gap: 10 },
  attachBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  btnSm: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f3f4f6" },
  btnSmText: { fontWeight: "900", color: "#111827" },

  timeText: { fontWeight: "900", color: "#111827" },

  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },

  qImage: { width: "100%", height: 260, borderRadius: 12, backgroundColor: "#f3f4f6" },

  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 as any },
  checkboxBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  checkboxBoxOn: { backgroundColor: "#111827", borderColor: "#111827" },
  checkboxMark: { color: "#fff", fontSize: 12, fontWeight: "900" },
  checkboxLabel: { fontSize: 13, fontWeight: "900", color: "#111827" },
});

