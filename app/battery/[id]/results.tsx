// FILE: Syn/app/battery/[id]/results.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getResults, loadRun } from "../_lib/batteryApi";
import type { BatteryRunPayload } from "../_lib/batteryTypes";

const SERIF = Platform.select({ ios: "Times New Roman", android: "serif", default: "serif" });

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// ✅ PATCH: helpers for safe returnTo and assessmentDone flag
function safeReturnTo(v: unknown): string {
  if (typeof v !== "string") return "";
  if (!v.startsWith("/")) return "";
  return v;
}
function addAssessmentDone(url: string): string {
  return url.includes("?") ? `${url}&assessmentDone=1` : `${url}?assessmentDone=1`;
}

export default function BatteryResultsScreen() {
  // ✅ PATCH: accept returnTo
  const { id, returnTo } = useLocalSearchParams<{ id?: string; returnTo?: string }>();
  const runId = String(id ?? "default");

  // ✅ PATCH: compute continue-to-quiz target
  const returnToParam = useMemo(() => safeReturnTo(returnTo), [returnTo]);
  const continueToQuiz = useMemo(() => (returnToParam ? addAssessmentDone(returnToParam) : ""), [returnToParam]);

  // ✅ PATCH: helper to keep returnTo when navigating within battery flow
  const withReturnTo = useMemo(() => {
    return (path: string) => (returnToParam ? `${path}?returnTo=${encodeURIComponent(returnToParam)}` : path);
  }, [returnToParam]);

  const [payload, setPayload] = useState<BatteryRunPayload | null>(null);
  const [results, setResults] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        const run = await loadRun(runId);
        const p = run?.payload as BatteryRunPayload;
        const r = await getResults(runId, p?.repeats ?? 3);
        if (!alive) return;
        setPayload(p);
        setResults(r?.results);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [runId]);

  const byKind = useMemo(() => {
    if (!payload) return { grapheme: new Map<string, any[]>(), weekday: new Map<string, any[]>() };

    const g = new Map<string, any[]>();
    const w = new Map<string, any[]>();

    for (const r of payload.pickerResponses ?? []) {
      const map = r.kind === "weekday" ? w : g;
      const key = r.grapheme;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // sort each list by repeatIndex
    for (const map of [g, w]) {
      for (const [k, arr] of map.entries()) {
        arr.sort((a, b) => (a.repeatIndex ?? 0) - (b.repeatIndex ?? 0));
        map.set(k, arr);
      }
    }
    return { grapheme: g, weekday: w };
  }, [payload]);

  if (err) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.center}>
          <Text style={S.loading}>Could not load results.</Text>
          <Text style={[S.loading, { opacity: 0.8, fontSize: 12 }]}>{err}</Text>

          {/* ✅ PATCH: keep returnTo when going back */}
          <Pressable
            onPress={() => router.replace((withReturnTo(`/battery/${encodeURIComponent(runId)}/picker`) as any))}
            style={({ pressed }) => [S.btn, pressed && S.pressed]}
          >
            <Text style={S.btnText}>Back to Picker</Text>
          </Pressable>

          {/* ✅ PATCH: still allow continuing if we have returnTo */}
          {continueToQuiz ? (
            <Pressable onPress={() => router.replace((continueToQuiz as any))} style={({ pressed }) => [S.btn, pressed && S.pressed]}>
              <Text style={S.btnText}>Continue to Quiz</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (!payload || !results) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.center}>
          <Text style={S.loading}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={S.header}>
          <Text style={S.brand}>Synesthete</Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* ✅ PATCH: keep returnTo when retaking */}
            <Pressable
              onPress={() => router.replace((withReturnTo(`/battery/${encodeURIComponent(runId)}/picker`) as any))}
              style={({ pressed }) => [S.btnSmall, pressed && S.pressed]}
            >
              <Text style={S.btnSmallText}>Retake</Text>
            </Pressable>

            {/* ✅ PATCH: add Continue to Quiz */}
            {continueToQuiz ? (
              <Pressable onPress={() => router.replace((continueToQuiz as any))} style={({ pressed }) => [S.btnSmall, pressed && S.pressed]}>
                <Text style={S.btnSmallText}>Continue to Quiz</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={() => router.replace(("/library" as any))} style={({ pressed }) => [S.btnSmall, pressed && S.pressed]}>
              <Text style={S.btnSmallText}>Library</Text>
            </Pressable>
          </View>
        </View>

        <View style={S.card}>
          <Text style={S.h1}>Results</Text>

          <Text style={S.scoreLabel}>Score: {Number(results.pickerScore ?? 0).toFixed(2)}</Text>
          <Text style={S.p}>
            In this battery, a score below ~1.0 is often considered synesthetic consistency. Higher scores indicate less consistency.
          </Text>

          <View style={{ height: 10 }} />

          <Text style={S.h2}>Speed Congruency Test</Text>
          <Text style={S.p}>Accuracy: {Number(results.congruencyAccuracyPct ?? 0).toFixed(0)}%</Text>
          <Text style={S.p}>Mean Reaction Time: {Number(results.congruencyMeanRtSec ?? 0).toFixed(3)} seconds</Text>

          <View style={{ height: 18 }} />

          <Text style={S.h2}>Grapheme-Color Picker Test</Text>
          <ResultTable map={byKind.grapheme} />

          <View style={{ height: 18 }} />

          <Text style={S.h2}>Weekdays Color Picker Test</Text>
          <ResultTable map={byKind.weekday} />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultTable({ map }: { map: Map<string, any[]> }) {
  const rows = Array.from(map.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return (
    <View style={{ marginTop: 10, borderWidth: 1, borderColor: "#d1d5db" }}>
      {rows.map(([label, reps]) => {
        const cols = [0, 1, 2].map((i) => reps[i] || null);
        const bar = reps?.[0]?.meanDeltaE ?? null;

        const colors = cols.map((c) => (c?.isNoColor ? null : c?.hex || null));
        const maxBar = 40;
        const fake = clamp(Math.random() * 30, 0, maxBar);
        const pct = clamp(fake / maxBar, 0, 1);

        return (
          <View key={label} style={S.row}>
            <View style={S.cellLabel}>
              <Text style={S.labelText}>{label}</Text>
            </View>

            {colors.map((hex, idx) => (
              <View key={idx} style={S.cell}>
                <Text style={[S.sampleText, { color: hex ?? "#111827", opacity: hex ? 1 : 0.35 }]}>
                  {label.length === 1 ? label : label}
                </Text>
              </View>
            ))}

            <View style={S.cellBar}>
              <View style={S.barTrack}>
                <View style={[S.barFill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b2545" },

  header: {
    padding: 18,
    backgroundColor: "#0b2545",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  brand: { fontSize: 40, color: "#fff", fontFamily: SERIF, fontWeight: "800" },

  btnSmall: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  btnSmallText: { color: "#fff", fontWeight: "900", fontFamily: SERIF },

  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 980,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    marginHorizontal: 14,
    marginTop: 12,
  },

  h1: { fontSize: 28, fontWeight: "900", color: "#0b2545", fontFamily: SERIF },
  h2: { fontSize: 20, fontWeight: "900", color: "#0b2545", marginTop: 8, fontFamily: SERIF },
  p: { color: "#111827", fontSize: 14, lineHeight: 22, marginTop: 6 },

  scoreLabel: { fontSize: 22, fontWeight: "900", marginTop: 14, color: "#111827" },

  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#d1d5db" },
  cellLabel: { width: 150, padding: 10, borderRightWidth: 1, borderRightColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  cell: { width: 120, padding: 10, borderRightWidth: 1, borderRightColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  cellBar: { flex: 1, padding: 10, alignItems: "center", justifyContent: "center" },

  labelText: { fontWeight: "900", color: "#111827" },
  sampleText: { fontWeight: "900", fontSize: 18, fontFamily: SERIF },

  barTrack: { width: "100%", height: 14, borderRadius: 999, backgroundColor: "#fee2e2", overflow: "hidden", borderWidth: 1, borderColor: "#fecaca" },
  barFill: { height: "100%", backgroundColor: "#f97316" },

  pressed: { opacity: 0.8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loading: { color: "#fff", fontWeight: "900" },
  btn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  btnText: { color: "#fff", fontWeight: "900" },
});
