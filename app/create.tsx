
// FILE: app/create.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { BackButtonBar } from "../components/BackButtonBar";
import { ProjectEditor } from "../components/ProjectEditor";
import { initDb, publishProject, saveProjectDraft } from "../lib/db";
import { makeEmptyProject, type ProjectDraft } from "../lib/models";

export default function CreateScreen() {
  const [draft, setDraft] = useState<ProjectDraft>(() => makeEmptyProject());

  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  const canSubmit = useMemo(() => draft.title.trim().length > 0, [draft.title]);

  const onSave = useCallback(async () => {
    const id = draft.id ? draft.id : await saveProjectDraft(draft);
    if (!draft.id) setDraft((d) => ({ ...d, id }));
  }, [draft]);

  const onPreview = useCallback(async () => {
    const id = draft.id ? draft.id : await saveProjectDraft(draft);
    if (!draft.id) setDraft((d) => ({ ...d, id }));
    router.push({ pathname: "/preview/[id]", params: { id } });
  }, [draft]);

  const onSubmitToLibrary = useCallback(async () => {
    const id = await publishProject(draft);
    if (!draft.id) setDraft((d) => ({ ...d, id }));
    router.replace({ pathname: "/library", params: { t: String(Date.now()) } });
  }, [draft]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.flex}>
          <ProjectEditor
            draft={draft}
            onChange={setDraft}
            onSave={onSave}
            onPreview={onPreview}
            modeLabel="Create Project"
          />

          <View style={styles.submitBar}>
            <Pressable
              onPress={onSubmitToLibrary}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                !canSubmit && styles.submitDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Submit project to library"
            >
              <Text style={styles.submitText}>Submit to Library</Text>
            </Pressable>
          </View>

          <BackButtonBar />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },



  submitBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e8e8e8",
  },
  submitButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#2b62ff",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#ffffff", fontWeight: "800" },
  submitDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});