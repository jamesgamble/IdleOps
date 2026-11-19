import { securitySummary } from "./security";
import type { SimulationSnapshot } from "./session";
import type { Sample } from "./telemetry";

export const utc = (at: number) => new Date(at).toISOString().slice(11, 19);
export const healthValue = (sample: Sample) => sample.enterpriseScore;
export function activityValue(sample: Sample) {
  const readings = Object.values(sample.resources).filter(
    (r) => r !== undefined,
  );
  return (
    readings.reduce((sum, r) => sum + r.cpuPercent, 0) /
    Math.max(1, readings.length)
  );
}

export function dashboard(snapshot: SimulationSnapshot) {
  const { catalog, conditions, telemetry, journal } = snapshot;
  const resources = new Map(catalog.resources.map((r) => [r.id, r]));
  const clouds = catalog.resources.filter((r) => r.cloudId);
  const security = securitySummary(snapshot);
  const healthy = (r: (typeof clouds)[number]) =>
    conditions.resourceHealth[r.id] === "Healthy";
  const healthyLinks = catalog.links.filter(
    (l) =>
      (telemetry.current.pathHealth[l.id] ?? "Healthy") === "Healthy" &&
      [l.from, l.to].every((id) => conditions.resourceHealth[id] !== "Offline"),
  );
  const active = journal.incidents.filter((i) => i.stage !== "resolved");
  const severity = { critical: 0, error: 1, warning: 2, info: 3, debug: 4 };
  const queue = [...conditions.alerts]
    .sort((a, b) => severity[a.severity] - severity[b.severity])
    .map((alert) => {
      const incident = active.find((i) => i.id === alert.id);
      const since = incident?.timeline[0]?.at ?? snapshot.startedAt;
      return {
        alert,
        resourceName: resources.get(alert.resourceId)?.name ?? alert.resourceId,
        stage: incident?.stage ?? "monitoring",
        since,
        timeline: incident?.timeline ?? [],
      };
    });
  const score = telemetry.health.score.toFixed(1);
  const indicators = [
    {
      name: "Infrastructure health",
      value: score,
      unit: "/ 100",
      detail: "Weighted enterprise score",
      rows: telemetry.health.contributions.map((c) => [
        resources.get(c.resourceId)?.name ?? c.resourceId,
        `${c.state} · weight ${c.weight} · ${c.points.toFixed(2)} pts${c.limitingDependency ? ` · limited by ${c.limitingDependency}` : ""}`,
      ]),
    },
    {
      name: "Active incidents",
      value: String(active.length),
      unit: "open",
      detail: "Queue incidents in progress",
      rows: active.map((i) => [
        resources.get(i.resourceId)?.name ?? i.resourceId,
        i.stage,
      ]),
    },
    {
      name: "Cloud service health",
      value: String(clouds.filter(healthy).length),
      unit: `/ ${clouds.length}`,
      detail: "Healthy cloud resources",
      rows: clouds.map((r) => [
        r.name,
        String(conditions.resourceHealth[r.id]),
      ]),
    },
    {
      name: "Network health",
      value: String(healthyLinks.length),
      unit: `/ ${catalog.links.length}`,
      detail: "Healthy physical paths",
      rows: catalog.links.map((l) => [
        l.id,
        healthyLinks.includes(l)
          ? "Healthy"
          : (telemetry.current.pathHealth[l.id] ?? "Endpoint offline"),
      ]),
    },
    {
      name: "Security status",
      value: security.posture,
      unit: "",
      detail: "Perimeter health and active sign-in warnings",
      rows: [
        ...security.warnings.map((w) => [
          resources.get(w.resourceId)?.name ?? w.resourceId,
          w.message,
        ]),
        ...security.perimeter.map((r) => [
          r.name,
          String(conditions.resourceHealth[r.id]),
        ]),
      ],
    },
    {
      name: "Aggregate system activity",
      value: activityValue(telemetry.current).toFixed(1),
      unit: "% CPU",
      detail: "Mean resource utilization",
      rows: catalog.resources.map((r) => [
        r.name,
        `${telemetry.current.resources[r.id]?.cpuPercent.toFixed(1)}% CPU`,
      ]),
    },
  ];
  const markers: { at: number; phase: string; resourceId: string }[] = [
    ...telemetry.markers,
  ];
  const oldest = telemetry.history[0]?.at ?? telemetry.current.at;
  const newest = telemetry.history.at(-1)?.at ?? telemetry.current.at;
  for (let i = journal.incidents.length - 1; i >= 0; i--) {
    const incident = journal.incidents[i];
    const first = incident?.timeline[0],
      last = incident?.timeline.at(-1);
    if (!incident || !first || !last) continue;
    if (last.at < oldest) break;
    if (incident.id.endsWith("-circuit")) continue;
    if (first.at >= oldest && first.at <= newest)
      markers.push({
        at: first.at,
        phase: "detected",
        resourceId: incident.resourceId,
      });
    if (incident.stage === "resolved" && last.at <= newest)
      markers.push({
        at: last.at,
        phase: "resolved",
        resourceId: incident.resourceId,
      });
  }
  return { indicators, queue, resources, markers };
}
