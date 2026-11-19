import { useLayoutEffect, useRef } from "preact/hooks";
import { utc } from "../simulation/dashboard";
import type { Health, NetworkLink, Site } from "../simulation/model";
import type { RouteReading } from "../simulation/network";
import type { SimulationSnapshot } from "../simulation/session";
import { OperationControls } from "./OperationControls";

export function siteHealth(snapshot: SimulationSnapshot, site: Site): Health {
  const resources = snapshot.catalog.resources.filter(
    (r) => r.siteId === site.id,
  );
  return (
    (["Offline", "Critical", "Degraded", "Maintenance"] as const).find((h) =>
      resources.some((r) => snapshot.conditions.resourceHealth[r.id] === h),
    ) ?? "Healthy"
  );
}
function LinkDetails({
  link,
  route,
  snapshot,
}: {
  link: NetworkLink;
  route: RouteReading;
  snapshot: SimulationSnapshot;
}) {
  const endpoint = snapshot.catalog.resources.find((r) => r.id === link.from);
  const active = route.selected?.id === link.id;
  const state = snapshot.telemetry.current.pathHealth[link.id] ?? "Healthy";
  const name = (id: string) =>
    snapshot.catalog.resources.find((r) => r.id === id)?.name ?? id;
  return (
    <>
      <p>
        {name(link.from)} → {name(link.to)}
      </p>
      <dl class="facts">
        {Object.entries({
          "Physical state": state,
          "Route health": route.health,
          "Selected path": route.selected?.id ?? "No reachable path",
          Capacity: `${link.capacityMbps} Mbps`,
          "Forward traffic": `${(active ? route.forwardMbps : 0).toFixed(1)} Mbps`,
          "Reverse traffic": `${(active ? route.reverseMbps : 0).toFixed(1)} Mbps`,
          "Route latency":
            route.latencyMs === null
              ? "Unreachable"
              : `${route.latencyMs.toFixed(1)} ms`,
          "Route loss": `${route.lossPercent.toFixed(1)}%`,
        }).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {endpoint && (
        <OperationControls
          resource={endpoint}
          snapshot={snapshot}
          actions={["diagnose-link", "run-maintenance"]}
        />
      )}
      <h3>Recent circuit events</h3>
      <EventList
        snapshot={snapshot}
        matches={(e) => e.linkId === route.primary.id}
      />
    </>
  );
}
type Event = SimulationSnapshot["journal"]["logs"][number];
function EventList({
  snapshot,
  matches,
}: {
  snapshot: SimulationSnapshot;
  matches: (e: Event) => boolean;
}) {
  const events = snapshot.journal.logs.filter(matches).slice(-6).reverse();
  return events.length ? (
    <ul>
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          {utc(e.at)} UTC · {e.message}
        </li>
      ))}
    </ul>
  ) : (
    <p>No retained events.</p>
  );
}
function RegionDetails({
  site,
  snapshot,
}: {
  site: Site;
  snapshot: SimulationSnapshot;
}) {
  const resources = snapshot.catalog.resources.filter(
      (r) => r.siteId === site.id,
    ),
    ids = new Set(resources.map((r) => r.id));
  const routes = snapshot.telemetry.routes.geographic.filter(
    (r) => ids.has(r.primary.from) || ids.has(r.primary.to),
  );
  const upstream = [...new Set(resources.flatMap((r) => r.dependsOn))];
  const router = resources.find((r) => r.configuration.kind === "router");
  return (
    <>
      <p>
        {site.region}, {site.country} · {site.role}
      </p>
      <p>
        {new Intl.DateTimeFormat("en-US", {
          timeZone: site.timeZone,
          timeStyle: "medium",
        }).format(snapshot.startedAt + snapshot.elapsedSeconds * 1000)}{" "}
        local · {site.timeZone}
      </p>
      <p data-health={siteHealth(snapshot, site)}>
        {siteHealth(snapshot, site)}
      </p>
      <h3>Regional connectivity</h3>
      <ul>
        {routes.map((r) => (
          <li key={r.primary.id}>
            {r.primary.id} · {r.health} · {r.selected?.id ?? "No path"} ·{" "}
            {(r.forwardMbps + r.reverseMbps).toFixed(0)} Mbps ·{" "}
            {r.latencyMs === null
              ? "Unreachable"
              : `${r.latencyMs.toFixed(1)} ms`}{" "}
            · {r.lossPercent.toFixed(1)}% loss
          </li>
        ))}
      </ul>
      <h3>Resources</h3>
      <ul>
        {resources.map((r) => (
          <li key={r.id}>
            {r.name} · {snapshot.conditions.resourceHealth[r.id]}
          </li>
        ))}
      </ul>
      <h3>Dependencies</h3>
      <ul>
        {upstream.map((id) => (
          <li key={id}>
            {snapshot.catalog.resources.find((r) => r.id === id)?.name ?? id}
          </li>
        ))}
      </ul>
      <h3>Recent regional events</h3>
      <EventList
        snapshot={snapshot}
        matches={(e) =>
          ids.has(e.resourceId) || routes.some((r) => r.primary.id === e.linkId)
        }
      />
      {router && (
        <OperationControls
          snapshot={snapshot}
          resource={router}
          actions={["check-health", "diagnose-link"]}
        />
      )}
    </>
  );
}
export function NetworkDrawer({
  selection,
  snapshot,
  onClose,
}: {
  selection: { site: Site } | { link: NetworkLink; route: RouteReading };
  snapshot: SimulationSnapshot;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    dialog.current?.showModal();
  }, []);
  function close() {
    // Restore focus and clear the selection before another activation can arrive.
    dialog.current?.close();
    onClose();
  }
  return (
    <dialog
      class="cc-drawer asset-drawer"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="network-detail-title"
    >
      <header class="cc-heading">
        <h2 id="network-detail-title">
          {"site" in selection ? selection.site.city : selection.link.id}
        </h2>
        <button type="button" onClick={close}>
          Close
        </button>
      </header>
      {"site" in selection ? (
        <RegionDetails site={selection.site} snapshot={snapshot} />
      ) : (
        <LinkDetails {...selection} snapshot={snapshot} />
      )}
    </dialog>
  );
}
