export const DEFAULT_GRAPHEMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const DEFAULT_DIGITS = "0123456789".split("");
export const DEFAULT_WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export type PickerTrial = {
  grapheme: string;
  kind: "grapheme" | "weekday";
  repeatIndex: number;
};

function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = arr.slice();
  let s = seed ?? Date.now();
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildPickerTrials(opts: {
  graphemes: string[];
  weekdays: string[];
  repeats: number;
  seed?: number;
}) {
  const trials: PickerTrial[] = [];

  for (let r = 0; r < opts.repeats; r++) {
    for (const g of opts.graphemes) trials.push({ grapheme: g, kind: "grapheme", repeatIndex: r });
    for (const d of opts.weekdays) trials.push({ grapheme: d, kind: "weekday", repeatIndex: r });
  }

  return shuffle(trials, opts.seed);
}
