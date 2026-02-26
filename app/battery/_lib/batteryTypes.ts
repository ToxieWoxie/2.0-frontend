export type Rgb = { r: number; g: number; b: number };

export type PickerResponse = {
  grapheme: string;
  kind: "grapheme" | "weekday";
  repeatIndex: number;        // 0..repeats-1
  trialIndex: number;         // global index through randomized trials
  atMs: number;
  isNoColor: boolean;
  rgb?: Rgb;
  hex?: string;
};

export type CongruencyResponse = {
  trialIndex: number;
  atMs: number;
  rtMs: number;
  correct: boolean;
  expectedMatch: boolean;
  stimulusText: string;
  shownHex: string;
  chosen: "match" | "mismatch";
};

export type BatteryRunPayload = {
  version: 1;
  createdAtMs: number;
  repeats: number;

  // metadata about what was tested
  pickerPlan: { graphemes: string[]; weekdays: string[] };

  pickerResponses: PickerResponse[];
  congruencyResponses: CongruencyResponse[];

  // optional: store calibration / settings
  meta?: Record<string, any>;
};
