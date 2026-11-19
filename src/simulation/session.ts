export interface SimulationSnapshot {
  readonly startedAt: number;
  readonly elapsedSeconds: number;
}

export interface Simulation {
  getSnapshot(): SimulationSnapshot;
  subscribe(listener: () => void): () => void;
}

// Clock ownership stays with the caller so simulations can run under a test clock.
export function createSession(startedAt: number) {
  let snapshot: SimulationSnapshot = Object.freeze({
    startedAt,
    elapsedSeconds: 0,
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
      snapshot = Object.freeze({ startedAt, elapsedSeconds });
      for (const listener of listeners) listener();
    },
  } satisfies Simulation & { advance(now: number): void };
}
