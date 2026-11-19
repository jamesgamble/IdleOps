import { catalog } from "./catalog";
import type { LogEntry } from "./events";
import type { SimulationSnapshot } from "./session";

export const levels = [
  "debug",
  "info",
  "warning",
  "error",
  "critical",
] as const;
export const resourceById = new Map(catalog.resources.map((r) => [r.id, r]));
export const cityById = new Map(catalog.sites.map((s) => [s.id, s.city]));

export function securitySummary({ journal, conditions }: SimulationSnapshot) {
  const activity = journal.logs.filter((event) => event.security);
  const failures = activity.filter(
    (event) => event.security === "authentication-failure",
  );
  const incidentIds = new Set(failures.map((event) => event.incidentId));
  const warnings = conditions.alerts.filter((alert) =>
    incidentIds.has(alert.id),
  );
  const perimeter = catalog.resources.filter(
    (r) => r.configuration.kind === "firewall",
  );
  return {
    posture:
      warnings.length ||
      perimeter.some((r) => conditions.resourceHealth[r.id] !== "Healthy")
        ? "Attention"
        : "Nominal",
    perimeter,
    warnings,
    activity,
    failures,
    successes: activity.filter((e) => e.security === "authentication-success")
      .length,
    blocked: activity.filter((e) => e.security === "connection-blocked").length,
  };
}

export interface LogFilters {
  text: string;
  severity: string;
  resource: string;
  location: string;
}
export function filterLogs(
  logs: readonly LogEntry[],
  filters: LogFilters,
  through: number | null,
) {
  const text = filters.text.trim().toLowerCase();
  return logs.filter((event) => {
    const resource = resourceById.get(event.resourceId);
    if (
      !resource ||
      (through !== null && event.sequence > through) ||
      (filters.severity && event.severity !== filters.severity) ||
      (filters.resource && event.resourceId !== filters.resource) ||
      (filters.location && resource.siteId !== filters.location)
    )
      return false;
    return (
      !text ||
      [
        event.message,
        event.resourceId,
        resource.name,
        cityById.get(resource.siteId),
        event.incidentId,
        event.linkId,
        event.severity,
      ].some((field) => field?.toLowerCase().includes(text))
    );
  });
}
