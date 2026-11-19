import { describe, expect, it } from "vitest";
import {
  healthColors,
  type LinkId,
  type ResourceId,
} from "../src/simulation/model";
import { createSession } from "../src/simulation/session";

const { catalog } = createSession(0).getSnapshot();
const { resources, sites, clouds, links, enterpriseTotals } = catalog;
const resourceById = new Map(
  resources.map((resource) => [resource.id, resource]),
);
const linkById = new Map(links.map((link) => [link.id, link]));
const networkDevices = resources.filter(
  (resource) => resource.configuration.category === "Network services",
);

describe("Axiom catalog", () => {
  it("represents the approved sites with usable geographic metadata", () => {
    expect(catalog.organization).toBe("Axiom Industries");
    expect(
      sites.map((s) => [s.city, s.region, s.country, s.role, s.timeZone]),
    ).toEqual([
      [
        "Tampa",
        "Florida",
        "United States",
        "Global headquarters",
        "America/New_York",
      ],
      [
        "New York",
        "New York",
        "United States",
        "East Coast regional office",
        "America/New_York",
      ],
      [
        "Denver",
        "Colorado",
        "United States",
        "Western regional office",
        "America/Denver",
      ],
      [
        "London",
        "England",
        "United Kingdom",
        "European regional office",
        "Europe/London",
      ],
      [
        "Frankfurt",
        "Hesse",
        "Germany",
        "European infrastructure and operations hub",
        "Europe/Berlin",
      ],
    ]);
    for (const site of sites) {
      expect(Math.abs(site.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(site.longitude)).toBeLessThanOrEqual(180);
      expect(() =>
        new Intl.DateTimeFormat("en", { timeZone: site.timeZone }).format(0),
      ).not.toThrow();
    }
    expect(new Set(resources.map((r) => r.siteId))).toEqual(
      new Set(sites.map((s) => s.id)),
    );
  });

  it("assigns local and cloud workloads to the two fictional platforms", () => {
    expect(clouds).toEqual([
      {
        id: "nebula",
        name: "Nebula Cloud",
        role: "primary",
        workloads: expect.arrayContaining([
          "production applications",
          "virtual machines",
          "databases",
        ]),
      },
      {
        id: "stratos",
        name: "Stratos Cloud",
        role: "secondary",
        workloads: expect.arrayContaining([
          "secondary workloads",
          "backup",
          "disaster recovery",
        ]),
      },
    ]);
    expect(new Set(resources.map((r) => r.cloudId))).toEqual(
      new Set([null, "nebula", "stratos"]),
    );
  });

  it("uses unique stable IDs and names, with enterprise-wide counts kept separately", () => {
    const ids = [...sites, ...clouds, ...resources, ...links].map(
      (item) => item.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(resources.map((r) => r.name)).size).toBe(resources.length);
    expect(resources.length).toBeGreaterThanOrEqual(30);
    expect(resources.length).toBeLessThanOrEqual(50);
    expect(enterpriseTotals.physicalServers).toBeGreaterThan(0);
    expect(enterpriseTotals.virtualMachines).toBeGreaterThan(0);
    const total =
      enterpriseTotals.physicalServers + enterpriseTotals.virtualMachines;
    expect(total).toBeGreaterThanOrEqual(100);
    expect(total).toBeLessThanOrEqual(500);
    expect(total).toBeGreaterThan(resources.length);
    expect(resourceById.get("res-tpa-host")?.name).toBe("NEXUS-07");
  });

  it("supplies typed configuration, thresholds and action descriptors for every resource", () => {
    const metrics = {
      Compute: "cpuPercent",
      Applications: "responseMs",
      Databases: "connectionsPercent",
      Storage: "capacityPercent",
      "Network services": "throughputPercent",
    };
    expect(new Set(resources.map((r) => r.configuration.category))).toEqual(
      new Set(Object.keys(metrics)),
    );
    expect(new Set(networkDevices.map((r) => r.configuration.kind))).toEqual(
      new Set(["router", "switch", "firewall", "gateway"]),
    );
    for (const {
      id,
      name,
      purpose,
      configuration,
      threshold,
      actions,
      importance,
    } of resources) {
      expect(id).toMatch(/^res-[a-z0-9-]+$/);
      expect(name).toMatch(/^[A-Z]+-\d{2}$/);
      expect(purpose.trim()).not.toBe("");
      expect(["core", "standard", "supporting"]).toContain(importance);
      expect(actions).toContain("inspect");
      expect(actions).toContain("check-health");
      expect(actions.includes("diagnose-link")).toBe(
        configuration.category === "Network services",
      );
      expect(actions.includes("restart-service")).toBe(
        configuration.category === "Applications",
      );
      for (const [key, value] of Object.entries(configuration)) {
        if (key !== "category" && key !== "kind")
          expect(value).toBeGreaterThan(0);
      }
      expect(threshold.metric).toBe(metrics[configuration.category]);
      expect(threshold.degraded).toBeGreaterThan(0);
      expect(threshold.critical).toBeGreaterThan(threshold.degraded);
      if (threshold.metric.endsWith("Percent"))
        expect(threshold.critical).toBeLessThanOrEqual(100);
    }
  });

  it("connects network devices through valid circuits and pairs backups with primaries", () => {
    const endpoints = new Set<ResourceId>();
    const prerequisites = new Set(resources.flatMap((r) => r.dependsOn));
    for (const link of links) {
      expect(link.from).not.toBe(link.to);
      expect(link.capacityMbps).toBeGreaterThan(0);
      for (const id of [link.from, link.to]) {
        endpoints.add(id);
        const config = resourceById.get(id)?.configuration;
        expect(config?.category).toBe("Network services");
        if (config?.category === "Network services")
          expect(link.capacityMbps).toBeLessThanOrEqual(
            config.throughputGbps * 1000,
          );
      }
      if (link.backupFor) {
        const primary = linkById.get(link.backupFor);
        expect(primary).toBeDefined();
        expect(primary?.id).not.toBe(link.id);
        expect(primary?.backupFor).toBeUndefined();
        expect(new Set([primary?.from, primary?.to])).toEqual(
          new Set([link.from, link.to]),
        );
        expect(prerequisites.has(link.id)).toBe(false);
      }
    }
    expect(endpoints).toEqual(new Set(networkDevices.map((r) => r.id)));
    expect(
      links.some(({ backupFor }) => backupFor && prerequisites.has(backupFor)),
    ).toBe(true);
  });

  it("resolves each dependency path to its prerequisites without cycles", () => {
    type Node = ResourceId | LinkId;
    const graph = new Map<Node, readonly Node[]>();
    for (const resource of resources)
      graph.set(resource.id, resource.dependsOn);
    for (const link of links) graph.set(link.id, [link.from, link.to]);
    const visited = new Set<Node>();
    const visiting = new Set<Node>();
    function visit(id: Node) {
      if (visited.has(id)) return;
      expect(visiting.has(id), `cycle at ${id}`).toBe(false);
      const children = graph.get(id);
      if (!children) throw new Error(`Missing prerequisite ${id}`);
      expect(new Set(children).size).toBe(children.length);
      visiting.add(id);
      for (const child of children) visit(child);
      visiting.delete(id);
      visited.add(id);
    }
    for (const id of graph.keys()) visit(id);
    // This representative application crosses both service and network boundaries.
    expect(resourceById.get("res-fra-orders")?.dependsOn).toEqual(
      expect.arrayContaining([
        "res-fra-db",
        "res-tpa-directory",
        "link-tpa-fra",
      ]),
    );
  });
});

describe("session startup", () => {
  it("defines all five approved health states and colors", () => {
    expect(healthColors).toEqual({
      Healthy: "green",
      Degraded: "amber",
      Critical: "red",
      Maintenance: "cyan",
      Offline: "gray",
    });
  });

  it.each(["backup-window", "replica-refresh"] as const)(
    "reproduces the %s seed with mild degradation and linked info alerts",
    (seed) => {
      const { conditions } = createSession(10, seed).getSnapshot();
      expect(conditions).toEqual(
        createSession(95, seed).getSnapshot().conditions,
      );
      expect(new Set(Object.keys(conditions.resourceHealth))).toEqual(
        new Set(resourceById.keys()),
      );
      const degraded = resources.filter(
        (r) => conditions.resourceHealth[r.id] === "Degraded",
      );
      const healthy = resources.filter(
        (r) => conditions.resourceHealth[r.id] === "Healthy",
      );
      expect(degraded.length).toBeGreaterThan(0);
      expect(healthy.length).toBeGreaterThan(resources.length * 0.9);
      expect(healthy.length + degraded.length).toBe(resources.length);
      expect(new Set(conditions.alerts.map((alert) => alert.id)).size).toBe(
        conditions.alerts.length,
      );
      expect(
        new Set(conditions.alerts.map((alert) => alert.resourceId)),
      ).toEqual(new Set(degraded.map((r) => r.id)));
      for (const alert of conditions.alerts) {
        expect(alert.severity).toBe("info");
        expect(alert.message.trim()).not.toBe("");
      }
    },
  );

  it("keeps catalog and condition identities across ticks and isolates session starts", () => {
    const session = createSession(0);
    const initial = session.getSnapshot();
    session.advance(2000);
    expect(session.getSnapshot().catalog).toBe(initial.catalog);
    expect(session.getSnapshot().conditions).toBe(initial.conditions);
    expect(Object.isFrozen(initial.catalog.resources[0]?.configuration)).toBe(
      true,
    );
    expect(Object.isFrozen(initial.conditions.resourceHealth)).toBe(true);
    expect(Object.isFrozen(initial.conditions.alerts[0])).toBe(true);
    const other = createSession(10, "replica-refresh").getSnapshot();
    expect(other.catalog).toBe(initial.catalog);
    expect(other.conditions.resourceHealth).not.toEqual(
      initial.conditions.resourceHealth,
    );
    expect(createSession(0).getSnapshot().conditions).not.toBe(
      initial.conditions,
    );
  });
});
