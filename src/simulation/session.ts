import { catalog } from "./catalog";
import { activeConditions, createJournal, type Journal } from "./events";
import type { Catalog, Conditions } from "./model";
import { createConditions, type ScenarioSeed } from "./scenario";
import { createSampler, type Telemetry } from "./telemetry";

export interface SimulationSnapshot {
  readonly catalog: Catalog;
  readonly conditions: Conditions;
  readonly journal: Journal;
  readonly telemetry: Telemetry;
  readonly startedAt: number;
  readonly elapsedSeconds: number;
}

export interface Simulation {
  getSnapshot(): SimulationSnapshot;
  acknowledge(id: string): void;
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
  const telemetry = reconcile(startedAt);
  const journal = createJournal(
    startedAt,
    seed,
    telemetry.markers,
    conditions.alerts,
  );
  let snapshot: SimulationSnapshot = Object.freeze({
    startedAt,
    elapsedSeconds: 0,
    catalog,
    conditions,
    telemetry,
    journal: journal.advance(startedAt),
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
    acknowledge(id: string) {
      const next = journal.acknowledge(
        id,
        startedAt + snapshot.elapsedSeconds * 1000,
      );
      if (!next) return;
      snapshot = Object.freeze({
        ...snapshot,
        journal: next,
        conditions: activeConditions(conditions, next),
      });
      for (const listener of listeners) listener();
    },
    advance(now: number) {
      if (!Number.isSafeInteger(now)) return;
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      if (elapsedSeconds <= snapshot.elapsedSeconds) return;
      const next = journal.advance(now);
      snapshot = Object.freeze({
        ...snapshot,
        journal: next,
        conditions:
          next === snapshot.journal
            ? snapshot.conditions
            : activeConditions(conditions, next),
        elapsedSeconds,
        telemetry: reconcile(now, snapshot.telemetry),
      });
      for (const listener of listeners) listener();
    },
  } satisfies Simulation & { advance(now: number): void };
}
