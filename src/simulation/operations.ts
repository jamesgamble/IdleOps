import { episodeAt } from "./episodes";
import type { Health, Resource, ResourceId } from "./model";
import { circuitScenario } from "./network";
import type { ScenarioSeed } from "./scenario";

export const stages = {
  "restart-service": [
    "Requested",
    "Stopping service",
    "Starting service",
    "Verifying health",
    "Complete",
  ],
  "check-health": [
    "Requested",
    "Sampling metrics",
    "Comparing thresholds",
    "Complete",
  ],
  "diagnose-link": [
    "Requested",
    "Tracing simulated path",
    "Measuring packet loss",
    "Complete",
  ],
  "apply-update": [
    "Requested",
    "Checking package",
    "Applying update",
    "Verifying version",
    "Complete",
  ],
  "run-maintenance": [
    "Requested",
    "Draining workload",
    "Servicing resource",
    "Verifying health",
    "Complete",
  ],
} as const;
export type Action = keyof typeof stages;
export const labels: Record<Action, string> = {
  "restart-service": "Restart service",
  "check-health": "Health diagnostic",
  "diagnose-link": "Connectivity test",
  "apply-update": "Apply fictional update",
  "run-maintenance": "Run maintenance",
};
export const stageDuration = 5000;
export interface Operation {
  readonly action: Action;
  readonly resourceId: ResourceId;
  readonly startedAt: number;
  readonly stage: number;
  readonly incidentId?: string;
  readonly result?: string;
}
export function unavailable(
  resource: Resource,
  action: Action,
  operation?: Operation,
) {
  if (!Object.hasOwn(stages, action) || !resource.actions.includes(action))
    return "Unsupported by this resource profile.";
  if (operation && operation.stage < stages[operation.action].length - 1)
    return `${labels[operation.action]} is in progress.`;
  return "";
}
export function operationHealth(
  op: Operation | undefined,
  at: number,
): Health | undefined {
  if (!op) return;
  const step = Math.floor((at - op.startedAt) / stageDuration);
  if (step < 1 || step >= stages[op.action].length - 1) return;
  if (op.action === "restart-service")
    return step === 1 ? "Offline" : "Maintenance";
  if (op.action === "apply-update" || op.action === "run-maintenance")
    return "Maintenance";
}

export function createOperationalScenario(seed: ScenarioSeed) {
  const circuit = circuitScenario(seed);
  const cleared = new Map<string, number>();
  return {
    circuit,
    episode(elapsed: number) {
      const episode = episodeAt(elapsed, seed);
      if (episode && elapsed < (cleared.get(episode.id) ?? Infinity))
        return episode;
    },
    assist(incidentId: string, elapsed: number) {
      // Journal transitions use ten-second ticks. Apply recovery on the next one.
      const tick = (Math.floor(elapsed / 10000) + 1) * 10000;
      if (incidentId === `${seed}-live-circuit`) circuit.assist(tick);
      else if (episodeAt(elapsed, seed)?.id === incidentId)
        cleared.set(incidentId, tick);
    },
  };
}
