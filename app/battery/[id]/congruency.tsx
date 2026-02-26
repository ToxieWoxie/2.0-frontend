// FILE: Syn/app/battery/[id]/congruency.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { loadRun, saveRun } from "../_lib/batteryApi";
import type { BatteryRunPayload, CongruencyResponse } from "../_lib/batteryTypes";

const SERIF = Platform.select({ ios: "Times New Roman", android: "serif", default: "serif" });

function now() {
  return Date.now();
}

// choose a “canonical” color for each grapheme from picker responses:
// take first non-noColor hex; (you can upgrade later to mean/median in Lab)
function buildCanonicalMap(payload: BatteryRunPayload) {
  const m = new Map<string, string>();
  for (const r of payload.pickerResponses ?? []) {
    if ((r as any)?.kind !== "grapheme") continue;
    if ((r as any)?.isNoColor) continue;
    const hex = String((r as any)?.hex ?? "").trim();
    if (!hex) continue;
    if (!m.has((r as any).grapheme)) m.set((r as any).grapheme, hex.toLowerCase());
  }
  return m;
}

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

export default function CongruencyScreen() {
  const { id, returnTo } = useLocalSearchParams<{ id?: string; returnTo?: string }>();
const returnToParam = typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "";
const withReturnTo = (path: string) =>
  returnToParam ? `${path}?returnTo=${encodeURIComponent(returnToParam)}` : path;
  const runId = String(id ?? "default");

  const [payload, setPayload] = useState<BatteryRunPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string>("");

  const [trialIndex, setTrialIndex] = useState(0);
  const showAtRef = useRef<number>(0);
  const savingRef = useRef(false);

  // load run (and VALIDATE it so we never get infinite loading)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setLoadErr("");

        const res = await loadRun(runId);
        const pRaw = (res as any)?.payload as BatteryRunPayload | undefined;

        // ✅ CRITICAL: if backend returns no payload, treat as missing run
        if (!pRaw || pRaw.version !== 1) {
          throw new Error("Run payload missing or invalid. Start the picker test first.");
        }

        const p: BatteryRunPayload = {
          ...pRaw,
          pickerResponses: pRaw.pickerResponses ?? [],
          congruencyResponses: pRaw.congruencyResponses ?? [],
        };

        if (!alive) return;

        setPayload(p);
        setTrialIndex(p.congruencyResponses.length);
      } catch (e: any) {
        if (!alive) return;

        const msg = String(e?.message ?? e ?? "Failed to load run.");
        setLoadErr(msg);

        // Don’t silently spin. Redirect back to picker so user can create the run.
        Alert.alert("Speed test unavailable", msg, [
          {
            text: "Back to Picker",
            onPress: () => router.replace((`/battery/${encodeURIComponent(runId)}/picker` as any)),
          },
        ]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [runId]);

  const canonical = useMemo(() => (payload ? buildCanonicalMap(payload) : new Map<string, string>()), [payload]);

  // Build congruency trials (fixed length)
  const trials = useMemo(() => {
    if (!payload) return [];

    const graphemes = Array.from(
      new Set(
        (payload.pickerResponses ?? [])
          .filter((r: any) => r.kind === "grapheme")
          .map((r: any) => String(r.grapheme))
      )
    ).filter(Boolean);

    if (graphemes.length === 0) return [];

    const N = 40;
    const out: { stimulusText: string; expectedMatch: boolean; shownHex: string }[] = [];

    const hexes = Array.from(new Set(Array.from(canonical.values())));
    const fallbackHexes = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffa500", "#111827"];

    for (let i = 0; i < N; i++) {
      const g = pick(graphemes, i * 7 + 3);
      const wantMatch = i % 2 === 0;

      const learned = canonical.get(g) ?? pick(fallbackHexes, i);
      let shown = learned;

      if (!wantMatch) {
        const pool = (hexes.length ? hexes : fallbackHexes).filter((h) => h.toLowerCase() !== learned.toLowerCase());
        shown = pick(pool.length ? pool : fallbackHexes, i * 13 + 1);
      }

      out.push({ stimulusText: g, expectedMatch: wantMatch, shownHex: shown });
    }
    return out;
  }, [payload, canonical]);

  const total = trials.length;
const t = trials[trialIndex];
const isComplete = total > 0 && trialIndex >= total;
  // ✅ Guard: if we're past the last trial (resume after completion), show completion UI
if (total > 0 && !t) {
  return (
    <SafeAreaView style={S.safe}>
      <View style={S.center}>
        <Text style={S.loading}>Speed test complete.</Text>

        <Pressable
          onPress={() =>
            router.replace(
              (returnToParam
                ? (`/battery/${encodeURIComponent(runId)}/results?returnTo=${encodeURIComponent(returnToParam)}` as any)
                : (`/battery/${encodeURIComponent(runId)}/results` as any))
            )
          }
          style={({ pressed }) => [S.btnSmall, pressed && S.pressed]}
        >
          <Text style={S.btnText}>View Results</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

  // start timing when trial becomes available
useEffect(() => {
  if (!t || isComplete) return;
  showAtRef.current = now();
}, [isComplete, trialIndex, t?.stimulusText, t?.shownHex]);

  const answer = async (chosen: "match" | "mismatch") => {
    if (!payload || !t) return;
    if (savingRef.current) return;

    const rtMs = Math.max(0, now() - showAtRef.current);
    const saidMatch = chosen === "match";
    const correct = saidMatch === t.expectedMatch;

    const resp: CongruencyResponse = {
      trialIndex,
      atMs: now(),
      rtMs,
      correct,
      expectedMatch: t.expectedMatch,
      stimulusText: t.stimulusText,
      shownHex: t.shownHex,
      chosen,
    };

    const nextPayload: BatteryRunPayload = {
      ...payload,
      congruencyResponses: [...(payload.congruencyResponses ?? []), resp],
    };

    setPayload(nextPayload);

    savingRef.current = true;
    try {
      await saveRun(runId, nextPayload);
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message ?? e));
      // keep them on same trial so they can try again
      savingRef.current = false;
      return;
    }
    savingRef.current = false;

    const nextIndex = trialIndex + 1;
    if (nextIndex >= total) {
      router.replace((withReturnTo(`/battery/${encodeURIComponent(runId)}/picker`) as any));
      return;
    }
    setTrialIndex(nextIndex);
  };

  if (loading) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.center}>
          <Text style={S.loading}>Loading…</Text>
          <Text style={S.small}>Run: {runId}</Text>
          {loadErr ? <Text style={S.small}>{loadErr}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  // ✅ No infinite loading: if payload is missing, show an explicit fallback
  if (!payload) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.center}>
          <Text style={S.loading}>Could not load speed test.</Text>
          <Text style={S.small}>{loadErr || "Start the picker test first."}</Text>
          <Pressable
            onPress={() => router.replace((withReturnTo(`/battery/${encodeURIComponent(runId)}/picker`) as any))}  
            style={({ pressed }) => [S.btnSmall, pressed && S.pressed]}
          >
            <Text style={S.btnText}>Back to Picker</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (total === 0) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.center}>
          <Text style={S.loading}>Not enough picker data for speed test.</Text>
          <Pressable
            onPress={() => router.replace((withReturnTo(`/battery/${encodeURIComponent(runId)}/picker`) as any))}
            style={({ pressed }) => [S.btnSmall, pressed && S.pressed]}
          >
            <Text style={S.btnText}>Back to Picker</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <Text style={S.brand}>Synesthete</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [S.btnSmall, pressed && S.pressed]}>
          <Text style={S.btnText}>Back</Text>
        </Pressable>
      </View>

      <View style={S.card}>
        <Text style={S.h1}>Speed Congruency Test</Text>
        <Text style={S.p}>Respond as quickly as you can. Does the color match your association?</Text>

        <Text style={S.progress}>
          {trialIndex + 1} / {total}
        </Text>

        <View style={S.stimWrap}>
          <Text style={[S.stim, { color: t.shownHex }]}>{t.stimulusText}</Text>
        </View>

        <View style={S.row}>
          <Pressable onPress={() => void answer("match")} style={({ pressed }) => [S.bigBtn, pressed && S.pressed]}>
            <Text style={S.bigBtnText}>Match</Text>
          </Pressable>

          <Pressable onPress={() => void answer("mismatch")} style={({ pressed }) => [S.bigBtn, pressed && S.pressed]}>
            <Text style={S.bigBtnText}>Mismatch</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b2545" },

  header: { padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 40, color: "#fff", fontFamily: SERIF, fontWeight: "800" },

  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 920,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    marginHorizontal: 14,
    gap: 10,
  },

  h1: { fontSize: 26, fontWeight: "900", color: "#0b2545", fontFamily: SERIF },
  p: { color: "#1f2937", fontSize: 14, lineHeight: 22 },
  progress: { fontWeight: "900", color: "#0b2545", marginTop: 6 },

  stimWrap: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 26,
    alignItems: "center",
    backgroundColor: "#fafafa",
    marginTop: 10,
  },
  stim: { fontSize: 96, fontWeight: "900", fontFamily: SERIF },

  row: { flexDirection: "row", gap: 12, marginTop: 12, flexWrap: "wrap" },
  bigBtn: { flexGrow: 1, minWidth: 220, paddingVertical: 14, borderRadius: 12, backgroundColor: "#0b2545", alignItems: "center" },
  bigBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  btnSmall: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  btnText: { color: "#fff", fontWeight: "900", fontFamily: SERIF },

  pressed: { opacity: 0.8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loading: { color: "#fff", fontWeight: "900" },
  small: { color: "rgba(255,255,255,0.85)", marginTop: 6, textAlign: "center" },
});
