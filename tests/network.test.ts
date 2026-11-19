import { expect, it } from "vitest";
import { createSession } from "../src/simulation/session";
import { MINUTE } from "../src/simulation/telemetry";

it.each(["backup-window", "replica-refresh"] as const)(
  "routes the %s circuit through failure and recovery",
  (seed) => {
    const redundant = seed === "backup-window";
    const id = redundant ? "link-tpa-fra" : "link-nyc-tpa";
    const resource = redundant ? "res-fra-orders" : "res-nyc-desk";
    const session = createSession(0, seed);
    function inspect(minute: number) {
      session.advance(minute * MINUTE);
      const s = session.getSnapshot(),
        route = s.telemetry.routes.topology.find((r) => r.primary.id === id);
      if (!route) throw new Error("Missing modeled route");
      expect(
        s.telemetry.routes.geographic.find((r) => r.primary.id === id),
      ).toBe(route);
      return { route, s };
    }
    const normal = inspect(44);
    const failed = inspect(45);
    expect(failed.route.selected?.id ?? null).toBe(
      redundant ? "link-tpa-fra-backup" : null,
    );
    expect(failed.route.forwardMbps + failed.route.reverseMbps).toBe(
      redundant ? 1000 : 0,
    );
    expect(failed.route.lossPercent).toBeGreaterThan(normal.route.lossPercent);
    expect(failed.s.conditions.resourceHealth[resource]).toBe(
      redundant ? "Degraded" : "Critical",
    );
    expect(failed.s.telemetry.current.enterpriseScore).toBeLessThan(
      normal.s.telemetry.current.enterpriseScore,
    );
    const score = failed.s.telemetry.health.contributions.find(
      (c) => c.resourceId === resource,
    )?.effectiveScore;
    if (score === undefined) throw new Error("Missing resource score");
    expect(redundant ? score > 0 : score === 0).toBe(true);
    const incidentId = `${seed}-live-circuit`;
    session.acknowledge(incidentId);
    expect(
      session.getSnapshot().conditions.alerts.find((a) => a.id === incidentId)
        ?.acknowledged,
    ).toBe(true);
    const restored = inspect(50),
      middle = inspect(52),
      end = inspect(55);
    expect(restored.route.selected?.id).toBe(id);
    if (
      restored.route.latencyMs === null ||
      middle.route.latencyMs === null ||
      end.route.latencyMs === null
    )
      throw new Error("Restored path unreachable");
    expect(restored.route.latencyMs).toBeGreaterThan(middle.route.latencyMs);
    expect(middle.route.latencyMs).toBeGreaterThan(end.route.latencyMs);
    expect(end.route.lossPercent).toBe(0);
    expect(end.s.conditions.alerts.some((a) => a.id === incidentId)).toBe(
      false,
    );
    const incident = end.s.journal.incidents.find((i) => i.id === incidentId);
    if (!incident) throw new Error("Missing circuit history");
    expect(incident.timeline.map((e) => e.linkId)).toEqual([id, id, id, id]);
    expect(incident.timeline).toEqual(
      end.s.journal.logs.filter((e) => e.incidentId === incidentId),
    );
    expect(incident.stage).toBe("resolved");
    const suspended = createSession(0, seed);
    suspended.advance(1000 * MINUTE);
    expect(
      suspended
        .getSnapshot()
        .journal.incidents.find((i) => i.id === incidentId)
        ?.timeline.map((e) => e.at),
    ).toEqual([45 * MINUTE, 50 * MINUTE, 55 * MINUTE]);
  },
);
