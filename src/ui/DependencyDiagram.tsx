import { useState } from "preact/hooks";
import type { ResourceId } from "../simulation/model";
import type { SimulationSnapshot } from "../simulation/session";
import { ResourceDrawer } from "./ResourceDrawer";
import "./inventory.css";

export function DependencyDiagram({
  snapshot,
}: {
  snapshot: SimulationSnapshot;
}) {
  const [focus, setFocus] = useState<ResourceId>("res-fra-orders");
  const [selected, setSelected] = useState<ResourceId | null>(null);
  const { resources } = snapshot.catalog;
  const resource = resources.find((r) => r.id === focus);
  const detail = resources.find((r) => r.id === selected);
  if (!resource) return null;
  const health = snapshot.conditions.resourceHealth;
  const count = resource.dependsOn.length;
  return (
    <section class="dependency-view" aria-label="Resource dependency diagram">
      <label class="focus-picker">
        Focus resource{" "}
        <select
          value={focus}
          onChange={(e) => setFocus(e.currentTarget.value as ResourceId)}
        >
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div
        class="dependency-stage"
        style={{ height: Math.max(105, count * 47) }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {resource.dependsOn.map((id, i) => (
            <path
              key={id}
              data-health={health[focus]}
              d={`M 36 50 C 52 50, 48 ${((i + 0.5) / count) * 100}, 64 ${((i + 0.5) / count) * 100}`}
            />
          ))}
        </svg>
        <button
          type="button"
          class="dependency-root"
          data-health={health[focus]}
          onClick={() => setSelected(focus)}
        >
          {resource.name}
          <small>{health[focus]}</small>
        </button>
        <span class="dep-caption">Depends on</span>
        <div class="dependency-targets">
          {resource.dependsOn.map((id) => {
            const target = resources.find((r) => r.id === id);
            return target ? (
              <button
                type="button"
                key={id}
                data-health={health[target.id]}
                onClick={() => setSelected(target.id)}
              >
                {target.name}
                <small>{health[target.id]}</small>
              </button>
            ) : (
              <span key={id} class="circuit-target">
                {id}
                <small>Circuit</small>
              </span>
            );
          })}
          {!count && <span>No dependencies</span>}
        </div>
      </div>
      {detail && (
        <ResourceDrawer
          resource={detail}
          snapshot={snapshot}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
