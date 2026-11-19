export type SiteId = "tampa" | "new-york" | "denver" | "london" | "frankfurt";
export type CloudId = "nebula" | "stratos";
export type ResourceId = `res-${string}`;
export type LinkId = `link-${string}`;

export interface Site {
  readonly id: SiteId;
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly role: string;
  readonly timeZone: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface Cloud {
  readonly id: CloudId;
  readonly name: string;
  readonly role: "primary" | "secondary";
  readonly workloads: readonly string[];
}

export const healthColors = Object.freeze({
  Healthy: "green",
  Degraded: "amber",
  Critical: "red",
  Maintenance: "cyan",
  Offline: "gray",
} as const);
export type Health = keyof typeof healthColors;

type Configuration =
  | {
      readonly category: "Compute";
      readonly kind: "virtual-machine";
      readonly vCPUs: number;
      readonly memoryGiB: number;
    }
  | {
      readonly category: "Applications";
      readonly kind: "application" | "service";
      readonly workers: number;
    }
  | {
      readonly category: "Databases";
      readonly kind: "database";
      readonly maxConnections: number;
    }
  | {
      readonly category: "Storage";
      readonly kind: "object-store";
      readonly capacityTiB: number;
    }
  | {
      readonly category: "Network services";
      readonly kind: "router" | "switch" | "firewall" | "gateway";
      readonly ports: number;
      readonly throughputGbps: number;
    };

export type Metric =
  | "cpuPercent"
  | "responseMs"
  | "connectionsPercent"
  | "capacityPercent"
  | "throughputPercent";
type Action =
  | "inspect"
  | "check-health"
  | "restart-service"
  | "diagnose-link"
  | "run-maintenance";

export interface Profile {
  readonly configuration: Configuration;
  readonly threshold: {
    readonly metric: Metric;
    readonly degraded: number;
    readonly critical: number;
  };
  readonly actions: readonly Action[];
}

export interface Resource extends Profile {
  readonly id: ResourceId;
  readonly name: string;
  readonly purpose: string;
  readonly siteId: SiteId;
  readonly cloudId: CloudId | null;
  readonly importance: "core" | "standard" | "supporting";
  // Directed from consumer to prerequisite. A logical circuit uses its primary link ID.
  readonly dependsOn: readonly (ResourceId | LinkId)[];
}

export interface NetworkLink {
  readonly id: LinkId;
  readonly from: ResourceId;
  readonly to: ResourceId;
  readonly capacityMbps: number;
  readonly backupFor?: LinkId;
}

export interface Catalog {
  readonly organization: string;
  readonly sites: readonly Site[];
  readonly clouds: readonly Cloud[];
  readonly resources: readonly Resource[];
  readonly links: readonly NetworkLink[];
  readonly enterpriseTotals: {
    readonly physicalServers: number;
    readonly virtualMachines: number;
  };
}

export interface ResourceAlert {
  readonly id: string;
  readonly severity: "info";
  readonly resourceId: ResourceId;
  readonly message: string;
}

export interface Conditions {
  // Only catalogued resource IDs have an entry.
  readonly resourceHealth: Readonly<Partial<Record<ResourceId, Health>>>;
  readonly alerts: readonly ResourceAlert[];
}

// Catalogs and initial conditions are acyclic plain data. Freeze before publishing to views.
export function freezeFixture<T extends object>(value: T): Readonly<T> {
  if (!Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      if (child !== null && typeof child === "object") freezeFixture(child);
    }
    Object.freeze(value);
  }
  return value;
}
