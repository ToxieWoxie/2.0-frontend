// FILE: Syn/lib/BatteryStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BatteryRun } from "./SynesthesiaBattery";

const KEY = (runId: string) => `battery_run:${runId}`;

export const BatteryStore = {
  async saveRun(run: BatteryRun): Promise<void> {
    await AsyncStorage.setItem(KEY(run.runId), JSON.stringify(run));
  },

  async loadRun(runId: string): Promise<BatteryRun | null> {
    const raw = await AsyncStorage.getItem(KEY(runId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BatteryRun;
    } catch {
      return null;
    }
  },

  async clearRun(runId: string): Promise<void> {
    await AsyncStorage.removeItem(KEY(runId));
  },
};
