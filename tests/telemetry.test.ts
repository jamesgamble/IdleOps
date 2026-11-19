import { isDeepStrictEqual } from "node:util";
import { describe, expect, it, vi } from "vitest";
import type { ResourceId } from "../src/simulation/model";
import { createSession } from "../src/simulation/session";
import {
  DAY,
  HISTORY_LIMIT,
  MINUTE,
  rollHistory,
  type Sample,
} from "../src/simulation/telemetry";

const start = Date.UTC(2026, 0, 12, 9, 0, 13, 375);
function reading(sample: Sample | undefined, id: ResourceId) {
  const value = sample?.resources[id];
  if (!value) throw new Error(`Missing reading for ${id}`);
  return value;
}

describe("rolling telemetry", () => {
  it("backfills an inclusive 24-hour grid and updates live values between historical samples", () => {
    const session = createSession(start);
    const initial = session.getSnapshot().telemetry;
    expect(initial.history).toHaveLength(HISTORY_LIMIT);
    expect(
      initial.history.every((s, i) => s.at === start - DAY + i * MINUTE),
    ).toBe(true);
    expect(initial.current).toBe(initial.history.at(-1));
    expect(Object.keys(initial.current.resources)).toHaveLength(36);
    expect(initial.current.enterpriseScore).toBe(initial.health.score);
    session.advance(start + 1000);
    expect(session.getSnapshot().telemetry).toBe(initial);
    session.advance(start + 5000);
    const live = session.getSnapshot().telemetry;
    expect(live.history).toBe(initial.history);
    expect(live.current.resources).not.toEqual(initial.current.resources);
    session.advance(start + MINUTE);
    const next = session.getSnapshot().telemetry;
    expect(next.history).toHaveLength(HISTORY_LIMIT);
    expect(next.history[0]).toBe(initial.history[1]);
    expect(next.history.at(-1)).toBe(next.current);
    expect(initial.history[0]?.at).toBe(start - DAY);
    expect(Object.isFrozen(next.current.resources["res-fra-orders"])).toBe(
      true,
    );
  });

  it("generates only missing minute samples at and beyond the retention limit", () => {
    const sample = vi.fn(
      (at: number): Sample => ({
        at,
        resources: {},
        pathHealth: {},
        enterpriseScore: 100,
      }),
    );
    let history = rollHistory(start, undefined, sample);
    for (const [elapsed, expected] of [
      [0, 0],
      [MINUTE, 1],
      [DAY + MINUTE, 1440],
      [365 * DAY, HISTORY_LIMIT],
    ] as const) {
      sample.mockClear();
      history = rollHistory(start + elapsed, history, sample);
      expect(sample).toHaveBeenCalledTimes(expected);
      expect(history).toHaveLength(HISTORY_LIMIT);
      expect(history[0]?.at).toBe(start + elapsed - DAY);
    }
  });

  it.each(["backup-window", "replica-refresh"] as const)(
    "aligns %s circuit markers with rising traffic, saturation and gradual recovery",
    (seed) => {
      const { history, markers } = createSession(start, seed).getSnapshot()
        .telemetry;
      expect(markers.map((m) => m.phase)).toEqual([
        "onset",
        "recovery",
        "resolved",
      ]);
      const [onset, recovery, resolved] = markers;
      if (!onset || !recovery || !resolved) throw new Error("Missing episode");
      expect(new Set(markers.map((m) => m.episodeId)).size).toBe(1);
      const at = (t: number) => history.find((s) => s.at === t);
      const metric = (t: number) => reading(at(t), onset.resourceId);
      const before = metric(onset.at - MINUTE);
      const peak = metric(onset.at);
      expect(at(onset.at)?.pathHealth[onset.linkId]).toBe("Offline");
      expect(at(recovery.at)?.pathHealth[onset.linkId]).toBeUndefined();
      expect(peak.networkMbps).toBeGreaterThan(before.networkMbps);
      expect(peak.cpuPercent).toBeGreaterThan(before.cpuPercent);
      expect(peak.memoryPercent).toBeGreaterThan(before.memoryPercent);
      expect(peak.responseMs).toBeGreaterThan(4 * before.responseMs);
      expect(at(onset.at)?.enterpriseScore).toBeLessThan(
        at(onset.at - MINUTE)?.enterpriseScore ?? 0,
      );
      const restored = metric(recovery.at);
      const mid = metric(recovery.at + 10 * MINUTE);
      const end = metric(resolved.at);
      expect(restored.responseMs).toBeGreaterThan(mid.responseMs);
      expect(mid.responseMs).toBeGreaterThan(end.responseMs);
      expect(mid.cpuPercent).toBeGreaterThan(end.cpuPercent);
      expect(at(resolved.at)?.enterpriseScore).toBeGreaterThan(
        at(onset.at)?.enterpriseScore ?? 100,
      );
      for (const key of [
        "cpuPercent",
        "memoryPercent",
        "capacityPercent",
        "throughputPercent",
        "connectionsPercent",
      ] as const) {
        const values = history.map((s) => reading(s, onset.resourceId)[key]);
        expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...values)).toBeLessThanOrEqual(100);
        expect(Math.min(...values)).toBeLessThan(Math.max(...values));
      }
    },
  );

  it("reconciles weeks of inactivity in one publication with the same samples as minute-by-minute advancement", () => {
    const away = createSession(start);
    const steady = createSession(start);
    const notify = vi.fn();
    away.subscribe(notify);
    const day29 = start + 29 * DAY;
    steady.advance(day29);
    for (let i = 1; i <= 1440; i++) steady.advance(day29 + i * MINUTE);
    const returned = day29 + DAY + 15_000;
    steady.advance(returned);
    away.advance(returned);
    const result = away.getSnapshot();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(result.elapsedSeconds).toBe((returned - start) / 1000);
    expect(result.telemetry.history).toHaveLength(HISTORY_LIMIT);
    expect(result.telemetry.history[0]?.at).toBe(day29);
    expect(result.telemetry.history.at(-1)?.at).toBe(day29 + DAY);
    expect(result.telemetry.markers).toHaveLength(0);
    const expected = steady.getSnapshot().telemetry;
    expect(isDeepStrictEqual(result.telemetry.history, expected.history)).toBe(
      true,
    );
    expect(result.telemetry.current).toEqual(expected.current);
    expect(result.telemetry.health).toEqual(expected.health);
    away.advance(start);
    expect(away.getSnapshot()).toBe(result);
  });
});
