import { expect, it } from "vitest";
import { dashboard } from "../src/simulation/dashboard";
import { createSession } from "../src/simulation/session";

it.each(["backup-window", "replica-refresh"] as const)(
  "joins %s alerts and metrics to the current session",
  (seed) => {
    const session = createSession(0, seed);
    const initial = dashboard(session.getSnapshot());
    expect(initial.indicators).toHaveLength(6);
    expect(initial.indicators[1]?.value).toBe("0");
    const onset = seed === "backup-window" ? 25 : 23;
    session.advance((onset + 2) * 60000);
    const active = dashboard(session.getSnapshot());
    expect(active.queue[0]?.alert.severity).toBe("critical");
    expect(active.indicators[1]?.value).toBe("1");
    expect(active.indicators[0]?.value).toBe(
      session.getSnapshot().telemetry.health.score.toFixed(1),
    );
    expect(active.queue[0]?.since).toBe(onset * 60000);
  },
);
