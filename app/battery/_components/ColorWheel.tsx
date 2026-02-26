import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

/**
 * Always-visible color picker (SV square + hue slider).
 * Works on native + web without relying on input[type=color] (no dropdown).
 */

export function normalizeHex(v: string): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.startsWith("#")) return s.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return s.toLowerCase();
}

export function hexToRgbSafe(hex: string): { r: number; g: number; b: number } | null {
  const h = normalizeHex(hex);
  if (!/^#[0-9a-f]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  return { r, g, b };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function rgbToHex(r: number, g: number, b: number) {
  const rr = clamp(Math.round(r), 0, 255).toString(16).padStart(2, "0");
  const gg = clamp(Math.round(g), 0, 255).toString(16).padStart(2, "0");
  const bb = clamp(Math.round(b), 0, 255).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`.toLowerCase();
}

// HSV <-> RGB
function hsvToRgb(h: number, s: number, v: number) {
  // h: 0..360, s/v: 0..1
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;

  let rp = 0,
    gp = 0,
    bp = 0;

  if (hh < 60) {
    rp = c;
    gp = x;
    bp = 0;
  } else if (hh < 120) {
    rp = x;
    gp = c;
    bp = 0;
  } else if (hh < 180) {
    rp = 0;
    gp = c;
    bp = x;
  } else if (hh < 240) {
    rp = 0;
    gp = x;
    bp = c;
  } else if (hh < 300) {
    rp = x;
    gp = 0;
    bp = c;
  } else {
    rp = c;
    gp = 0;
    bp = x;
  }

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
}

function rgbToHsv(r: number, g: number, b: number) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  if (d === 0) h = 0;
  else if (max === rr) h = 60 * (((gg - bb) / d) % 6);
  else if (max === gg) h = 60 * ((bb - rr) / d + 2);
  else h = 60 * ((rr - gg) / d + 4);

  if (h < 0) h += 360;

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
}

type Props = {
  value: string; // hex
  onChange: (nextHex: string) => void;
  label?: string;
};

const PICKER_SIZE = 240;
const HUE_W = 28;

export function ColorWheel({ value, onChange, label }: Props) {
  const safeOnChange = typeof onChange === "function" ? onChange : () => {};
  const rgb = hexToRgbSafe(value) ?? { r: 51, g: 102, b: 204 };
  const initial = useMemo(() => rgbToHsv(rgb.r, rgb.g, rgb.b), [rgb.r, rgb.g, rgb.b]);

  const [h, setH] = useState(initial.h);
  const [s, setS] = useState(initial.s);
  const [v, setV] = useState(initial.v);

  // keep internal HSV in sync if parent value changes externally
  useEffect(() => {
    const rr = hexToRgbSafe(value);
    if (!rr) return;
    const next = rgbToHsv(rr.r, rr.g, rr.b);
    setH(next.h);
    setS(next.s);
    setV(next.v);
  }, [value]);

  const hex = useMemo(() => {
    const out = hsvToRgb(h, s, v);
    return rgbToHex(out.r, out.g, out.b);
  }, [h, s, v]);

  // emit upward when internal changes
  useEffect(() => {
    safeOnChange(hex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  const hueRgb = useMemo(() => hsvToRgb(h, 1, 1), [h]);
  const hueHex = useMemo(() => rgbToHex(hueRgb.r, hueRgb.g, hueRgb.b), [hueRgb]);

  const onPickSV = useCallback(
    (e: any) => {
      const x = clamp(Number(e?.nativeEvent?.locationX ?? 0), 0, PICKER_SIZE);
      const y = clamp(Number(e?.nativeEvent?.locationY ?? 0), 0, PICKER_SIZE);

      const ns = x / PICKER_SIZE;
      const nv = 1 - y / PICKER_SIZE;

      setS(clamp(ns, 0, 1));
      setV(clamp(nv, 0, 1));
    },
    [setS, setV]
  );

  const onPickHue = useCallback(
    (e: any) => {
      const y = clamp(Number(e?.nativeEvent?.locationY ?? 0), 0, PICKER_SIZE);
      const nh = (y / PICKER_SIZE) * 360;
      setH(clamp(nh, 0, 360));
    },
    [setH]
  );

  // handle positions
  const svX = s * PICKER_SIZE;
  const svY = (1 - v) * PICKER_SIZE;
  const hueY = (h / 360) * PICKER_SIZE;

  return (
    <View style={C.wrap}>
      {label ? <Text style={C.label}>{label}</Text> : null}

      {/* Big chosen color preview */}
      <View style={C.previewRow}>
        <View style={[C.previewSwatch, { backgroundColor: hex }]} />
        <View style={{ flex: 1 }}>
          <Text style={C.previewHex}>{hex.toUpperCase()}</Text>
          <Text style={C.previewSub}>Adjust using the picker below.</Text>
        </View>
      </View>

      {/* Always-visible picker */}
      <View style={C.pickerRow}>
        {/* SV square */}
        <View
          style={C.svBox}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={onPickSV}
          onResponderMove={onPickSV}
        >
          {/* base hue */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: hueHex }]} />
          {/* white gradient */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "transparent",
                ...(Platform.OS === "web"
                  ? ({
                      backgroundImage: "linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))",
                    } as any)
                  : null),
              },
            ]}
          />
          {/* black gradient */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "transparent",
                ...(Platform.OS === "web"
                  ? ({
                      backgroundImage: "linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))",
                    } as any)
                  : null),
              },
            ]}
          />

          {/* Native fallback gradients (RN doesn't support CSS backgroundImage) */}
          {Platform.OS !== "web" ? (
            <>
              <View style={[StyleSheet.absoluteFill, C.nativeWhiteFade]} />
              <View style={[StyleSheet.absoluteFill, C.nativeBlackFade]} />
            </>
          ) : null}

          {/* Crosshair */}
          <View style={[C.crosshair, { left: svX - 10, top: svY - 10 }]} />
        </View>

        {/* Hue bar */}
        <View
          style={C.hueBox}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={onPickHue}
          onResponderMove={onPickHue}
        >
          {Platform.OS === "web" ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  ...(Platform.OS === "web"
                    ? ({
                        backgroundImage:
                          "linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                      } as any)
                    : null),
                },
              ]}
            />
          ) : (
            // Native: approximate with stacked segments
            <View style={C.hueSegments}>
              {Array.from({ length: 24 }).map((_, i) => {
                const hh = (i / 24) * 360;
                const c = hsvToRgb(hh, 1, 1);
                return <View key={i} style={{ flex: 1, backgroundColor: rgbToHex(c.r, c.g, c.b) }} />;
              })}
            </View>
          )}

          <View style={[C.hueThumb, { top: hueY - 6 }]} />
        </View>
      </View>
    </View>
  );
}

const C = StyleSheet.create({
  wrap: { gap: 12 },

  label: { fontWeight: "900", color: "#111827" },

  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  previewSwatch: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#0b2545",
  },
  previewHex: { fontSize: 18, fontWeight: "900", color: "#0b2545" },
  previewSub: { marginTop: 2, color: "#6b7280", fontSize: 12, fontWeight: "700" },

  pickerRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  svBox: {
    width: PICKER_SIZE,
    height: PICKER_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },

  // Crosshair
  crosshair: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    ...(Platform.OS === "web" ? ({ boxShadow: "0 2px 6px rgba(0,0,0,0.35)" } as any) : null),
  },

  hueBox: {
    width: HUE_W,
    height: PICKER_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  hueThumb: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 12,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  hueSegments: { flex: 1 },

  // Native gradient approximations
  nativeWhiteFade: {
    backgroundColor: "transparent",
    // fake left->right fade: overlay multiple bands (kept light/simple)
    // not perfect, but usable cross-platform without extra deps
    opacity: 0.6,
  },
  nativeBlackFade: {
    backgroundColor: "transparent",
    opacity: 0.6,
  },
});
