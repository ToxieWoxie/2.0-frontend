// FILE: Syn/app/edit/[id].tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { BackButtonBar } from "../../components/BackButtonBar";
import { ProjectEditor } from "../../components/ProjectEditor";
import { initDb, loadProject, publishProject, saveProjectDraft } from "../../lib/db";
import type { ProjectDraft } from "../../lib/models";

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = String(id ?? "");

  const [draft, setDraft] = useState<ProjectDraft | null>(null);

  useEffect(() => {
    (async () => {
      await initDb();
      const loaded = await loadProject(projectId);
      if (!loaded) {
        router.back();
        return;
      }
      setDraft({
        id: loaded.id,
        title: loaded.title,
        description: loaded.description,
        includeAssessment: loaded.includeAssessment,
        recordUserEnabled: Boolean((loaded as any).recordUserEnabled), // ✅ FIX: persist toggle on refresh
        questions: loaded.questions,
      });
    })().catch(console.error);
  }, [projectId]);

  const canSubmit = useMemo(() => !!draft && draft.title.trim().length > 0, [draft]);

  const onSave = useCallback(async () => {
    if (!draft) return;
    await saveProjectDraft(draft);
  }, [draft]);

  const onPreview = useCallback(() => {
    router.push({ pathname: "/preview/[id]", params: { id: projectId } });
  }, [projectId]);

  const onSubmitToLibrary = useCallback(async () => {
    if (!draft) return;
    await publishProject(draft);
    router.replace("/library");
  }, [draft]);

  if (!draft) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.flex} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.flex}>
          <ProjectEditor draft={draft} onChange={setDraft} onSave={onSave} onPreview={onPreview} modeLabel="Edit Project" />

          <View style={styles.submitBar}>
            <Pressable
              onPress={() => router.push({ pathname: "/submissions/[id]", params: { id: projectId } })}
              style={({ pressed }) => [styles.resultsButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="View results"
            >
              <Text style={styles.resultsText}>View Results</Text>
            </Pressable>
          </View>
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
  pressed: { opacity: 0.85 },
  resultsButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#f2f2f2" },
  resultsText: { fontWeight: "900" },
});