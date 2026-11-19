import { useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { dashboard, utc } from "../simulation/dashboard";
import type { Resource } from "../simulation/model";
import type { SimulationSnapshot } from "../simulation/session";
import type { Sample } from "../simulation/telemetry";
import { OperationControls } from "./OperationControls";
import { Trend } from "./Trend";

const configLabels: Record<string, string> = {
  kind: "Type",
  category: "Category",
  vCPUs: "Virtual CPUs",
  memoryGiB: "Memory (GiB)",
  workers: "Workers",
  maxConnections: "Max connections",
  capacityTiB: "Storage (TiB)",
  ports: "Ports",
  throughputGbps: "Bandwidth (Gbps)",
};

export function ResourceDrawer({
  resource,
  snapshot,
  onClose,
}: {
  resource: Resource;
  snapshot: SimulationSnapshot;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    ref.current?.showModal();
  }, []);
  const { catalog, conditions, telemetry, journal } = snapshot;
  const data = telemetry.current.resources[resource.id];
  const category = resource.configuration.category;
  const gauges: [string, number][] = data
    ? [
        ["CPU", data.cpuPercent],
        ["Memory", data.memoryPercent],
        ["Network", data.throughputPercent],
      ]
    : [];
  if (data && category === "Storage")
    gauges.push(["Storage", data.capacityPercent]);
  if (data && category === "Databases")
    gauges.push(["Connections", data.connectionsPercent]);
  const alerts = conditions.alerts.filter((a) => a.resourceId === resource.id);
  const events = journal.logs
    .filter((e) => e.resourceId === resource.id)
    .slice(-6)
    .reverse();
  const read = useMemo(
    () => (sample: Sample) => sample.resources[resource.id]?.cpuPercent ?? 0,
    [resource.id],
  );
  const markers = useMemo(
    () =>
      dashboard(snapshot).markers.filter((m) => m.resourceId === resource.id),
    [snapshot, resource.id],
  );
  return (
    <dialog
      class="cc-drawer asset-drawer"
      aria-labelledby="resource-title"
      ref={ref}
      onClose={onClose}
    >
      <header class="cc-heading">
        <h2 id="resource-title">{resource.name}</h2>
        <button type="button" onClick={() => ref.current?.close()}>
          Close
        </button>
      </header>
      <p>{resource.purpose}</p>
      <p class="asset-id">
        {resource.id} · {resource.importance}
      </p>
      <p>
        {catalog.sites.find((s) => s.id === resource.siteId)?.city} ·{" "}
        {catalog.clouds.find((c) => c.id === resource.cloudId)?.name ??
          "On site"}{" "}
        ·{" "}
        <span data-health={conditions.resourceHealth[resource.id]}>
          {conditions.resourceHealth[resource.id]}
        </span>
      </p>
      <h3>Current readings</h3>
      <div class="asset-gauges">
        {gauges.map(([label, value]) => (
          <div key={label}>
            <label>
              {label} <b>{value.toFixed(1)}%</b>
              <meter min={0} max={100} value={value} />
            </label>
          </div>
        ))}
      </div>
      {data && (
        <p>
          {data.networkMbps.toFixed(1)} Mbps · {data.responseMs.toFixed(1)} ms
          response
        </p>
      )}
      <Trend
        title="Resource CPU history"
        unit="% CPU"
        read={read}
        telemetry={telemetry}
        markers={markers}
      />
      <h3>Configuration</h3>
      <dl class="facts">
        {Object.entries(resource.configuration).map(([key, value]) => (
          <div key={key}>
            <dt>{configLabels[key] ?? key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3>Dependencies</h3>
      {resource.dependsOn.length ? (
        <ul>
          {resource.dependsOn.map((id) => (
            <li key={id}>
              {catalog.resources.find((r) => r.id === id)?.name ?? id}
            </li>
          ))}
        </ul>
      ) : (
        <p>No upstream dependencies.</p>
      )}
      <h3>Active alerts</h3>
      {alerts.length ? (
        alerts.map((a) => (
          <p key={a.id}>
            {a.severity} · {a.message}
            {a.acknowledged ? " · Acknowledged" : ""}
          </p>
        ))
      ) : (
        <p>No active alerts.</p>
      )}
      <h3>Recent events</h3>
      {events.length ? (
        events.map((e, i) => (
          <p key={`${e.at}-${i}`}>
            {utc(e.at)} UTC · {e.message}
          </p>
        ))
      ) : (
        <p>No retained events.</p>
      )}
      <OperationControls resource={resource} snapshot={snapshot} />
    </dialog>
  );
}
