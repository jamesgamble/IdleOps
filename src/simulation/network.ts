import { catalog } from "./catalog";
import type { Health, LinkId, NetworkLink, ResourceId } from "./model";
import type { ScenarioSeed } from "./scenario";

const minute = 60_000;
const primaries = catalog.links.filter((link) => !link.backupFor);
const standbys = new Map(
  catalog.links
    .filter((link) => link.backupFor)
    .map((link) => [link.backupFor, link]),
);
const sites = new Map(
  catalog.resources.map((resource) => [resource.id, resource.siteId]),
);

export function circuitScenario(seed: ScenarioSeed) {
  const redundant = seed === "backup-window";
  const linkId: LinkId = redundant ? "link-tpa-fra" : "link-nyc-tpa";
  const resourceId: ResourceId = redundant ? "res-fra-orders" : "res-nyc-desk";
  const historicalStart = -(redundant ? 180 : 360) * minute;
  const liveStart = 45 * minute;
  const standby = standbys.get(linkId);
  return {
    linkId,
    resourceId,
    standby,
    transitions: [
      {
        elapsed: liveStart,
        phase: "onset",
        severity: standby ? "warning" : "critical",
        message: standby
          ? `Primary ${linkId} offline; traffic transferred to ${standby.id}.`
          : `Primary ${linkId} offline; no reachable path.`,
      },
      {
        elapsed: liveStart + 5 * minute,
        phase: "recovery",
        severity: "warning",
        message: `Primary ${linkId} restored; traffic returning and queues draining.`,
      },
      {
        elapsed: liveStart + 10 * minute,
        phase: "resolved",
        severity: "info",
        message: `Primary ${linkId} stable; normal service resumed.`,
      },
    ] as const,
    historicalStart,
    stateAt(elapsed: number) {
      const historical = elapsed < 0;
      const age = elapsed - (historical ? historicalStart : liveStart);
      const outage = (historical ? 15 : 5) * minute;
      const drain = (historical ? 20 : 5) * minute;
      const failed = age >= 0 && age < outage;
      const pressure = failed
        ? 1
        : age >= outage
          ? Math.max(0, 1 - (age - outage) / drain)
          : 0;
      const serviceHealth: Health =
        failed && !standby ? "Critical" : pressure ? "Degraded" : "Healthy";
      return { failed, pressure, serviceHealth };
    },
  };
}

export interface RouteReading {
  readonly primary: NetworkLink;
  readonly selected: NetworkLink | null;
  readonly health: Health;
  readonly forwardMbps: number;
  readonly reverseMbps: number;
  readonly latencyMs: number | null;
  readonly lossPercent: number;
}
export function networkRoutes(
  scenario: ReturnType<typeof circuitScenario>,
  elapsed: number,
) {
  const { failed, pressure } = scenario.stateAt(elapsed);
  const topology: readonly RouteReading[] = Object.freeze(
    primaries.map((primary) => {
      const affected = primary.id === scenario.linkId;
      const selected =
        affected && failed ? (scenario.standby ?? null) : primary;
      const backlog = affected ? pressure : 0;
      const demand =
        primary.capacityMbps *
        (0.27 + 0.035 * Math.sin(elapsed / (18 * minute)));
      const carried = Math.min(
        demand * (1 - 0.02 * backlog),
        selected?.capacityMbps ?? 0,
      );
      return Object.freeze({
        primary,
        selected,
        health: selected ? (backlog ? "Degraded" : "Healthy") : "Offline",
        forwardMbps: carried * 0.65,
        reverseMbps: carried * 0.35,
        latencyMs: selected
          ? 12 + backlog * (scenario.standby ? 65 : 150)
          : null,
        lossPercent: 100 * (1 - carried / demand),
      } satisfies RouteReading);
    }),
  );
  // Both renderers consume the same route objects, oriented from primary.from to primary.to.
  return Object.freeze({
    topology,
    geographic: Object.freeze(
      topology.filter(
        ({ primary }) => sites.get(primary.from) !== sites.get(primary.to),
      ),
    ),
  });
}
