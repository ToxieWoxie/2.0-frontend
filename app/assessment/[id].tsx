// FILE: Syn/app/assessment/[id].tsx
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { BackButtonBar } from "../../components/BackButtonBar";
import { getCurrentUser } from "../../lib/auth";
import { setAssessmentAnswer, type AssessmentAnswer } from "../../lib/AssessmentStore";

function isAuthErrorMessage(msg: string): boolean {
  const m = (msg || "").toLowerCase();
  return m.includes("not authenticated") || m.includes("unauthorized") || m.includes("401");
}

function RadioRow(props: {
  label: string;
  value: AssessmentAnswer;
  selected: AssessmentAnswer | null;
  onSelect: (v: AssessmentAnswer) => void;
}) {
  const on = props.selected === props.value;
  return (
    <Pressable onPress={() => props.onSelect(props.value)} style={({ pressed }) => [aStyles.row, pressed && aStyles.pressed]}>
      <View style={[aStyles.radio, on && aStyles.radioOn]}>{on ? <View style={aStyles.radioDot} /> : null}</View>
      <Text style={aStyles.rowText}>{props.label}</Text>
    </Pressable>
  );
}

export default function AssessmentScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = String(params.id ?? "");

  const [answer, setAnswer] = useState<AssessmentAnswer | null>(null);
  const canSubmit = useMemo(() => Boolean(answer), [answer]);

  const [authRequired, setAuthRequired] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setAuthRequired(false);
        setAuthMsg("");
        await getCurrentUser(); // if it throws, show login-required screen
      } catch (e: any) {
        if (!alive) return;
        const msg = String(e?.message ?? e);
        if (isAuthErrorMessage(msg)) {
          setAuthRequired(true);
          setAuthMsg(msg);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const goLogin = () => router.replace(("/login" as any) ?? ("/login" as any));
  const goBack = () => router.back();

  const onSubmit = () => {
    if (!answer) {
      Alert.alert("Required", "Please select an answer before submitting.");
      return;
    }
    setAssessmentAnswer(id, answer);
    router.replace((`/take/${encodeURIComponent(id)}` as any));
  };

  if (authRequired) {
    return (
      <LinearGradient colors={["#ffffff", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={aStyles.screen}>
        <SafeAreaView style={aStyles.safe}>
          <View style={aStyles.center}>
            <View style={aStyles.card}>
              <Text style={aStyles.h1}>Login required</Text>
              <Text style={aStyles.p}>You must be logged in to take the assessment.</Text>
              {authMsg ? <Text style={aStyles.small}>{authMsg}</Text> : null}

              <View style={aStyles.btnRow}>
                <Pressable onPress={goLogin} style={({ pressed }) => [aStyles.btnWide, pressed && aStyles.pressed]}>
                  <Text style={aStyles.btnWideText}>Go to Login</Text>
                </Pressable>

                <Pressable onPress={goBack} style={({ pressed }) => [aStyles.btnSm, pressed && aStyles.pressed]}>
                  <Text style={aStyles.btnSmText}>Back</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#ffffff", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={aStyles.screen}>
      <SafeAreaView style={aStyles.safe}>
        <BackButtonBar title="Assessment" onBack={goBack} />

        <ScrollView contentContainerStyle={aStyles.container}>
          <View style={aStyles.card}>
            <Text style={aStyles.h1}>
              Do you have synesthesia <Text style={aStyles.reqStar}>*</Text>
            </Text>

            <View style={{ height: 8 }} />

            <RadioRow label="Yes" value={"yes"} selected={answer} onSelect={setAnswer} />
            <RadioRow label="No" value={"no"} selected={answer} onSelect={setAnswer} />
            <RadioRow label="Unsure" value={"unsure"} selected={answer} onSelect={setAnswer} />

            <View style={{ height: 12 }} />

            <Pressable onPress={onSubmit} disabled={!canSubmit} style={({ pressed }) => [aStyles.btnWide, !canSubmit && aStyles.disabled, pressed && canSubmit && aStyles.pressed]}>
              <Text style={aStyles.btnWideText}>Submit</Text>
            </Pressable>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const aStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7f9" },
  safe: { flex: 1, backgroundColor: "#f6f7f9" },
  container: { padding: 16, gap: 12 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },

  card: {
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#ffffff",
    gap: 10,
  },

  h1: { fontSize: 18, fontWeight: "900", color: "#111827" },
  p: { fontSize: 13, color: "#374151", lineHeight: 20 },
  small: { fontSize: 12, color: "#6b7280" },

  reqStar: { color: "#b00020", fontWeight: "900" },

  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { fontSize: 14, fontWeight: "800", color: "#111827" },
  radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: "#111827" },
  radioDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#111827" },

  btnRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" },
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
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  btnWideText: { fontWeight: "900", color: "#111827" },

  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});

