import { describe, expect, it, vi } from "vitest";
import { createSession } from "../src/simulation/session";
import { href, type Route, readRoute, screens } from "../src/ui/routes";

describe("session boundary", () => {
  it("publishes coherent snapshots only when the clock advances", () => {
    const session = createSession(5000);
    const initial = session.getSnapshot();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    session.advance(5999);
    expect(session.getSnapshot()).toBe(initial);
    session.advance(8250);
    expect(session.getSnapshot()).toMatchObject({
      startedAt: 5000,
      elapsedSeconds: 3,
    });
    expect(initial.elapsedSeconds).toBe(0);
    session.advance(6200);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    session.advance(9500);
    expect(session.getSnapshot().elapsedSeconds).toBe(4);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("starts each session independently", () => {
    const first = createSession(0);
    first.advance(60000);
    expect(createSession(60000).getSnapshot()).toMatchObject({
      startedAt: 60000,
      elapsedSeconds: 0,
    });
  });
});

describe("hash routes", () => {
  it("round-trips every screen", () => {
    for (const route of Object.keys(screens) as Route[])
      expect(readRoute(href(route))).toBe(route);
  });
  it.each(["", "#/", "#/missing", "#/constructor"])(
    "defaults %j to Command Center",
    (hash) => {
      expect(readRoute(hash)).toBe("command-center");
    },
  );
});
