import type { ResourceId } from "./model";
import type { ScenarioSeed } from "./scenario";

export type Severity = "debug" | "info" | "warning" | "error" | "critical";
const minute = 60_000;
export function episodeAt(elapsed: number, seed: ScenarioSeed) {
  // One queue builds in each ten-minute window. Every third batch is larger.
  const slot = Math.floor(elapsed / (10 * minute));
  const offset = seed === "backup-window" ? 0 : 1;
  const start = (slot * 10 + 3 + ((slot + offset) % 3)) * minute;
  const age = elapsed - start;
  const major = slot % 3 === 2;
  if (slot < 0 || age < 0 || age >= (major ? 5 : 3) * minute) return;
  const resourceId: ResourceId =
    (slot + offset) % 2 ? "res-fra-orders" : "res-nyc-desk";
  const stage =
    age < minute
      ? "detected"
      : major && age < 2 * minute
        ? "investigating"
        : major && age < 3 * minute
          ? "critical"
          : age < (major ? 4 : 2) * minute
            ? "recovering"
            : "stabilizing";
  const severity: Severity =
    stage === "critical"
      ? "critical"
      : stage === "investigating"
        ? "error"
        : stage === "stabilizing"
          ? "info"
          : "warning";
  const delayMs = {
    detected: 700,
    investigating: 800,
    critical: 1900,
    recovering: 700,
    stabilizing: 100,
  }[stage];
  return {
    id: `${seed}-queue-${slot}`,
    resourceId,
    stage,
    severity,
    delayMs,
    major,
  } as const;
}
