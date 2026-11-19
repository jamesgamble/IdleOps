import { describe, expect, it } from "vitest";
import { catalog } from "../src/simulation/catalog";
import {
  createHealthSelector,
  type EnterpriseHealth,
} from "../src/simulation/health";
import type { ResourceId } from "../src/simulation/model";

const health = createHealthSelector(catalog);
function row(report: EnterpriseHealth, id: ResourceId) {
  const result = report.contributions.find((c) => c.resourceId === id);
  if (!result) throw new Error(`No contribution for ${id}`);
  return result;
}

describe("enterprise score", () => {
  it("attributes the entire score to the named resources and weights leaf failures by importance", () => {
    const nominal = health({}, {});
    const core = health({ "res-fra-orders": "Offline" }, {});
    const supporting = health({ "res-fra-reports": "Offline" }, {});
    expect(nominal.score).toBeCloseTo(100);
    expect(nominal.contributions.map((c) => c.resourceId)).toEqual(
      catalog.resources.map((r) => r.id),
    );
    expect(nominal.score - core.score).toBeCloseTo(
      4 * (nominal.score - supporting.score),
    );
    expect(core.score).toBeCloseTo(
      core.contributions.reduce((sum, c) => sum + c.points, 0),
    );
    expect(row(core, "res-fra-orders")).toMatchObject({
      ownScore: 0,
      effectiveScore: 0,
      weight: 4,
      points: 0,
    });
  });
  it("propagates a prerequisite through multiple levels without repeated losses on parallel paths", () => {
    const report = health({ "res-tpa-host": "Critical" }, {});
    expect(row(report, "res-tpa-db")).toMatchObject({
      ownScore: 100,
      effectiveScore: 30,
      limitingDependency: "res-tpa-host",
    });
    expect(row(report, "res-nyc-desk")).toMatchObject({
      ownScore: 100,
      effectiveScore: 30,
      limitingDependency: "res-tpa-directory",
    });
    expect(row(report, "res-den-backup").effectiveScore).toBe(100);
    expect(
      row(health({}, { "link-tpa-cloud": "Offline" }), "res-tpa-portal")
        .effectiveScore,
    ).toBe(0);
  });
  it("credits a functioning standby, loses protection with either endpoint, and distinguishes an unprotected circuit", () => {
    const primary = "link-tpa-fra";
    const standby = "link-tpa-fra-backup";
    const protectedReport = health({}, { [primary]: "Offline" });
    const lost = health({}, { [primary]: "Offline", [standby]: "Offline" });
    expect(row(protectedReport, "res-fra-orders")).toMatchObject({
      effectiveScore: 79,
      limitingDependency: primary,
    });
    expect(row(lost, "res-fra-orders").effectiveScore).toBe(0);
    expect(protectedReport.score).toBeGreaterThan(lost.score);
    expect(health({}, { [standby]: "Offline" }).score).toBeCloseTo(100);
    for (const id of ["res-tpa-edge", "res-fra-edge"] as const) {
      expect(
        row(
          health({ [id]: "Offline" }, { [primary]: "Offline" }),
          "res-fra-orders",
        ).effectiveScore,
      ).toBe(0);
    }
    expect(
      row(health({}, { "link-nyc-tpa": "Offline" }), "res-nyc-desk")
        .effectiveScore,
    ).toBe(0);
  });
  it("applies the resource profile's threshold alongside its operational state", () => {
    const id = "res-tpa-worker";
    const at = (cpu: number) =>
      row(health({ [id]: "Healthy" }, {}, { [id]: cpu }), id).ownScore;
    expect(at(85)).toBe(100);
    expect(at(91)).toBe(65);
    expect(at(97)).toBe(30);
    expect(
      row(health({ [id]: "Maintenance" }, {}, { [id]: 85 }), id).ownScore,
    ).toBe(50);
  });
});
