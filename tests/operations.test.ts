import { expect, it } from "vitest";
import type { ResourceId } from "../src/simulation/model";
import type { Action } from "../src/simulation/operations";
import { createSession } from "../src/simulation/session";
import { MINUTE } from "../src/simulation/telemetry";

it("allowlists operations, rejects duplicate and conflicting writes, and advances the same resource through shutdown and recovery", () => {
  const sim = createSession(0),
    id = "res-nyc-desk";
  expect(sim.dispatch("restart-service", "localhost" as ResourceId)).toMatch(
    /Unknown/,
  );
  expect(sim.dispatch("__proto__" as Action, id)).toMatch(/Unsupported/);
  expect(sim.dispatch("apply-update", id)).toMatch(/Unsupported/);
  expect(sim.dispatch("restart-service", id)).toBe("");
  expect(sim.dispatch("restart-service", id)).toMatch(/in progress/);
  expect(sim.dispatch("check-health", id)).toMatch(/in progress/);
  sim.advance(5000);
  expect(sim.getSnapshot().conditions.resourceHealth[id]).toBe("Offline");
  expect(sim.getSnapshot().telemetry.current.resources[id]?.networkMbps).toBe(
    0,
  );
  sim.advance(20000);
  expect(sim.getSnapshot().conditions.resourceHealth[id]).toBe("Healthy");
  expect(sim.getSnapshot().operations[id]?.stage).toBe(4);
  expect(sim.dispatch("check-health", id)).toBe("");
  sim.advance(40000);
  expect(sim.getSnapshot().operations[id]?.result).toContain("Healthy");
  const vm = sim
    .getSnapshot()
    .catalog.resources.find((r) => r.actions.includes("apply-update"));
  if (!vm) throw new Error("Missing update profile");
  expect(sim.dispatch("apply-update", vm.id)).toBe("");
  sim.advance(45000);
  expect(sim.getSnapshot().conditions.resourceHealth[vm.id]).toBe(
    "Maintenance",
  );
  sim.advance(60000);
  expect(sim.getSnapshot().operations[vm.id]?.stage).toBe(4);
});
it.each(["backup-window", "replica-refresh"] as const)(
  "recovers the same circuit early under %s without losing the original incident",
  (seed) => {
    const assisted = createSession(0, seed),
      automatic = createSession(0, seed);
    for (const sim of [assisted, automatic]) sim.advance(45 * MINUTE);
    const id = `${seed}-live-circuit`,
      incident = assisted.getSnapshot().journal.active.find((i) => i.id === id);
    if (!incident) throw new Error("Missing circuit incident");
    const routeId = incident.timeline[0]?.linkId;
    const primary = assisted
      .getSnapshot()
      .catalog.links.find((l) => l.id === routeId);
    if (!primary) throw new Error("Missing primary link");
    assisted.acknowledge(id);
    expect(
      assisted.getSnapshot().journal.active.find((i) => i.id === id)
        ?.acknowledged,
    ).toBe(true);
    expect(assisted.dispatch("run-maintenance", primary.from, id)).toBe("");
    for (const sim of [assisted, automatic]) sim.advance(45 * MINUTE + 40000);
    const accepted = assisted.getSnapshot(),
      normal = automatic.getSnapshot();
    expect(normal.journal.active.some((i) => i.id === id)).toBe(true);
    expect(accepted.journal.active.some((i) => i.id === id)).toBe(false);
    expect(accepted.conditions.alerts.some((a) => a.id === id)).toBe(false);
    expect(
      accepted.telemetry.routes.topology.find((r) => r.primary.id === routeId)
        ?.selected?.id,
    ).toBe(routeId);
    expect(accepted.telemetry.health.score).toBeGreaterThan(
      normal.telemetry.health.score,
    );
    expect(
      accepted.telemetry.current.resources[incident.resourceId]?.responseMs,
    ).toBeLessThan(
      normal.telemetry.current.resources[incident.resourceId]?.responseMs ?? 0,
    );
    const history = accepted.journal.incidents.find((i) => i.id === id);
    if (!history) throw new Error("Missing resolved incident");
    expect(history.stage).toBe("resolved");
    expect(history.timeline.map((e) => e.at)).toEqual(
      history.timeline.map((e) => e.at).sort((a, b) => a - b),
    );
    expect(
      history.timeline.some((e) => e.message.includes("accelerated")),
    ).toBe(true);
    expect(
      accepted.journal.logs.some(
        (e) =>
          e.incidentId === id && e.message.includes("normal service resumed"),
      ),
    ).toBe(true);
    assisted.advance(6 * 60 * MINUTE);
    expect(
      assisted.getSnapshot().journal.incidents.find((i) => i.id === id),
    ).toBe(history);
  },
);
it("only clears the queue targeted by a completed restart", () => {
  const sim = createSession(0);
  sim.advance(27 * MINUTE);
  const id = "backup-window-queue-2";
  expect(sim.dispatch("restart-service", "res-nyc-desk", id)).toBe("");
  sim.advance(27 * MINUTE + 30000);
  expect(
    sim.getSnapshot().journal.incidents.find((i) => i.id === id)?.stage,
  ).toBe("resolved");
  expect(sim.getSnapshot().conditions.resourceHealth["res-nyc-desk"]).toBe(
    "Healthy",
  );
});
