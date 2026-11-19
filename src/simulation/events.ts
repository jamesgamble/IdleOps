import { catalog } from "./catalog";
import { episodeAt, type Severity } from "./episodes";
import { type Conditions, freezeFixture, type ResourceId } from "./model";
import type { ScenarioSeed } from "./scenario";
import { MINUTE, type Telemetry } from "./telemetry";

interface Event {
  readonly at: number;
  readonly resourceId: ResourceId;
  readonly severity: Severity;
  readonly message: string;
  readonly incidentId?: string;
}
interface Incident {
  readonly id: string;
  readonly resourceId: ResourceId;
  readonly stage: string;
  readonly severity: Severity;
  readonly acknowledged: boolean;
  readonly occurrences: number;
  readonly timeline: readonly Event[];
}
export interface Journal {
  readonly acknowledgedNoticeIds: readonly string[];
  readonly incidents: readonly Incident[];
  readonly logs: readonly Event[];
}

export function createJournal(
  start: number,
  seed: ScenarioSeed,
  markers: Telemetry["markers"],
  notices: Conditions["alerts"],
) {
  const logs: Event[] = [];
  const incidents = new Map<string, Incident>();
  const acknowledgedNoticeIds = new Set<string>();
  let current: Incident | undefined;
  function record(event: Event) {
    logs.push(Object.freeze(event));
  }
  function update(
    id: string,
    stage: string,
    event: Event,
    occurrence = false,
    acknowledged = false,
  ) {
    const previous = incidents.get(id);
    const entry = Object.freeze({ ...event, incidentId: id });
    record(entry);
    const incident = Object.freeze({
      id,
      resourceId: event.resourceId,
      stage,
      severity: event.severity,
      acknowledged: acknowledged || previous?.acknowledged || false,
      occurrences: (previous?.occurrences ?? 0) + Number(occurrence),
      timeline: Object.freeze([...(previous?.timeline ?? []), entry]),
    });
    incidents.set(id, incident);
    return incident;
  }
  for (const marker of markers) {
    update(
      marker.episodeId,
      marker.phase,
      {
        at: marker.at,
        resourceId: marker.resourceId,
        severity: marker.phase === "onset" ? "error" : "info",
        message: {
          onset: "Circuit interrupted",
          recovery: "Circuit restored, draining backlog",
          resolved: "Backlog cleared",
        }[marker.phase],
      },
      marker.phase === "onset",
    );
  }
  let cursor = 0;
  let published: Journal;
  function publish() {
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    published = Object.freeze({
      acknowledgedNoticeIds: Object.freeze([...acknowledgedNoticeIds]),
      incidents: Object.freeze([...incidents.values()]),
      logs: Object.freeze([...logs]),
    });
    return published;
  }
  publish();
  function resolve(at: number) {
    if (!current) return;
    update(current.id, "resolved", {
      at,
      resourceId: current.resourceId,
      severity: "info",
      message: "Queue cleared; response time returned to baseline.",
    });
    current = undefined;
  }
  return {
    advance(now: number) {
      const tick = Math.floor((now - start) / 10_000);
      if (tick <= cursor) return published;
      // After suspension, retain observed history and rebuild only the recent activity window.
      const first = Math.max(cursor + 1, tick - 599);
      // Replay the rest of an observed episode before skipping unobserved time.
      // Each episode lasts at most five minutes, even after a long suspension.
      for (let i = cursor + 1; i <= tick; i++) {
        if (!current && i < first) i = first;
        const elapsed = i * 10_000;
        const at = start + elapsed;
        const episode = episodeAt(elapsed, seed);
        if (current && current.id !== episode?.id) resolve(at);
        if (
          episode &&
          (episode.stage !== current?.stage || elapsed % MINUTE === 30_000)
        ) {
          const message = {
            detected: "Queue depth above baseline",
            investigating: "Retries increasing during queue investigation",
            critical: "Queue saturation delaying requests",
            recovering: "Workers draining queued requests",
            stabilizing: "Response time stabilizing",
          }[episode.stage];
          current = update(
            episode.id,
            episode.stage,
            {
              at,
              resourceId: episode.resourceId,
              severity: episode.severity,
              message,
            },
            episode.stage !== "stabilizing",
          );
        }
        const resource = catalog.resources[i % catalog.resources.length];
        if (resource)
          record({
            at,
            resourceId: resource.id,
            severity: i % 3 ? "debug" : "info",
            message:
              i % 317 === 0
                ? "Inventory checksum verified. All electrons accounted for."
                : i % 3
                  ? "Local metrics sample collected."
                  : "Inventory heartbeat received.",
          });
      }
      cursor = tick;
      return publish();
    },
    acknowledge(id: string, at: number) {
      const notice = notices.find((alert) => alert.id === id);
      if (notice) {
        if (acknowledgedNoticeIds.has(id)) return;
        acknowledgedNoticeIds.add(id);
        record({
          at,
          resourceId: notice.resourceId,
          severity: notice.severity,
          message: `Operator acknowledged: ${notice.message}`,
        });
        return publish();
      }
      if (!current || current.id !== id || current.acknowledged) return;
      current = update(
        id,
        current.stage,
        {
          at,
          resourceId: current.resourceId,
          severity: current.severity,
          message: "Operator acknowledged the open alert.",
        },
        false,
        true,
      );
      return publish();
    },
  };
}

export function activeConditions(
  base: Conditions,
  journal: Journal,
): Conditions {
  const incident = journal.incidents.at(-1);
  const alerts = journal.acknowledgedNoticeIds.length
    ? base.alerts.map((alert) =>
        journal.acknowledgedNoticeIds.includes(alert.id)
          ? Object.freeze({ ...alert, acknowledged: true })
          : alert,
      )
    : base.alerts;
  if (!incident || incident.stage === "resolved")
    return alerts === base.alerts ? base : freezeFixture({ ...base, alerts });
  return freezeFixture<Conditions>({
    resourceHealth: {
      ...base.resourceHealth,
      [incident.resourceId]:
        incident.severity === "critical" ? "Critical" : "Degraded",
    },
    alerts: [
      ...alerts,
      {
        id: incident.id,
        resourceId: incident.resourceId,
        severity: incident.severity,
        message: "Service queue above baseline",
        acknowledged: incident.acknowledged,
        occurrences: incident.occurrences,
      },
    ].sort((a, b) => {
      const rank: Record<Severity, number> = {
        critical: 0,
        error: 1,
        warning: 2,
        info: 3,
        debug: 4,
      };
      return rank[a.severity] - rank[b.severity];
    }),
  });
}
