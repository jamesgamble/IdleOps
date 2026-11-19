import { catalog } from "./catalog";
import { episodeAt } from "./episodes";
import {
  createHealthSelector,
  type EnterpriseHealth,
  type PathHealth,
} from "./health";
import type { Conditions, LinkId, Resource, ResourceId } from "./model";
import { circuitScenario, networkRoutes } from "./network";
import type { ScenarioSeed } from "./scenario";

export const MINUTE = 60_000;
export const DAY = 1440 * MINUTE;
export const HISTORY_LIMIT = DAY / MINUTE + 1; // Both endpoints of a 24-hour chart.
const LIVE_INTERVAL = 5_000;
const scoreHealth = createHealthSelector(catalog);

export interface Reading {
  readonly cpuPercent: number;
  readonly memoryPercent: number;
  readonly capacityPercent: number;
  readonly throughputPercent: number;
  readonly networkMbps: number;
  readonly connectionsPercent: number;
  readonly responseMs: number;
}
export interface Sample {
  readonly at: number;
  readonly resources: Readonly<Partial<Record<ResourceId, Reading>>>;
  readonly enterpriseScore: number;
  readonly pathHealth: PathHealth;
}
interface Marker {
  readonly at: number;
  readonly phase: "onset" | "recovery" | "resolved";
  readonly episodeId: string;
  readonly resourceId: ResourceId;
  readonly linkId: LinkId;
}
export interface Telemetry {
  readonly routes: ReturnType<typeof networkRoutes>;
  readonly current: Sample;
  readonly health: EnterpriseHealth;
  readonly history: readonly Sample[];
  readonly markers: readonly Marker[];
}

const boundedPercent = (n: number) => Math.max(0, Math.min(n, 100));
function bandwidth(resource: Resource) {
  const config = resource.configuration;
  switch (config.category) {
    case "Network services":
      return config.throughputGbps * 1000;
    case "Compute":
      return config.vCPUs * 100;
    case "Storage":
      return 2000;
    case "Databases":
      return 1000;
    case "Applications":
      return config.workers * 50;
  }
}

// Stable per-resource variation, independent of inventory order and sampling cadence.
function phaseFor(id: string) {
  let hash = 0;
  for (const char of id)
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return ((hash % 360) * Math.PI) / 180;
}
const sources = catalog.resources.map((resource) => ({
  resource,
  phase: phaseFor(resource.id),
  capacity: bandwidth(resource),
}));

function measure(
  traffic: number,
  slowLoad: number,
  fill: number,
  capacity: number,
  extraLatency: number,
): Reading {
  const throughputPercent = boundedPercent(traffic);
  const cpuPercent = boundedPercent(12 + 0.89 * throughputPercent);
  // Queues stay short under ordinary load, then grow rapidly as spare capacity disappears.
  const queue = Math.max(0, (cpuPercent - 68) / 32);
  return Object.freeze({
    cpuPercent,
    throughputPercent,
    memoryPercent: boundedPercent(
      25 + 0.46 * slowLoad + 0.16 * throughputPercent,
    ),
    capacityPercent: boundedPercent(fill + 0.025 * slowLoad),
    networkMbps: (capacity * throughputPercent) / 100,
    connectionsPercent: boundedPercent(8 + 0.87 * throughputPercent),
    responseMs:
      12 + 0.45 * throughputPercent + 1000 * queue ** 2 + extraLatency,
  });
}

// Reuse immutable overlapping samples. Work is capped by the visible window even after years away.
export function rollHistory(
  minuteAt: number,
  previous: readonly Sample[] | undefined,
  sample: (at: number) => Sample,
): readonly Sample[] {
  const firstAt = minuteAt - DAY;
  const lastAt = previous?.at(-1)?.at ?? firstAt - MINUTE;
  if (previous && lastAt === minuteAt) return previous;
  const next = previous
    ? previous.slice(Math.min(HISTORY_LIMIT, (minuteAt - lastAt) / MINUTE))
    : [];
  for (
    let at = Math.max(firstAt, lastAt + MINUTE);
    at <= minuteAt;
    at += MINUTE
  )
    next.push(sample(at));
  return Object.freeze(next);
}

export function createSampler(
  startedAt: number,
  seed: ScenarioSeed,
  conditions: Conditions,
) {
  const route = circuitScenario(seed);
  const { linkId, resourceId } = route;
  const episodeId = `${seed}-circuit`;
  const onset = startedAt + route.historicalStart;
  const recovery = onset + 15 * MINUTE;
  const resolved = recovery + 20 * MINUTE;
  const episodeMarkers: readonly Marker[] = [
    { at: onset, phase: "onset", resourceId, linkId, episodeId },
    { at: recovery, phase: "recovery", resourceId, linkId, episodeId },
    { at: resolved, phase: "resolved", resourceId, linkId, episodeId },
    ...route.transitions.map((t) => ({
      at: startedAt + t.elapsed,
      phase: t.phase,
      resourceId,
      linkId,
      episodeId: `${seed}-live-circuit`,
    })),
  ];
  for (const marker of episodeMarkers) Object.freeze(marker);
  const outage: PathHealth = Object.freeze({ [linkId]: "Offline" });
  const normal: PathHealth = Object.freeze({});
  const seedPhase = phaseFor(seed);
  function sample(at: number) {
    const elapsed = at - startedAt;
    const { failed, pressure, serviceHealth } = route.stateAt(elapsed);
    const pathHealth = failed ? outage : normal;
    const episode = episodeAt(elapsed, seed);
    const resourceHealth = { ...conditions.resourceHealth };
    if (pressure) resourceHealth[resourceId] = serviceHealth;
    if (episode && resourceHealth[episode.resourceId] !== "Critical") {
      resourceHealth[episode.resourceId] =
        episode.stage === "critical" ? "Critical" : "Degraded";
    }
    const minutes = at / MINUTE;
    const daily = 9 * Math.sin((minutes * 2 * Math.PI) / 1440 + seedPhase);
    const readings: Partial<Record<ResourceId, Reading>> = {};
    const measurements: Partial<Record<ResourceId, number>> = {};
    for (const { resource, phase, capacity } of sources) {
      const slowLoad =
        40 + daily + 7 * Math.sin(minutes / 48 + phase + seedPhase);
      const effect = resource.id === resourceId ? pressure : 0;
      const degraded = conditions.resourceHealth[resource.id] === "Degraded";
      const demand =
        slowLoad +
        5 * Math.sin(minutes / 9 + phase) +
        2 * Math.sin(minutes * 1.3 + phase);
      const reading = measure(
        demand + (degraded ? 34 : 0) + 64 * effect,
        slowLoad,
        53 + 10 * Math.sin(minutes / 1200 + phase),
        capacity,
        (degraded && resource.threshold.metric === "responseMs"
          ? resource.threshold.degraded
          : 0) +
          effect * (route.standby ? 150 : 800) +
          (episode?.resourceId === resource.id ? episode.delayMs : 0),
      );
      readings[resource.id] = reading;
      measurements[resource.id] = reading[resource.threshold.metric];
    }
    const health = scoreHealth(resourceHealth, pathHealth, measurements);
    const current: Sample = Object.freeze({
      at,
      resources: Object.freeze(readings),
      enterpriseScore: health.score,
      pathHealth,
    });
    return { current, health };
  }

  return function reconcile(now: number, previous?: Telemetry): Telemetry {
    const liveAt =
      startedAt + Math.floor((now - startedAt) / LIVE_INTERVAL) * LIVE_INTERVAL;
    if (previous && liveAt <= previous.current.at) return previous;
    const minuteAt =
      startedAt + Math.floor((now - startedAt) / MINUTE) * MINUTE;
    const firstAt = minuteAt - DAY;
    const latest = sample(liveAt);
    const history = rollHistory(minuteAt, previous?.history, (at) =>
      at === liveAt ? latest.current : sample(at).current,
    );
    return Object.freeze({
      ...latest,
      routes: networkRoutes(route, liveAt - startedAt),
      history,
      markers: Object.freeze(
        episodeMarkers.filter(
          (marker) => marker.at >= firstAt && marker.at <= minuteAt,
        ),
      ),
    });
  };
}
