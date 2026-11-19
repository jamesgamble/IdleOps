import { catalog } from "./catalog";
import type { Catalog, Conditions } from "./model";
import { createConditions, type ScenarioSeed } from "./scenario";

export interface SimulationSnapshot {
  readonly catalog: Catalog;
  readonly conditions: Conditions;
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
  let snapshot: SimulationSnapshot = Object.freeze({
    startedAt,
    elapsedSeconds: 0,
    catalog,
    conditions: createConditions(seed),
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
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      if (elapsedSeconds <= snapshot.elapsedSeconds) return;
      snapshot = Object.freeze({ ...snapshot, elapsedSeconds });
      for (const listener of listeners) listener();
    },
  } satisfies Simulation & { advance(now: number): void };
}
