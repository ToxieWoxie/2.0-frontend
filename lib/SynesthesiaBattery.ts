// FILE: Syn/lib/SynesthesiaBattery.ts
export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

export type PickerTrial = {
  id: string;
  grapheme: string;
  repeatIndex: number;
};

export type PickerResponse = {
  trialId: string;
  grapheme: string;
  repeatIndex: number;
  isNoColor: boolean;
  rgb?: Rgb;
  hsv?: Hsv;
  gray?: number; // 0..1 (optional)
  rtMs: number;
  ts: number;
};

export type CongruencyTrial = {
  id: string;
  grapheme: string;
  shownRgb: Rgb;
  isCongruent: boolean;
};

export type CongruencyResponse = {
  trialId: string;
  grapheme: string;
  answeredMatched: boolean;
  correct: boolean;
  rtMs: number;
  ts: number;
};

export type BatteryRun = {
  runId: string;

  // picker
  pickerTrials: PickerTrial[];
  pickerIndex: number;
  pickerResponses: PickerResponse[];

  // congruency
  congruencyTrials: CongruencyTrial[];
  congruencyIndex: number;
  congruencyResponses: CongruencyResponse[];

  createdAt: number;
};

export function buildGraphemeBattery(opts: { runId: string; stimuli: string[]; repeats: number }): BatteryRun {
  const trials: PickerTrial[] = [];
  for (const g of opts.stimuli) {
    for (let r = 0; r < opts.repeats; r++) {
      trials.push({ id: `${g}_${r}_${Math.random().toString(16).slice(2)}`, grapheme: g, repeatIndex: r });
    }
  }
  shuffleInPlace(trials);

  return {
    runId: opts.runId,
    pickerTrials: trials,
    pickerIndex: 0,
    pickerResponses: [],
    congruencyTrials: [],
    congruencyIndex: 0,
    congruencyResponses: [],
    createdAt: Date.now(),
  };
}

export function buildCongruencyTrialsFromPicker(run: BatteryRun, perGrapheme: number = 2): CongruencyTrial[] {
  // Use the *last* chosen color for each grapheme (ignoring no-color)
  const lastColorByG = new Map<string, Rgb>();

  for (const resp of run.pickerResponses) {
    if (!resp.isNoColor && resp.rgb) lastColorByG.set(resp.grapheme, resp.rgb);
  }

  const graphemes = [...lastColorByG.keys()];
  const colors = graphemes.map((g) => lastColorByG.get(g)!).filter(Boolean);

  const trials: CongruencyTrial[] = [];
  for (const g of graphemes) {
    const target = lastColorByG.get(g)!;

    for (let i = 0; i < perGrapheme; i++) {
      // congruent
      trials.push({
        id: `c_${g}_${i}_${Math.random().toString(16).slice(2)}`,
        grapheme: g,
        shownRgb: target,
        isCongruent: true,
      });

      // incongruent: pick another grapheme’s color
      const other = pickDifferentColor(colors, target);
      trials.push({
        id: `i_${g}_${i}_${Math.random().toString(16).slice(2)}`,
        grapheme: g,
        shownRgb: other,
        isCongruent: false,
      });
    }
  }
  shuffleInPlace(trials);
  return trials;
}

function pickDifferentColor(all: Rgb[], target: Rgb): Rgb {
  if (all.length <= 1) return target;
  for (let k = 0; k < 20; k++) {
    const c = all[Math.floor(Math.random() * all.length)];
    if (!(c.r === target.r && c.g === target.g && c.b === target.b)) return c;
  }
  return all[0];
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  // h: 0..360, s,v: 0..1
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (hh >= 0 && hh < 1) [r1, g1, b1] = [c, x, 0];
  else if (hh < 2) [r1, g1, b1] = [x, c, 0];
  else if (hh < 3) [r1, g1, b1] = [0, c, x];
  else if (hh < 4) [r1, g1, b1] = [0, x, c];
  else if (hh < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const m = v - c;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function applyGray(rgb: Rgb, gray: number): Rgb {
  // gray: 0..1; blends towards grayscale luminance
  const lum = Math.round(0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b);
  return {
    r: Math.round(rgb.r * (1 - gray) + lum * gray),
    g: Math.round(rgb.g * (1 - gray) + lum * gray),
    b: Math.round(rgb.b * (1 - gray) + lum * gray),
  };
}

// ---- Scoring (Lab distance) ----

export type PickerScoreRow = {
  grapheme: string;
  repeats: (Rgb | null)[];
  meanDeltaE: number; // “inconsistency”
};

export type BatteryResults = {
  pickerScore: number; // lower = more consistent
  pickerRows: PickerScoreRow[];
  congruencyAccuracyPct: number; // 0..100
  congruencyMeanRtSec: number; // seconds
};

export function scoreBattery(run: BatteryRun, repeats: number): BatteryResults {
  const byG = new Map<string, PickerResponse[]>();
  for (const r of run.pickerResponses) {
    if (!byG.has(r.grapheme)) byG.set(r.grapheme, []);
    byG.get(r.grapheme)!.push(r);
  }

  const rows: PickerScoreRow[] = [];
  for (const [g, rs] of byG.entries()) {
    // build repeat slots 0..repeats-1
    const slots: (Rgb | null)[] = Array.from({ length: repeats }, () => null);
    for (const r of rs) {
      if (r.isNoColor || !r.rgb) continue;
      if (r.repeatIndex >= 0 && r.repeatIndex < repeats) slots[r.repeatIndex] = r.rgb;
    }

    const deltas = pairwiseDeltas(slots.filter((x): x is Rgb => !!x));
    const mean = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;

    rows.push({ grapheme: g, repeats: slots, meanDeltaE: mean });
  }

  // overall score: mean of grapheme means (like “consistency” summary)
  const pickerScore = rows.length ? rows.reduce((a, r) => a + r.meanDeltaE, 0) / rows.length : 0;

  const congr = run.congruencyResponses;
  const correctCount = congr.filter((c) => c.correct).length;
  const congruencyAccuracyPct = congr.length ? (correctCount / congr.length) * 100 : 0;
  const congruencyMeanRtSec = congr.length ? congr.reduce((a, c) => a + c.rtMs, 0) / congr.length / 1000 : 0;

  // Sort rows by grapheme like battery table
  rows.sort((a, b) => a.grapheme.localeCompare(b.grapheme, "en"));

  return { pickerScore, pickerRows: rows, congruencyAccuracyPct, congruencyMeanRtSec };
}

function pairwiseDeltas(colors: Rgb[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      out.push(deltaE76(rgbToLab(colors[i]), rgbToLab(colors[j])));
    }
  }
  return out;
}

// sRGB -> XYZ -> Lab (D65)
function rgbToLab(rgb: Rgb): { L: number; a: number; b: number } {
  const { x, y, z } = rgbToXyz(rgb);
  return xyzToLab(x, y, z);
}

function rgbToXyz(rgb: Rgb): { x: number; y: number; z: number } {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  g = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  b = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

  return { x: x * 100, y: y * 100, z: z * 100 };
}

function xyzToLab(x: number, y: number, z: number): { L: number; a: number; b: number } {
  // D65 reference white
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  let xx = x / refX;
  let yy = y / refY;
  let zz = z / refZ;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(xx);
  const fy = f(yy);
  const fz = f(zz);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function deltaE76(a: { L: number; a: number; b: number }, b: { L: number; a: number; b: number }): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}
