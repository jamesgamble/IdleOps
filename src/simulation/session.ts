import { catalog } from "./catalog";
import { activeConditions, createJournal, type Journal } from "./events";
import type { Catalog, Conditions, ResourceId } from "./model";
import {
  type Action,
  createOperationalScenario,
  labels,
  type Operation,
  operationHealth,
  stageDuration,
  stages,
  unavailable,
} from "./operations";
import { createConditions, type ScenarioSeed } from "./scenario";
import { createSampler, type Telemetry } from "./telemetry";

export interface SimulationSnapshot {
  readonly operations: Readonly<Partial<Record<ResourceId, Operation>>>;
  readonly catalog: Catalog;
  readonly conditions: Conditions;
  readonly journal: Journal;
  readonly telemetry: Telemetry;
  readonly startedAt: number;
  readonly elapsedSeconds: number;
}

export interface Simulation {
  getSnapshot(): SimulationSnapshot;
  dispatch(action: Action, resourceId: ResourceId, incidentId?: string): string;
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
  const scenario = createOperationalScenario(seed);
  const operations: Record<ResourceId, Operation> = {};
  const operating = (id: ResourceId, at: number) =>
    operationHealth(operations[id], at);
  const reconcile = createSampler(
    startedAt,
    seed,
    conditions,
    scenario,
    operating,
  );
  const telemetry = reconcile(startedAt);
  const journal = createJournal(
    startedAt,
    seed,
    telemetry.markers,
    conditions.alerts,
    scenario,
  );
  let snapshot: SimulationSnapshot = Object.freeze({
    startedAt,
    elapsedSeconds: 0,
    operations: Object.freeze({}),
    catalog,
    conditions,
    telemetry,
    journal: journal.advance(startedAt),
  });
  const listeners = new Set<() => void>();
  function publish(now: number, next: Journal) {
    const base = activeConditions(conditions, next);
    const overrides: Partial<Record<ResourceId, import("./model").Health>> = {};
    for (const op of Object.values(operations)) {
      const health = operationHealth(op, now);
      if (health) overrides[op.resourceId] = health;
    }
    snapshot = Object.freeze({
      ...snapshot,
      journal: next,
      elapsedSeconds: Math.floor((now - startedAt) / 1000),
      conditions: Object.keys(overrides).length
        ? Object.freeze({
            ...base,
            resourceHealth: Object.freeze({
              ...base.resourceHealth,
              ...overrides,
            }),
          })
        : base,
      operations: Object.freeze({ ...operations }),
      telemetry: reconcile(now, snapshot.telemetry),
    });
    for (const listener of listeners) listener();
  }
  function record(op: Operation, at: number) {
    operations[op.resourceId] = Object.freeze(op);
    return journal.operation({
      resourceId: op.resourceId,
      incidentId: op.incidentId,
      at,
      severity: "info",
      message:
        labels[op.action] +
        " · " +
        stages[op.action][op.stage] +
        (op.result ? ` · ${op.result}` : ""),
    });
  }
  function targetIncident(action: Action, resourceId: ResourceId) {
    const endpoint = catalog.links.find(
      (l) => l.id === scenario.circuit.linkId,
    )?.from;
    return snapshot.journal.active.find((i) =>
      i.timeline[0]?.linkId
        ? resourceId === endpoint && action === "run-maintenance"
        : i.resourceId === resourceId && action === "restart-service",
    );
  }
  return {
    dispatch(action: Action, resourceId: ResourceId, incidentId?: string) {
      const resource = catalog.resources.find((r) => r.id === resourceId);
      if (!resource) return "Unknown simulated resource.";
      const reason = unavailable(resource, action, operations[resourceId]);
      if (reason) return reason;
      const repair = targetIncident(action, resourceId);
      if (
        incidentId &&
        !snapshot.journal.active.some(
          (i) =>
            i.id === incidentId &&
            (i.resourceId === resourceId ||
              (i.timeline[0]?.linkId &&
                catalog.links.find((l) => l.id === i.timeline[0]?.linkId)
                  ?.from === resourceId)),
        )
      )
        return "This incident is no longer active for this resource.";
      if (
        incidentId &&
        (action === "restart-service" || action === "run-maintenance") &&
        repair?.id !== incidentId
      )
        return "This operation does not repair the selected incident.";
      const at = startedAt + snapshot.elapsedSeconds * 1000;
      publish(
        at,
        record(
          {
            action,
            resourceId,
            startedAt: at,
            stage: 0,
            incidentId: incidentId ?? repair?.id,
          },
          at,
        ),
      );
      return "";
    },
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
      publish(startedAt + snapshot.elapsedSeconds * 1000, next);
    },
    advance(now: number) {
      if (!Number.isSafeInteger(now)) return;
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      if (elapsedSeconds <= snapshot.elapsedSeconds) return;
      const due: { at: number; op: Operation }[] = [];
      for (const operation of Object.values(operations)) {
        for (
          let stage = operation.stage + 1;
          stage < stages[operation.action].length;
          stage++
        ) {
          const at = operation.startedAt + stage * stageDuration;
          if (at > now) break;
          due.push({ at, op: { ...operation, stage } });
        }
      }
      for (const { at, op } of due.sort((a, b) => a.at - b.at)) {
        const events = journal.advance(at);
        let result: string | undefined;
        if (op.stage === stages[op.action].length - 1) {
          const active = events.active.find((i) => i.id === op.incidentId);
          if (
            active &&
            ((op.action === "restart-service" && !active.timeline[0]?.linkId) ||
              (op.action === "run-maintenance" && active.timeline[0]?.linkId))
          ) {
            scenario.assist(active.id, at - startedAt);
            result = "Recovery sequence accelerated";
          } else if (op.action === "check-health") {
            result =
              "Sampled health: " +
              (activeConditions(conditions, events).resourceHealth[
                op.resourceId
              ] ?? "Unknown");
          } else if (op.action === "diagnose-link") {
            const routes = reconcile(
              at,
              snapshot.telemetry,
            ).routes.topology.filter(
              (r) =>
                r.primary.from === op.resourceId ||
                r.primary.to === op.resourceId,
            );
            result = routes.length
              ? routes
                  .map(
                    (r) =>
                      r.primary.id +
                      " " +
                      r.health +
                      " (" +
                      r.lossPercent.toFixed(1) +
                      "% loss)",
                  )
                  .join(", ")
              : "No attached circuits";
          }
        }
        record({ ...op, result }, at);
      }
      publish(now, journal.advance(now));
    },
  } satisfies Simulation & { advance(now: number): void };
}
