import { useSyncExternalStore } from "preact/compat";
import { useState } from "preact/hooks";
import type { Metric, Resource, ResourceId } from "../simulation/model";
import type { Simulation } from "../simulation/session";
import { DependencyDiagram } from "../ui/DependencyDiagram";
import { ResourceDrawer } from "../ui/ResourceDrawer";
import { SessionDetails } from "../ui/SessionDetails";

const categories: Resource["configuration"]["category"][] = [
  "Compute",
  "Applications",
  "Databases",
  "Storage",
  "Network services",
];
const metricLabels: Record<Metric, string> = {
  cpuPercent: "CPU",
  responseMs: "Response",
  connectionsPercent: "Connections",
  capacityPercent: "Storage",
  throughputPercent: "Bandwidth",
};
export function Infrastructure({ simulation }: { simulation: Simulation }) {
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );
  const [tab, setTab] = useState("Resources"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<ResourceId | null>(null);
  const { catalog, conditions, telemetry } = snapshot;
  const detail = catalog.resources.find((r) => r.id === selected);
  const term = query.trim().toLowerCase();
  const matches = catalog.resources.filter((r) =>
    [r.id, r.name, r.purpose].some((s) => s.toLowerCase().includes(term)),
  );
  return (
    <div class="infra">
      <div class="infra-toolbar">
        <div class="switcher">
          {["Resources", "Architecture"].map((t) => (
            <button
              type="button"
              key={t}
              aria-pressed={t === tab}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "Resources" && (
          <label>
            Find a resource{" "}
            <input
              type="search"
              value={query}
              placeholder="Name, ID or purpose"
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
          </label>
        )}
      </div>
      {tab === "Architecture" ? (
        <section class="panel">
          <div class="cc-heading">
            <h2>Architecture</h2>
          </div>
          <DependencyDiagram snapshot={snapshot} />
        </section>
      ) : (
        <div class="inventory-groups">
          {categories.map((category) => {
            const group = catalog.resources.filter(
              (r) => r.configuration.category === category,
            );
            const rows = matches.filter(
              (r) => r.configuration.category === category,
            );
            if (!rows.length) return null;
            return (
              <section class="panel" key={category}>
                <div class="cc-heading">
                  <h2>{category}</h2>
                  <span>
                    {rows.length} of {group.length} ·{" "}
                    {
                      group.filter(
                        (r) => conditions.resourceHealth[r.id] === "Healthy",
                      ).length
                    }{" "}
                    healthy
                  </span>
                </div>
                {rows.map((r) => {
                  const reading = telemetry.current.resources[r.id],
                    metric = r.threshold.metric,
                    value = reading?.[metric];
                  const util =
                    metric === "responseMs" ? reading?.cpuPercent : value;
                  return (
                    <button
                      class="inventory-row"
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r.id)}
                    >
                      <span>
                        <strong>{r.name}</strong>
                        <small>{r.purpose}</small>
                      </span>
                      <span data-health={conditions.resourceHealth[r.id]}>
                        {conditions.resourceHealth[r.id]}
                      </span>
                      <span>
                        {metricLabels[metric]} {value?.toFixed(1)}
                        {metric === "responseMs" ? " ms" : "%"}
                      </span>
                      <span class="row-meter">
                        {metric === "responseMs" ? "CPU" : metricLabels[metric]}
                        <meter
                          aria-label={
                            metric === "responseMs"
                              ? "CPU utilization"
                              : metricLabels[metric]
                          }
                          min={0}
                          max={100}
                          value={util ?? 0}
                        />
                      </span>
                    </button>
                  );
                })}
              </section>
            );
          })}
          {!matches.length && (
            <p role="status">No resources match “{query}”.</p>
          )}
        </div>
      )}
      <SessionDetails simulation={simulation} />
      {detail && (
        <ResourceDrawer
          resource={detail}
          snapshot={snapshot}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
