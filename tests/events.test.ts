import { expect, it, vi } from "vitest";
import { createSession } from "../src/simulation/session";
import { DAY, MINUTE } from "../src/simulation/telemetry";

it.each(["backup-window", "replica-refresh"] as const)(
  "keeps %s alerts, telemetry and incident history consistent",
  (seed) => {
    const session = createSession(0, seed);
    const snapshot = session.getSnapshot;
    const history = snapshot().journal.incidents[0];
    expect(history?.timeline.map((e) => e.at)).toEqual(
      snapshot().telemetry.markers.map((m) => m.at),
    );
    session.advance(MINUTE);
    expect(snapshot().journal.logs.filter((e) => e.at > 0)).toHaveLength(6);
    const onset = (seed === "backup-window" ? 25 : 23) * MINUTE;
    session.advance(onset);
    const detected = snapshot().journal.incidents.at(-1);
    if (!detected) throw new Error("Missing incident");
    session.advance(onset + 30_000);
    expect(
      snapshot().conditions.alerts.filter((a) => a.id === detected.id),
    ).toHaveLength(1);
    expect(
      snapshot().conditions.alerts.find((a) => a.id === detected.id)
        ?.occurrences,
    ).toBe(2);
    session.acknowledge(detected.id);
    const ack = snapshot();
    session.acknowledge(detected.id);
    expect(snapshot()).toBe(ack);
    expect(
      ack.conditions.alerts.find((a) => a.id === detected.id)?.acknowledged,
    ).toBe(true);
    expect(ack.conditions.resourceHealth[detected.resourceId]).toBe("Degraded");
    session.advance(onset + 2 * MINUTE);
    expect(snapshot().conditions.alerts[0]).toMatchObject({
      severity: "critical",
      acknowledged: true,
    });
    expect(snapshot().conditions.resourceHealth[detected.resourceId]).toBe(
      "Critical",
    );
    expect(
      snapshot().telemetry.current.resources[detected.resourceId]?.responseMs,
    ).toBeGreaterThan(900);
    session.advance(onset + 3 * MINUTE);
    expect(snapshot().conditions.alerts[0]?.severity).toBe("warning");
    session.advance(onset + 5 * MINUTE);
    expect(snapshot().conditions.resourceHealth[detected.resourceId]).toBe(
      "Healthy",
    );
    expect(snapshot().conditions.alerts.some((a) => a.id === detected.id)).toBe(
      false,
    );
    expect(new Set(snapshot().journal.logs.map((e) => e.severity))).toEqual(
      new Set(["debug", "info", "warning", "error", "critical"]),
    );
    const resolved = snapshot().journal.incidents.at(-1);
    expect(resolved?.stage).toBe("resolved");
    session.advance(onset + 135 * MINUTE);
    expect(snapshot().journal.logs).toHaveLength(500);
    expect(
      snapshot().journal.logs.some((e) => e.incidentId === detected.id),
    ).toBe(false);
    expect(snapshot().journal.incidents.find((i) => i.id === detected.id)).toBe(
      resolved,
    );
    const major = snapshot().journal.incidents.filter((i) =>
      i.timeline.some((e) => e.severity === "critical"),
    );
    const latest = major.at(-1)?.timeline[0]?.at;
    const prior = major.at(-2)?.timeline[0]?.at;
    if (latest === undefined || prior === undefined)
      throw new Error("Missing major incident");
    expect(latest - prior).toBe(30 * MINUTE);
  },
);

it("closes an observed fault across suspension and publishes once", () => {
  const session = createSession(0);
  session.advance(27 * MINUTE);
  const before = session.getSnapshot().journal.incidents.at(-1);
  const notify = vi.fn();
  session.subscribe(notify);
  session.advance(365 * DAY);
  expect(notify).toHaveBeenCalledTimes(1);
  const journal = session.getSnapshot().journal;
  expect(
    journal.incidents.find((i) => i.id === before?.id)?.timeline.at(-1)?.at,
  ).toBe(30 * MINUTE);
  expect(journal.logs).toHaveLength(500);
  expect(journal.incidents.length).toBeLessThan(20);
});

it("retains each observation once when the replay window starts inside an observed incident", () => {
  const onset = 25 * MINUTE;
  const resume = 125 * MINUTE + 10_000;
  const foreground = createSession(0);
  const suspended = createSession(0);
  for (const session of [foreground, suspended]) {
    session.advance(onset);
    session.acknowledge("backup-window-queue-2");
  }
  foreground.advance(30 * MINUTE);
  foreground.advance(resume);
  suspended.advance(resume);
  const incident = suspended
    .getSnapshot()
    .journal.incidents.find((i) => i.id === "backup-window-queue-2");
  expect(
    incident?.timeline.filter((e) => e.message.startsWith("Queue cleared")),
  ).toHaveLength(1);
  expect(incident).toEqual(
    foreground
      .getSnapshot()
      .journal.incidents.find((i) => i.id === "backup-window-queue-2"),
  );
  expect(incident?.timeline.map((e) => e.at)).toEqual(
    incident?.timeline.map((e) => e.at).sort((a, b) => a - b),
  );
});

it.each(["backup-window", "replica-refresh"] as const)(
  "acknowledges both initial %s notices once and preserves their conditions",
  (seed) => {
    const session = createSession(0, seed);
    const initial = session.getSnapshot();
    for (const notice of initial.conditions.alerts) {
      session.acknowledge(notice.id);
      const seen = session.getSnapshot();
      expect(seen.journal.logs.at(-1)?.resourceId).toBe(notice.resourceId);
      session.acknowledge(notice.id);
      expect(session.getSnapshot()).toBe(seen);
    }
    for (const minutes of [0, 4, 10]) {
      session.advance(minutes * MINUTE);
      const { conditions } = session.getSnapshot();
      for (const notice of initial.conditions.alerts) {
        expect(conditions.alerts.find((a) => a.id === notice.id)).toEqual({
          ...notice,
          acknowledged: true,
        });
        expect(conditions.resourceHealth[notice.resourceId]).toBe("Degraded");
      }
    }
  },
);
