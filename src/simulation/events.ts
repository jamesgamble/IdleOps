import { catalog } from "./catalog";
import type { Severity } from "./episodes";
import type { LinkId } from "./model";
import { type Conditions, freezeFixture, type ResourceId } from "./model";
import type { createOperationalScenario } from "./operations";
import type { ScenarioSeed } from "./scenario";
import { MINUTE, type Telemetry } from "./telemetry";

type SecurityActivity =
  | "authentication-success"
  | "authentication-failure"
  | "connection-blocked";
interface Event {
  readonly security?: SecurityActivity;
  readonly at: number;
  readonly resourceId: ResourceId;
  readonly severity: Severity;
  readonly message: string;
  readonly linkId?: LinkId;
  readonly incidentId?: string;
}
export interface LogEntry extends Event {
  readonly sequence: number;
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
  readonly active: readonly Incident[];
  readonly logs: readonly LogEntry[];
}

export function createJournal(
  start: number,
  seed: ScenarioSeed,
  markers: Telemetry["markers"],
  notices: Conditions["alerts"],
  scenario: ReturnType<typeof createOperationalScenario>,
) {
  const logs: LogEntry[] = [];
  let sequence = 0;
  const incidents = new Map<string, Incident>();
  const acknowledgedNoticeIds = new Set<string>();
  let current: Incident | undefined;
  const active = new Map<string, Incident>();
  const route = scenario.circuit;
  const circuitId = `${seed}-live-circuit`;
  let transitionIndex = 0;
  function record(event: Event) {
    const entry = Object.freeze({ ...event, sequence: ++sequence });
    logs.push(entry);
    return entry;
  }
  function update(
    id: string,
    stage: string,
    event: Event,
    occurrence = false,
    acknowledged = false,
  ) {
    const previous = incidents.get(id);
    const entry = record({ ...event, incidentId: id });
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
    if (stage === "resolved") active.delete(id);
    else active.set(id, incident);
    return incident;
  }
  for (const marker of markers) {
    update(
      marker.episodeId,
      marker.phase,
      {
        at: marker.at,
        linkId: marker.linkId,
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
  record({
    at: start,
    resourceId: "res-tpa-directory",
    severity: "info",
    security: "authentication-success",
    message: "Directory accepted the workspace service sign-in.",
  });
  let cursor = 0;
  let published: Journal;
  function publish() {
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    published = Object.freeze({
      acknowledgedNoticeIds: Object.freeze([...acknowledgedNoticeIds]),
      active: Object.freeze([...active.values()]),
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
    operation(event: Event) {
      const entry = record(event);
      const incident = event.incidentId && incidents.get(event.incidentId);
      if (incident) {
        const next = Object.freeze({
          ...incident,
          timeline: Object.freeze([...incident.timeline, entry]),
        });
        incidents.set(next.id, next);
        if (active.has(next.id)) active.set(next.id, next);
        if (current?.id === next.id) current = next;
      }
      return publish();
    },
    advance(now: number) {
      const tick = Math.floor((now - start) / 10_000);
      if (tick <= cursor) return published;
      // After suspension, retain observed history and rebuild only the recent activity window.
      const first = Math.max(cursor + 1, tick - 599);
      // Replay the rest of an observed episode before skipping unobserved time.
      // Each episode lasts at most five minutes, even after a long suspension.
      for (let i = cursor + 1; i <= tick; i++) {
        const transition = route.transitions[transitionIndex];
        if (!current && i < first)
          i = Math.min(first, transition ? transition.elapsed / 10_000 : first);
        if (transition && i * 10_000 === transition.elapsed) {
          update(
            circuitId,
            transition.phase,
            {
              at: start + transition.elapsed,
              linkId: route.linkId,
              resourceId: route.resourceId,
              severity: transition.severity,
              message: transition.message,
            },
            transition.phase === "onset",
          );
          transitionIndex++;
        }
        const elapsed = i * 10_000;
        const at = start + elapsed;
        const episode = scenario.episode(elapsed);
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
        if (i % 6 === 1) {
          const delayed =
            episode &&
            ["detected", "investigating", "critical"].includes(episode.stage);
          record(
            delayed
              ? {
                  at,
                  resourceId: episode.resourceId,
                  incidentId: episode.id,
                  severity: episode.severity,
                  security: "authentication-failure",
                  message:
                    "Service sign-in timed out while the application queue was delayed.",
                }
              : {
                  at,
                  resourceId: "res-tpa-directory",
                  severity: "info",
                  security: "authentication-success",
                  message: "Directory accepted a service sign-in.",
                },
          );
        } else if (i % 12 === 6) {
          record({
            at,
            resourceId: i % 24 === 6 ? "res-tpa-fw" : "res-fra-fw",
            severity: "info",
            security: "connection-blocked",
            message:
              "Perimeter policy blocked an unapproved inter-zone connection.",
          });
        } else if (resource)
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
      const incident = active.get(id);
      if (!incident || incident.acknowledged) return;
      const acknowledged = update(
        id,
        incident.stage,
        {
          at,
          linkId: incident.timeline[0]?.linkId,
          resourceId: incident.resourceId,
          severity: incident.severity,
          message: "Operator acknowledged the open alert.",
        },
        false,
        true,
      );
      if (current?.id === id) current = acknowledged;
      return publish();
    },
  };
}

export function activeConditions(
  base: Conditions,
  journal: Journal,
): Conditions {
  const alerts = journal.acknowledgedNoticeIds.length
    ? base.alerts.map((alert) =>
        journal.acknowledgedNoticeIds.includes(alert.id)
          ? Object.freeze({ ...alert, acknowledged: true })
          : alert,
      )
    : base.alerts;
  if (!journal.active.length)
    return alerts === base.alerts ? base : freezeFixture({ ...base, alerts });
  const resourceHealth = { ...base.resourceHealth };
  const raised = journal.active.map((incident) => {
    if (resourceHealth[incident.resourceId] !== "Critical")
      resourceHealth[incident.resourceId] =
        incident.severity === "critical" ? "Critical" : "Degraded";
    const first = incident.timeline[0];
    return {
      id: incident.id,
      resourceId: incident.resourceId,
      severity: incident.severity,
      message: first?.linkId
        ? incident.stage === "recovery"
          ? `Restoring ${first.linkId}`
          : first.message
        : "Service queue above baseline",
      acknowledged: incident.acknowledged,
      occurrences: incident.occurrences,
    };
  });
  return freezeFixture<Conditions>({
    resourceHealth,
    alerts: [...alerts, ...raised].sort((a, b) => {
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
