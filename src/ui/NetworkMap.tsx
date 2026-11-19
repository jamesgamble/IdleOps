import { useRef, useState } from "preact/hooks";
import coast from "../assets/north-atlantic.svg";
import type { NetworkLink, Resource, Site } from "../simulation/model";
import type { RouteReading } from "../simulation/network";
import type { SimulationSnapshot } from "../simulation/session";
import { NetworkDrawer, siteHealth } from "./NetworkDrawer";
import { ResourceDrawer } from "./ResourceDrawer";
import "./network-map.css";

type Mode = "Topology" | "Geographic";
type Point = { x: number; y: number };
const initialCamera = { x: 0, y: 0, zoom: 1 };
function geographic(site: Site): Point {
  return { x: (site.longitude + 125) * 6.2, y: (70 - site.latitude) * 6.6 };
}
const columns = ["denver", "new-york", "tampa", "london", "frankfurt"];
function topology(r: Resource): Point {
  const levels: Record<string, number> = {
    router: 90,
    switch: 160,
    firewall: 230,
    gateway: 300,
  };
  return {
    x: 90 + columns.indexOf(r.siteId) * 180,
    y: levels[r.configuration.kind] ?? 300,
  };
}
function interaction(name: string, open: () => void) {
  return {
    role: "button" as const,
    tabindex: 0,
    "aria-label": name,
    onClick: open,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    },
  };
}
function Circuit({
  route,
  link,
  start,
  end,
  mode,
  open,
}: {
  route: RouteReading;
  link: NetworkLink;
  start: Point;
  end: Point;
  mode: Mode;
  open: () => void;
}) {
  const standby = !!link.backupFor,
    active = route.selected?.id === link.id;
  const status = active ? route.health : standby ? "Standby" : "Offline";
  const vertical = start.x === end.x,
    bend = standby ? 34 : -34;
  const cx = (start.x + end.x) / 2 + (vertical ? bend : 0),
    cy = vertical ? (start.y + end.y) / 2 : Math.min(start.y, end.y) + bend;
  const d = `M${start.x} ${start.y} Q${cx} ${cy} ${end.x} ${end.y}`;
  let color = "var(--cyan)";
  if (!active) color = standby ? "#587275" : "var(--red)";
  else if (route.health === "Degraded") color = "var(--amber)";
  return (
    <g
      class="net-link"
      {...interaction(`Inspect ${link.id}`, open)}
      style={{ color }}
    >
      <path
        d={d}
        id={`${link.id}-geometry`}
        class="net-wire"
        stroke-dasharray={!active ? "5 4" : undefined}
      >
        <title>
          {link.id} · {route.health} · {route.selected?.id ?? "No path"} ·{" "}
          {status} · {active ? route.forwardMbps.toFixed(0) : 0} Mbps forward /{" "}
          {active ? route.reverseMbps.toFixed(0) : 0} Mbps reverse
        </title>
      </path>
      <path d={d} class="net-hit" />
      {active && route.forwardMbps > 0 && (
        <>
          <circle class="traffic-dot" r={mode === "Topology" ? 2.8 : 2.5}>
            <animateMotion
              dur={standby ? "4s" : "2.6s"}
              repeatCount="indefinite"
            >
              <mpath href={`#${link.id}-geometry`} />
            </animateMotion>
          </circle>
          <circle class="traffic-dot reverse" r="1.8">
            <animateMotion
              dur="4.3s"
              keyPoints="1;0"
              keyTimes="0;1"
              calcMode="linear"
              repeatCount="indefinite"
            >
              <mpath href={`#${link.id}-geometry`} />
            </animateMotion>
          </circle>
        </>
      )}
    </g>
  );
}
export function NetworkMap({
  snapshot,
  mode,
}: {
  snapshot: SimulationSnapshot;
  mode: Mode;
}) {
  const [selected, select] = useState<string | null>(null),
    [camera, setCamera] = useState(initialCamera);
  const drag = useRef<{
    x: number;
    y: number;
    units: number;
    origin: Point;
  } | null>(null);
  const geo = mode === "Geographic",
    { catalog, telemetry } = snapshot;
  const routes = geo ? telemetry.routes.geographic : telemetry.routes.topology;
  const siteFor = (r: Resource) => catalog.sites.find((s) => s.id === r.siteId);
  const selectedSite = catalog.sites.find((s) => s.id === selected);
  const selectedDevice = catalog.resources.find((r) => r.id === selected);
  const selectedLink = catalog.links.find((l) => l.id === selected);
  const selectedRoute =
    selectedLink &&
    routes.find(
      (r) => r.primary.id === (selectedLink.backupFor ?? selectedLink.id),
    );
  const pan = (x: number, y: number) =>
    setCamera((c) => ({ ...c, x: c.x + x / c.zoom, y: c.y + y / c.zoom }));
  const zoom = (factor: number) =>
    setCamera((c) => ({
      ...c,
      zoom: Math.max(0.75, Math.min(3, c.zoom * factor)),
    }));
  const width = 900 / camera.zoom,
    height = 340 / camera.zoom;
  return (
    <div class="network-map">
      {!geo && (
        <div class="camera-controls">
          {(
            [
              ["Left", -60, 0],
              ["Right", 60, 0],
              ["Up", 0, -45],
              ["Down", 0, 45],
            ] as const
          ).map(([label, x, y], i) => (
            <button
              key={label}
              type="button"
              aria-label={`Pan ${label.toLowerCase()}`}
              onClick={() => pan(x, y)}
            >
              {["←", "→", "↑", "↓"][i]}
            </button>
          ))}
          <button type="button" aria-label="Zoom out" onClick={() => zoom(0.8)}>
            −
          </button>
          <span>{Math.round(camera.zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)}>
            +
          </button>
          <button type="button" onClick={() => setCamera(initialCamera)}>
            Reset view
          </button>
        </div>
      )}
      <svg
        class="net-scene"
        aria-label={
          geo ? "Geographic operations across five sites" : "Network topology"
        }
        viewBox={[
          (900 - width) / 2 + camera.x,
          (340 - height) / 2 + camera.y,
          width,
          height,
        ].join(" ")}
        onPointerDown={(e) => {
          if (
            geo ||
            e.button !== 0 ||
            (e.target as Element).closest('[role="button"]')
          )
            return;
          const scale = e.currentTarget.getScreenCTM()?.a;
          if (!scale) return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            origin: camera,
            units: 1 / scale,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const v = drag.current;
          if (v)
            setCamera((c) => ({
              ...c,
              x: v.origin.x + (v.x - e.clientX) * v.units,
              y: v.origin.y + (v.y - e.clientY) * v.units,
            }));
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        {geo ? (
          <image href={coast} width="900" height="340" />
        ) : (
          columns.map((id, i) => (
            <g key={id}>
              <rect
                class="net-zone"
                x={i * 180 + 10}
                y="12"
                width="160"
                height="318"
                rx="8"
              />
              <text class="zone-title" x={i * 180 + 90} y="36">
                {catalog.sites.find((s) => s.id === id)?.city}
              </text>
            </g>
          ))
        )}
        {catalog.links.map((link) => {
          const route = routes.find(
            (r) => r.primary.id === (link.backupFor ?? link.id),
          );
          const from = catalog.resources.find((r) => r.id === link.from),
            to = catalog.resources.find((r) => r.id === link.to);
          if (!route || !from || !to) return null;
          const a = siteFor(from),
            b = siteFor(to);
          if (!a || !b) return null;
          return (
            <Circuit
              key={link.id}
              route={route}
              link={link}
              mode={mode}
              start={geo ? geographic(a) : topology(from)}
              end={geo ? geographic(b) : topology(to)}
              open={() => select(link.id)}
            />
          );
        })}
        {geo
          ? catalog.sites.map((site) => {
              const p = geographic(site),
                above = site.id === "london" || site.id === "denver";
              const clouds = catalog.clouds.filter((c) =>
                catalog.resources.some(
                  (r) => r.cloudId === c.id && r.siteId === site.id,
                ),
              );
              return (
                <g
                  key={site.id}
                  class="map-node"
                  data-health={siteHealth(snapshot, site)}
                  transform={`translate(${p.x} ${p.y})`}
                  {...interaction(`Inspect ${site.city}`, () =>
                    select(site.id),
                  )}
                >
                  <circle class="node-halo" r="10" />
                  <circle class="node-core" r="4" />
                  <text y={above ? -29 : 22}>{site.city}</text>
                  <text class="cloud-label" y={above ? -15 : 36}>
                    {clouds.map((c) => c.name).join(" / ")}
                  </text>
                </g>
              );
            })
          : catalog.resources
              .filter((r) => r.configuration.category === "Network services")
              .map((r) => {
                const p = topology(r);
                return (
                  <g
                    key={r.id}
                    class="map-node"
                    data-health={snapshot.conditions.resourceHealth[r.id]}
                    transform={`translate(${p.x} ${p.y})`}
                    {...interaction(`Inspect ${r.name}`, () => select(r.id))}
                  >
                    <rect
                      class="device-body"
                      x="-50"
                      y="-19"
                      width="100"
                      height="38"
                      rx="6"
                    />
                    <circle class="node-core" cx="-39" cy="-4" r="3" />
                    <text y="-1">{r.name}</text>
                    <text class="cloud-label" y="12">
                      {r.configuration.kind}
                    </text>
                  </g>
                );
              })}
      </svg>
      <div class="net-key" aria-label="Connection states" role="note">
        <span>Healthy</span>
        <span>Degraded</span>
        <span>Offline</span>
        <span>Standby</span>
      </div>
      {selectedDevice && (
        <ResourceDrawer
          snapshot={snapshot}
          resource={selectedDevice}
          onClose={() => select(null)}
        />
      )}
      {selectedSite && (
        <NetworkDrawer
          snapshot={snapshot}
          selection={{ site: selectedSite }}
          onClose={() => select(null)}
        />
      )}
      {selectedLink && selectedRoute && (
        <NetworkDrawer
          snapshot={snapshot}
          selection={{ link: selectedLink, route: selectedRoute }}
          onClose={() => select(null)}
        />
      )}
    </div>
  );
}
