// FILE: Syn/app/assessment/[id].tsx
import React, { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { BackButtonBar } from "../../components/BackButtonBar";
import { getCurrentUser } from "../../lib/auth";
import { BatteryStore } from "../../lib/BatteryStore";
import { buildGraphemeBattery } from "../../lib/SynesthesiaBattery";

function isAuthErrorMessage(msg: string): boolean {
  const m = (msg || "").toLowerCase();
  return m.includes("not authenticated") || m.includes("unauthorized") || m.includes("401");
}

function makeAssessmentRunId(quizId: string) {
  // prevents overwriting when multiple people take the same assessment
  return `assess_${quizId || "default"}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function AssessmentScreen() {
  const params = useLocalSearchParams<{ id?: string; returnTo?: string }>();
  const id = String(params.id ?? "");
  const returnTo = typeof params.returnTo === "string" && params.returnTo.startsWith("/") ? params.returnTo : "";

  const [authRequired, setAuthRequired] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setAuthRequired(false);
        setAuthMsg("");
        await getCurrentUser();
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

  const goLogin = () => router.replace("/login" as any);
  const goBack = () => router.back();

  const start = async () => {
    const runId = makeAssessmentRunId(id);

    const run = buildGraphemeBattery({
      runId,
      repeats: 3,
      // 26 letters + 10 digits = 36 * 3 = 108 trials
      stimuli: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", ..."0123456789"],
    });

    await BatteryStore.saveRun(run);

    const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
    router.replace((`/battery/${encodeURIComponent(run.runId)}/picker${qs}` as any));
  };

  if (authRequired) {
    return (
      <LinearGradient colors={["#ffffff", "#ffffff"]} style={s.screen}>
        <SafeAreaView style={s.safe}>
          <View style={s.center}>
            <View style={s.card}>
              <Text style={s.h1}>Login required</Text>
              <Text style={s.p}>You must be logged in to take the assessment.</Text>
              {authMsg ? <Text style={s.small}>{authMsg}</Text> : null}

              <View style={s.btnRow}>
                <Pressable onPress={goLogin} style={({ pressed }) => [s.btnWide, pressed && s.pressed]}>
                  <Text style={s.btnWideText}>Go to Login</Text>
                </Pressable>

                <Pressable onPress={goBack} style={({ pressed }) => [s.btnSm, pressed && s.pressed]}>
                  <Text style={s.btnSmText}>Back</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#ffffff", "#ffffff"]} style={s.screen}>
      <SafeAreaView style={s.safe}>
        <BackButtonBar title="Synesthesia Battery" onBack={goBack} />
        <View style={s.center}>
          <View style={s.card}>
            <Text style={s.h1}>Grapheme–Color Battery</Text>
            <Text style={s.p}>
              You’ll pick a color (or “no color”) for each letter/number several times. Then you’ll do a speed congruency test.
              Finally, you’ll get a consistency score + accuracy/RT summary.
            </Text>

            <Pressable onPress={start} style={({ pressed }) => [s.btnWide, pressed && s.pressed]}>
              <Text style={s.btnWideText}>Start</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f7f9" },
  safe: { flex: 1, backgroundColor: "#f6f7f9" },

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
    gap: 12,
  },

  h1: { fontSize: 18, fontWeight: "900", color: "#111827" },
  p: { fontSize: 13, color: "#374151", lineHeight: 20 },
  small: { fontSize: 12, color: "#6b7280" },

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
});
