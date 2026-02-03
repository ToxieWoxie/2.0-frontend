import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
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
import { BackButtonBar } from "../../components/BackButtonBar";
import { initDb, loadProject, saveProjectDraft} from "../../lib/db";
import type { LoadedProject, QuestionDraft } from "../../lib/models";

export default function PreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = String(id ?? "");
  const [project, setProject] = useState<LoadedProject | null>(null);

  useEffect(() => {
    (async () => {
      await initDb();
      const loaded = await loadProject(projectId);
      setProject(loaded);
    })().catch(console.error);
  }, [projectId]);

  const questions = useMemo(() => project?.questions ?? [], [project]);

  if (!project) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.flex} />
        <BackButtonBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Preview</Text>
              <Pressable
                onPress={() => router.push({ pathname: "/preview/[id]", params: { id: project.id } })}

                style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.projectTitle}>{project.title || "Untitled project"}</Text>
              {project.description ? <Text style={styles.desc}>{project.description}</Text> : null}
            </View>

            {project.includeAssessment ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Assessment (placeholder)</Text>
                <Text style={styles.helpText}>
                  A built-in pre-made assessment quiz will appear here later.
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Questions</Text>
              {questions.length === 0 ? <Text style={styles.helpText}>No questions yet.</Text> : null}
            </View>

            {questions.map((q, idx) => (
              <QuestionPreview key={q.id} q={q} index={idx} />
            ))}

            <View style={{ height: 16 }} />
          </ScrollView>

          <BackButtonBar />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function QuestionPreview({ q, index }: { q: QuestionDraft; index: number }) {
  return (
    <View style={styles.qCard}>
      <Text style={styles.qHeader}>
        {index + 1}. {q.prompt || "Untitled question"}
      </Text>

      {q.type === "multiple_choice" ? (
        <View style={{ gap: 10 }}>
          {(q.options ?? []).map((opt, i) => (
            <View key={`${q.id}_${i}`} style={styles.choiceRow}>
              <View style={styles.radio} />
              <Text style={styles.choiceText}>{opt || `Option ${i + 1}`}</Text>
            </View>
          ))}
        </View>
      ) : q.type === "short_answer" ? (
        <TextInput
          placeholder="Short answer"
          placeholderTextColor="#7a7a7a"
          style={styles.answerInput}
        />
      ) : (
        <TextInput
          placeholder="Long answer"
          placeholderTextColor="#7a7a7a"
          style={[styles.answerInput, styles.longAnswer]}
          multiline
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },

  container: { padding: 16, gap: 12 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  title: { fontSize: 22, fontWeight: "800" },

  editBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d7d7d7",
    backgroundColor: "#ffffff",
  },

  editBtnText: { fontSize: 13, fontWeight: "800" },

  pressed: { opacity: 0.8 },

  card: {
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    backgroundColor: "#ffffff",
  },

  projectTitle: { fontSize: 18, fontWeight: "800" },
  desc: { fontSize: 13, color: "#4f4f4f" },

  sectionTitle: { fontSize: 14, fontWeight: "800" },
  helpText: { fontSize: 12, color: "#6b6b6b" },

  qCard: {
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    backgroundColor: "#ffffff",
  },

  qHeader: { fontSize: 14, fontWeight: "800" },

  choiceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#9b9b9b",
    backgroundColor: "#ffffff",
  },
  choiceText: { fontSize: 13 },

  answerInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#d7d7d7",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#ffffff",
  },

  longAnswer: {
    height: 110,
    paddingTop: 10,
    textAlignVertical: "top",
  },
});
