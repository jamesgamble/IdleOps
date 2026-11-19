import { catalog } from "./catalog";
import {
  type Conditions,
  freezeFixture,
  type Health,
  type ResourceAlert,
  type ResourceId,
} from "./model";

// Each seed describes two minor, local conditions and their informational notices.
const scenarios = {
  "backup-window": [
    {
      id: "notice-archive-check",
      resourceId: "res-den-backup",
      message:
        "Archive verification is taking longer during a scheduled backup window.",
    },
    {
      id: "notice-report-queue",
      resourceId: "res-fra-reports",
      message: "A queued reporting batch is delaying noninteractive reports.",
    },
  ],
  "replica-refresh": [
    {
      id: "notice-replica-delay",
      resourceId: "res-lon-sync",
      message:
        "The recovery sync service is catching up after an image refresh.",
    },
    {
      id: "notice-worker-load",
      resourceId: "res-fra-batch",
      message:
        "A regional aggregation job is delaying lower-priority work on the reporting host.",
    },
  ],
} as const satisfies Record<string, readonly Omit<ResourceAlert, "severity">[]>;
export type ScenarioSeed = keyof typeof scenarios;

export function createConditions(seed: ScenarioSeed): Conditions {
  const resourceHealth: Partial<Record<ResourceId, Health>> = {};
  for (const resource of catalog.resources)
    resourceHealth[resource.id] = "Healthy";
  const alerts: ResourceAlert[] = scenarios[seed].map((notice) => {
    resourceHealth[notice.resourceId] = "Degraded";
    return { ...notice, severity: "info" };
  });
  return freezeFixture<Conditions>({ resourceHealth, alerts });
}
