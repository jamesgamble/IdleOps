import { expect, it } from "vitest";
import { dashboard } from "../src/simulation/dashboard";
import {
  filterLogs,
  resourceById,
  securitySummary,
} from "../src/simulation/security";
import { createSession } from "../src/simulation/session";
import { MINUTE } from "../src/simulation/telemetry";

it.each(["backup-window", "replica-refresh"] as const)(
  "reflects %s sign-in failures and recovery throughout the shared session",
  (seed) => {
    const session = createSession(0, seed);
    session.advance(MINUTE);
    let state = session.getSnapshot(),
      security = securitySummary(state);
    expect(security.successes).toBeGreaterThan(0);
    expect(security.blocked).toBe(1);
    expect(security.posture).toBe("Nominal");
    expect(state.journal.logs.filter((e) => e.at > 0)).toHaveLength(6);
    const onset = (seed === "backup-window" ? 25 : 23) * MINUTE;
    session.advance(onset + 2 * MINUTE + 10_000);
    state = session.getSnapshot();
    security = securitySummary(state);
    const failure = security.failures.at(-1);
    expect(failure?.severity).toBe("critical");
    expect(
      security.warnings.find((w) => w.id === failure?.incidentId)?.severity,
    ).toBe("critical");
    expect(
      dashboard(state).indicators.find((i) => i.name === "Security status")
        ?.value,
    ).toBe("Attention");
    expect(
      state.journal.logs.filter((e) => e.at >= onset && e.at < onset + MINUTE)
        .length,
    ).toBeGreaterThan(6);
    if (!failure) throw new Error("Missing sign-in failure");
    const resource = resourceById.get(failure.resourceId);
    const filters = {
      text: "SIGN-IN",
      severity: "critical",
      resource: failure.resourceId,
      location: resource?.siteId ?? "",
    };
    expect(filterLogs(state.journal.logs, filters, failure.sequence)).toContain(
      failure,
    );
    expect(
      filterLogs(state.journal.logs, { ...filters, location: "denver" }, null),
    ).toHaveLength(0);
    expect(
      filterLogs(state.journal.logs, filters, failure.sequence - 1),
    ).not.toContain(failure);
    session.advance(onset + 5 * MINUTE);
    expect(securitySummary(session.getSnapshot()).posture).toBe("Nominal");
    expect(securitySummary(session.getSnapshot()).failures).toContain(failure);
    session.advance(240 * MINUTE);
    const logs = session.getSnapshot().journal.logs;
    expect(logs).toHaveLength(500);
    expect(new Set(logs.map((e) => e.sequence)).size).toBe(500);
    expect(filterLogs(logs, filters, failure.sequence)).toHaveLength(0);
  },
);
