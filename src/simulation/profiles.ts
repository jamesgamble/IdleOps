import type { Profile } from "./model";

export const profiles = {
  productionVM: {
    configuration: {
      category: "Compute",
      kind: "virtual-machine",
      vCPUs: 16,
      memoryGiB: 64,
    },
    threshold: { metric: "cpuPercent", degraded: 80, critical: 95 },
    actions: ["inspect", "check-health", "run-maintenance"],
  },
  workerVM: {
    configuration: {
      category: "Compute",
      kind: "virtual-machine",
      vCPUs: 8,
      memoryGiB: 32,
    },
    threshold: { metric: "cpuPercent", degraded: 85, critical: 97 },
    actions: ["inspect", "check-health", "run-maintenance"],
  },
  application: {
    configuration: {
      category: "Applications",
      kind: "application",
      workers: 8,
    },
    threshold: { metric: "responseMs", degraded: 450, critical: 900 },
    actions: ["inspect", "check-health", "restart-service"],
  },
  service: {
    configuration: { category: "Applications", kind: "service", workers: 4 },
    threshold: { metric: "responseMs", degraded: 650, critical: 1500 },
    actions: ["inspect", "check-health", "restart-service"],
  },
  database: {
    configuration: {
      category: "Databases",
      kind: "database",
      maxConnections: 240,
    },
    threshold: { metric: "connectionsPercent", degraded: 75, critical: 90 },
    actions: ["inspect", "check-health", "run-maintenance"],
  },
  storage: {
    configuration: {
      category: "Storage",
      kind: "object-store",
      capacityTiB: 64,
    },
    threshold: { metric: "capacityPercent", degraded: 82, critical: 95 },
    actions: ["inspect", "check-health", "run-maintenance"],
  },
  router: {
    configuration: {
      category: "Network services",
      kind: "router",
      ports: 8,
      throughputGbps: 10,
    },
    threshold: { metric: "throughputPercent", degraded: 78, critical: 94 },
    actions: ["inspect", "check-health", "diagnose-link"],
  },
  switch: {
    configuration: {
      category: "Network services",
      kind: "switch",
      ports: 48,
      throughputGbps: 40,
    },
    threshold: { metric: "throughputPercent", degraded: 82, critical: 96 },
    actions: ["inspect", "check-health", "diagnose-link"],
  },
  firewall: {
    configuration: {
      category: "Network services",
      kind: "firewall",
      ports: 8,
      throughputGbps: 10,
    },
    threshold: { metric: "throughputPercent", degraded: 72, critical: 90 },
    actions: ["inspect", "check-health", "diagnose-link"],
  },
  gateway: {
    configuration: {
      category: "Network services",
      kind: "gateway",
      ports: 4,
      throughputGbps: 10,
    },
    threshold: { metric: "throughputPercent", degraded: 80, critical: 94 },
    actions: ["inspect", "check-health", "diagnose-link"],
  },
} as const satisfies Record<string, Profile>;
