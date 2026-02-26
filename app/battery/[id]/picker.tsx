// FILE: Syn/app/battery/[id]/picker.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { saveRun, loadRun } from "../_lib/batteryApi";
import type { BatteryRunPayload, PickerResponse } from "../_lib/batteryTypes";
import { DEFAULT_GRAPHEMES, DEFAULT_WEEKDAYS, buildPickerTrials } from "../_lib/batteryPlan";
import { ColorWheel, hexToRgbSafe, normalizeHex } from "../_components/ColorWheel";

const SERIF = Platform.select({ ios: "Times New Roman", android: "serif", default: "serif" });

function now() {
  return Date.now();
}

// key used to restore a saved response for a given trial
function trialKey(t: { kind: string; grapheme: string; repeatIndex: number }) {
  return `${t.kind}:${t.grapheme}:${t.repeatIndex}`;
}

/**
 * Deterministic "random" hex for a given trial.
 * - Deterministic per (runId + trial) so refresh doesn't change it mid-trial.
 * - Different between trials so you don't carry bias.
 */
function hash32(str: string) {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededHex(seedStr: string) {
  const h = hash32(seedStr);
  // generate RGB from hash
  const r = (h & 0xff0000) >>> 16;
  const g = (h & 0x00ff00) >>> 8;
  const b = h & 0x0000ff;

  // Avoid super-dark/super-light starts so it’s visually clear.
  const tweak = (v: number) => Math.min(230, Math.max(25, v));
  const rr = tweak(r);
  const gg = tweak(g);
  const bb = tweak(b);

  const hex =
    "#" +
    rr.toString(16).padStart(2, "0") +
    gg.toString(16).padStart(2, "0") +
    bb.toString(16).padStart(2, "0");
  return hex.toLowerCase();
}

/**
 * ✅ CRITICAL FIX:
 * Some ColorWheel implementations (especially on web) call onChange(event)
 * instead of onChange("#rrggbb").
 * This safely extracts a hex string from either form.
 */
function coerceHex(input: any): string {
  if (typeof input === "string") return input;
  const v = input?.target?.value;
  if (typeof v === "string") return v;
  return "";
}

/**
 * Count unique answered trials (not just array length),
 * because we "replace" answers for the same (kind, grapheme, repeatIndex).
 */
function countUniqueAnswered(p: BatteryRunPayload | null | undefined) {
  const set = new Set<string>();
  for (const r of p?.pickerResponses ?? []) {
    set.add(trialKey(r as any));
  }
  return set.size;
}

function findFirstUnansweredIndex(trials: any[], p: BatteryRunPayload | null | undefined) {
  const set = new Set<string>();
  for (const r of p?.pickerResponses ?? []) {
    set.add(trialKey(r as any));
  }
  for (let i = 0; i < trials.length; i++) {
    const k = trialKey(trials[i]);
    if (!set.has(k)) return i;
  }
  return trials.length; // all answered
}

export default function PickerScreen() {
  const { id, returnTo } = useLocalSearchParams<{ id?: string; returnTo?: string }>();
const returnToParam = typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "";
const withReturnTo = (path: string) =>
  returnToParam ? `${path}?returnTo=${encodeURIComponent(returnToParam)}` : path;
  const runId = String(id ?? "default");

  const repeats = 3;

  const trials = useMemo(() => {
    // seed stable per runId so refresh doesn't reorder (basic hash)
    let seed = 0;
    for (let i = 0; i < runId.length; i++) seed = (seed * 31 + runId.charCodeAt(i)) >>> 0;

    return buildPickerTrials({
      graphemes: DEFAULT_GRAPHEMES,
      weekdays: DEFAULT_WEEKDAYS,
      repeats,
      seed,
    });
  }, [runId]);

  const total = trials.length;

  const [payload, setPayload] = useState<BatteryRunPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [trialIndex, setTrialIndex] = useState(0);

  // UI state for the current trial
  const [currentHex, setCurrentHex] = useState<string>("#3366cc");
  const [noColor, setNoColor] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const savingRef = useRef(false);

  // Load existing run if present so refresh resumes
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const res = await loadRun(runId);
        const pRaw = res?.payload as BatteryRunPayload | undefined;

        if (!alive) return;

        const p: BatteryRunPayload | null =
          pRaw?.version === 1
            ? {
                ...pRaw,
                pickerResponses: pRaw.pickerResponses ?? [],
                congruencyResponses: pRaw.congruencyResponses ?? [],
              }
            : null;

        if (p) {
          setPayload(p);

          // ✅ FIX: Resume on first unanswered (not by length)
          const firstUnanswered = findFirstUnansweredIndex(trials, p);

          // ✅ FIX: If picker is complete, go straight to congruency
          if (total > 0 && firstUnanswered >= total) {
          router.replace((withReturnTo(`/battery/${encodeURIComponent(runId)}/congruency`) as any));
            return;
          }

          setTrialIndex(Math.min(firstUnanswered, Math.max(0, total - 1)));
        } else {
          const fresh: BatteryRunPayload = {
            version: 1,
            createdAtMs: now(),
            repeats,
            pickerPlan: { graphemes: DEFAULT_GRAPHEMES, weekdays: DEFAULT_WEEKDAYS },
            pickerResponses: [],
            congruencyResponses: [],
          };

          setPayload(fresh);
          await saveRun(runId, fresh);
          setTrialIndex(0);
        }
      } catch {
        const fresh: BatteryRunPayload = {
          version: 1,
          createdAtMs: now(),
          repeats,
          pickerPlan: { graphemes: DEFAULT_GRAPHEMES, weekdays: DEFAULT_WEEKDAYS },
          pickerResponses: [],
          congruencyResponses: [],
        };

        if (!alive) return;
        setPayload(fresh);
        setTrialIndex(0);

        try {
          await saveRun(runId, fresh);
        } catch {
          // ignore
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [runId, repeats, total, trials]);

  const current = trials[trialIndex];

  // Per-trial initial hex (deterministic random)
  const initialHexForTrial = useMemo(() => {
    if (!current) return "#3366cc";
    return seededHex(`${runId}|${current.kind}|${current.grapheme}|${current.repeatIndex}`);
  }, [runId, current?.kind, current?.grapheme, current?.repeatIndex]);

  // When trial changes (or payload loads), restore saved response into UI
  useEffect(() => {
    if (!payload || !current) return;

    const k = trialKey(current);
    const existing = (payload.pickerResponses ?? []).find((r) => trialKey(r as any) === k) as PickerResponse | undefined;

    if (existing?.isNoColor) {
      setNoColor(true);
      setCurrentHex(initialHexForTrial);
      return;
    }

    const savedHex = typeof existing?.hex === "string" ? existing.hex : "";
    if (savedHex && hexToRgbSafe(savedHex)) {
      setNoColor(false);
      setCurrentHex(normalizeHex(savedHex));
      return;
    }

    setNoColor(false);
    setCurrentHex(initialHexForTrial);
  }, [payload, trialIndex, initialHexForTrial, current]);

  const answeredUnique = countUniqueAnswered(payload);
  const pct = total ? Math.round((Math.min(answeredUnique, total) / total) * 100) : 0;

  // ✅ Guard against currentHex ever becoming non-string (web event bug)
  const canNext = useMemo(() => {
    if (noColor) return true;
    if (typeof currentHex !== "string") return false;
    return !!hexToRgbSafe(currentHex);
  }, [currentHex, noColor]);

  const onNext = async () => {
    if (!payload) {
      Alert.alert("Not ready", "Run payload not loaded yet.");
      return;
    }
    if (!current) {
      Alert.alert("Not ready", "Trial not available.");
      return;
    }

    if (!canNext) {
      Alert.alert("Pick a color", "Please pick a valid color or choose 'No color'.");
      return;
    }

    if (savingRef.current || submitting) return;

    const rgb = noColor ? null : hexToRgbSafe(currentHex);

    const resp: PickerResponse = {
      grapheme: current.grapheme,
      kind: current.kind,
      repeatIndex: current.repeatIndex,
      trialIndex,
      atMs: now(),
      isNoColor: noColor,
      ...(rgb ? { rgb, hex: normalizeHex(currentHex) } : {}),
    };

    // exactly one response per (kind, grapheme, repeatIndex)
    const k = trialKey(current);
    const prev = payload.pickerResponses ?? [];
    const filtered = prev.filter((r) => trialKey(r as any) !== k);

    const nextPayload: BatteryRunPayload = {
      ...payload,
      pickerResponses: [...filtered, resp],
    };

    // optimistic update
    setPayload(nextPayload);
    setNoColor(false);

    const nextIndex = trialIndex + 1;

    savingRef.current = true;
    setSubmitting(true);

    try {
      await saveRun(runId, nextPayload);
    } catch (e: any) {
      // IMPORTANT: do not block navigation if save fails
      Alert.alert("Save warning", `Saving failed, but we'll continue:\n\n${String(e?.message ?? e)}`);
    } finally {
      savingRef.current = false;
      setSubmitting(false);
    }

    // ✅ FLOW FIX: picker → congruency when DONE (no looping back)
    if (nextIndex >= total) {
      router.replace((withReturnTo(`/battery/${encodeURIComponent(runId)}/congruency`) as any));
      return;
    }

    setTrialIndex(nextIndex);
  };

  const restart = () => {
    Alert.alert("Restart battery?", "This will clear saved progress for this run.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restart",
        style: "destructive",
        onPress: async () => {
          const fresh: BatteryRunPayload = {
            version: 1,
            createdAtMs: now(),
            repeats,
            pickerPlan: { graphemes: DEFAULT_GRAPHEMES, weekdays: DEFAULT_WEEKDAYS },
            pickerResponses: [],
            congruencyResponses: [],
          };

          setPayload(fresh);
          setTrialIndex(0);
          setCurrentHex("#3366cc");
          setNoColor(false);

          try {
            await saveRun(runId, fresh);
          } catch {
            // ignore
          }
        },
      },
    ]);
  };

  if (loading || !payload) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.center}>
          <Text style={S.loading}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!current) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.center}>
          <Text style={S.loading}>No trials found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe}>
      <ScrollView contentContainerStyle={S.wrap}>
        <View style={S.header}>
          <Text style={S.brand}>Synesthete</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={restart} style={({ pressed }) => [S.btn, pressed && S.pressed]}>
              <Text style={S.btnText}>Restart</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [S.btn, pressed && S.pressed]}>
              <Text style={S.btnText}>Back</Text>
            </Pressable>
          </View>
        </View>

        <View style={S.card}>
          <Text style={S.h1}>Color Picker Test</Text>
          <Text style={S.p}>
            Choose the color that best matches your association. If you have no association, select “No color”.
          </Text>

          <View style={S.progressRow}>
            <Text style={S.progressText}>
              Item {Math.min(trialIndex + 1, total)} of {total}
            </Text>

            <View style={S.progressTrack}>
              <View style={[S.progressFill, { width: `${pct}%` }]} />
            </View>

            <Text style={S.progressText}>{pct}%</Text>
          </View>

          <View style={S.stimulusBox}>
            <Text style={S.stimulusLabel}>{current.kind === "grapheme" ? "Grapheme" : "Weekday"}</Text>
            <Text style={S.stimulus}>{current.grapheme}</Text>
          </View>

          <View style={{ height: 12 }} />

          {/* BIG chosen color swatch (always visible) */}
          <View style={S.swatchRow}>
            <View style={[S.swatchBig, { backgroundColor: noColor ? "#ffffff" : currentHex }]} />
            <View style={{ flex: 1 }}>
              <Text style={S.swatchTitle}>Selected color</Text>
              <Text style={S.swatchMeta}>{noColor ? "No color selected" : normalizeHex(currentHex)}</Text>
            </View>
          </View>

          <View style={{ height: 12 }} />

          {/* ALWAYS visible wheel (no toggling) */}
          <View style={S.wheelWrap}>
            <ColorWheel
              value={typeof currentHex === "string" ? currentHex : "#3366cc"}
              onChange={(next: any) => {
                // ✅ FIX: Accept either "#rrggbb" or an event-like object
                const hex = normalizeHex(coerceHex(next));
                if (!hex) return;
                setNoColor(false);
                setCurrentHex(hex);
              }}
            />
          </View>

          <View style={{ height: 10 }} />

          <Pressable onPress={() => setNoColor((v) => !v)} style={({ pressed }) => [S.noColorRow, pressed && S.pressed]}>
            <View style={[S.checkbox, noColor && S.checkboxOn]}>{noColor ? <Text style={S.check}>✓</Text> : null}</View>
            <Text style={S.noColorText}>No color</Text>
          </Pressable>

          <View style={{ height: 14 }} />

          <Pressable
            onPress={onNext}
            disabled={!canNext || submitting}
            style={({ pressed }) => [
              S.nextBtn,
              (!canNext || submitting) && S.disabled,
              pressed && canNext && !submitting && S.pressed,
            ]}
          >
            <Text style={S.nextText}>
              {submitting ? "Saving…" : trialIndex + 1 >= total ? "Continue to Speed Test" : "Next"}
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b2545" },
  wrap: { paddingBottom: 40 },

  header: {
    padding: 18,
    backgroundColor: "#0b2545",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  brand: { fontSize: 40, color: "#fff", fontFamily: SERIF, fontWeight: "800" },

  btn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  btnText: { color: "#fff", fontWeight: "900", fontFamily: SERIF },

  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 920,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    marginHorizontal: 14,
    marginTop: 12,
    gap: 10,
  },

  h1: { fontSize: 26, fontWeight: "900", color: "#0b2545", fontFamily: SERIF },
  p: { color: "#1f2937", fontSize: 14, lineHeight: 22 },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressText: { fontWeight: "800", color: "#0b2545" },
  progressTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#f97316" },

  stimulusBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: "#fafafa",
    gap: 6,
  },
  stimulusLabel: { color: "#6b7280", fontWeight: "900" },
  stimulus: { fontSize: 96, fontWeight: "900", color: "#111827", fontFamily: SERIF },

  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  swatchBig: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#111827",
  },
  swatchTitle: { fontWeight: "900", color: "#111827", fontSize: 14 },
  swatchMeta: { marginTop: 6, color: "#374151", fontWeight: "800" },

  wheelWrap: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
  },

  noColorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "#9ca3af", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: "#111827", borderColor: "#111827" },
  check: { color: "#fff", fontWeight: "900", fontSize: 12 },
  noColorText: { fontWeight: "900", color: "#111827" },

  nextBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#0b2545",
  },
  nextText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: { color: "#fff", fontWeight: "900" },
});
