// ============================================================
// BD / Acquisition CRM — config loader.
// Reads AcqConfig rows and merges them over the spec defaults,
// so floors/SLAs are tunable without a redeploy (§5.4).
// ============================================================

import { prisma } from "@/lib/prisma";
import { ACQ_CONFIG_DEFAULTS, type AcqConfigKey } from "./constants";

export type AcqConfig = Record<AcqConfigKey, number>;

export async function getAcqConfig(): Promise<AcqConfig> {
  const rows = await prisma.acqConfig.findMany();
  const merged: AcqConfig = { ...ACQ_CONFIG_DEFAULTS };
  for (const row of rows) {
    if (row.key in merged) {
      const n = Number(row.value);
      if (!Number.isNaN(n)) merged[row.key as AcqConfigKey] = n;
    }
  }
  return merged;
}
