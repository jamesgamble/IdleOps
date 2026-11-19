import type {
  Catalog,
  Conditions,
  Health,
  LinkId,
  NetworkLink,
  Resource,
  ResourceId,
} from "./model";

type Dependency = ResourceId | LinkId;
export type PathHealth = Readonly<Partial<Record<LinkId, Health>>>;
export interface Contribution {
  readonly resourceId: ResourceId;
  readonly state: Health;
  readonly weight: number;
  readonly ownScore: number;
  readonly effectiveScore: number;
  readonly limitingDependency?: Dependency;
  readonly points: number;
}
export interface EnterpriseHealth {
  readonly score: number;
  readonly contributions: readonly Contribution[];
}

const weights = { core: 4, standard: 2, supporting: 1 };
const stateScore = {
  Healthy: 100,
  Degraded: 75,
  Critical: 30,
  Maintenance: 50,
  Offline: 0,
} satisfies Record<Health, number>;

// Resolve catalog references once. The catalog tests enforce an acyclic prerequisite graph.
export function createHealthSelector(catalog: Catalog) {
  const resources = new Map(catalog.resources.map((r) => [r.id, r]));
  const links = new Map(catalog.links.map((link) => [link.id, link]));
  const backups = new Map<LinkId, NetworkLink[]>();
  const wiredEdges = new Map<string, NetworkLink>();
  for (const link of catalog.links) {
    if (link.backupFor) {
      const group = backups.get(link.backupFor) ?? [];
      group.push(link);
      backups.set(link.backupFor, group);
    } else {
      wiredEdges.set(`${link.from}/${link.to}`, link);
      wiredEdges.set(`${link.to}/${link.from}`, link);
    }
  }
  const totalWeight = catalog.resources.reduce(
    (sum, r) => sum + weights[r.importance],
    0,
  );

  return function scoreHealth(
    conditions: Conditions["resourceHealth"],
    paths: PathHealth,
    measurements: Readonly<Partial<Record<ResourceId, number>>> = {},
  ): EnterpriseHealth {
    const evaluated = new Map<ResourceId, Contribution>();
    function circuitScore(link: NetworkLink) {
      let score = stateScore[paths[link.id] ?? "Healthy"];
      for (const backup of backups.get(link.id) ?? []) {
        // A usable standby retains service at reduced capacity.
        const credit =
          0.75 + 0.2 * Math.min(1, backup.capacityMbps / link.capacityMbps);
        score = Math.max(
          score,
          credit * stateScore[paths[backup.id] ?? "Healthy"],
        );
      }
      return score;
    }
    function evaluate(resource: Resource): Contribution {
      const cached = evaluated.get(resource.id);
      if (cached) return cached;
      const state = conditions[resource.id] ?? "Healthy";
      const { degraded, critical } = resource.threshold;
      const pressure = Math.max(
        0,
        Math.min(
          1,
          ((measurements[resource.id] ?? 0) - degraded) / (critical - degraded),
        ),
      );
      const ownScore = Math.min(stateScore[state], 100 - 70 * pressure);
      let effectiveScore = ownScore;
      let limitingDependency: Dependency | undefined;
      function limit(score: number, dependency: Dependency) {
        if (score < effectiveScore) {
          effectiveScore = score;
          limitingDependency = dependency;
        }
      }
      for (const id of resource.dependsOn) {
        const supplier = resources.get(id as ResourceId);
        if (supplier) {
          limit(evaluate(supplier).effectiveScore, id);
          const wire = wiredEdges.get(`${resource.id}/${id}`);
          if (wire) limit(circuitScore(wire), wire.id);
        } else {
          const link = links.get(id as LinkId);
          if (!link) throw new Error(`Unknown prerequisite ${id}`);
          const from = resources.get(link.from);
          const to = resources.get(link.to);
          if (!from || !to) throw new Error(`Unknown endpoint on ${id}`);
          limit(
            Math.min(
              circuitScore(link),
              evaluate(from).effectiveScore,
              evaluate(to).effectiveScore,
            ),
            id,
          );
        }
      }
      const weight = weights[resource.importance];
      const result = Object.freeze({
        resourceId: resource.id,
        state,
        weight,
        ownScore,
        effectiveScore,
        limitingDependency,
        points: (effectiveScore * weight) / totalWeight,
      });
      evaluated.set(resource.id, result);
      return result;
    }
    const contributions = Object.freeze(catalog.resources.map(evaluate));
    return Object.freeze({
      score:
        contributions.reduce((sum, c) => sum + c.effectiveScore * c.weight, 0) /
        totalWeight,
      contributions,
    });
  };
}
