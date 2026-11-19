import { catalog } from "./catalog";
import type { Catalog, Conditions } from "./model";
import { createConditions, type ScenarioSeed } from "./scenario";
import { createSampler, type Telemetry } from "./telemetry";

export interface SimulationSnapshot {
  readonly catalog: Catalog;
  readonly conditions: Conditions;
  readonly telemetry: Telemetry;
  readonly startedAt: number;
  readonly elapsedSeconds: number;
}

export interface Simulation {
  getSnapshot(): SimulationSnapshot;
  subscribe(listener: () => void): () => void;
}

// Clock ownership stays with the caller so simulations can run under a test clock.
export function createSession(
  startedAt: number,
  seed: ScenarioSeed = "backup-window",
) {
  if (!Number.isSafeInteger(startedAt))
    throw new RangeError("Expected a start time in epoch milliseconds");
  const conditions = createConditions(seed);
  const reconcile = createSampler(startedAt, seed, conditions);
  let snapshot: SimulationSnapshot = Object.freeze({
    startedAt,
    elapsedSeconds: 0,
    catalog,
    conditions,
    telemetry: reconcile(startedAt),
  });
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    advance(now: number) {
      if (!Number.isSafeInteger(now)) return;
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      if (elapsedSeconds <= snapshot.elapsedSeconds) return;
      snapshot = Object.freeze({
        ...snapshot,
        elapsedSeconds,
        telemetry: reconcile(now, snapshot.telemetry),
      });
      for (const listener of listeners) listener();
    },
  } satisfies Simulation & { advance(now: number): void };
}
