import { useState } from "preact/hooks";
import type { SimulationSnapshot } from "../simulation/session";

export function OperationsMap({ snapshot }: { snapshot: SimulationSnapshot }) {
  const [geo, setGeo] = useState(true);
  const { catalog, conditions } = snapshot;
  const xy = (lon: number, lat: number) =>
    [30 + (lon + 114) * 5.2, 25 + (58 - lat) * 5.1] as const;
  const sites = catalog.sites.map((s) => ({
    ...s,
    point: xy(s.longitude, s.latitude),
  }));
  const links = catalog.links.flatMap((link) => {
    const a = catalog.resources.find((r) => r.id === link.from),
      b = catalog.resources.find((r) => r.id === link.to);
    if (!a || !b || a.siteId === b.siteId || link.backupFor) return [];
    const from = sites.find((s) => s.id === a.siteId);
    const to = sites.find((s) => s.id === b.siteId);
    return from && to ? [{ id: link.id, from, to }] : [];
  });
  const app = catalog.resources.find((r) => r.id === "res-fra-orders");
  if (!app) return null;
  const deps = app.dependsOn.map((id) => ({
    id,
    label: catalog.resources.find((r) => r.id === id)?.name ?? id,
  }));
  return (
    <section class="panel ops-map">
      <div class="cc-heading">
        <h2>Operational map</h2>
        <div class="switcher">
          {["Geographic", "Dependencies"].map((name, i) => (
            <button
              type="button"
              key={name}
              aria-pressed={geo === (i === 0)}
              onClick={() => setGeo(i === 0)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      {geo ? (
        <svg
          viewBox="0 0 740 225"
          role="img"
          aria-label="Geographic operations across five sites"
        >
          <title>Regional connections</title>
          <path
            d="M0 12 L220 11 245 31 232 51 271 55 253 68 244 89 220 101 212 119 192 134 190 154 180 166 170 158 164 143 145 141 128 151 83 151 66 131 5 125 Z M365 0 L447 0 424 39 400 52 387 39 Z M588 1 L689 0 739 30 739 158 703 157 679 132 664 116 643 125 620 123 614 104 630 91 613 79 625 62 650 57 649 39 630 26 Z"
            fill="#172c2c"
            stroke="#284746"
            stroke-width="1"
          />
          {links.map((l) => (
            <path
              key={l.id}
              d={`M${l.from.point.join(" ")} Q ${(l.from.point[0] + l.to.point[0]) / 2} ${Math.min(l.from.point[1], l.to.point[1]) - 34} ${l.to.point.join(" ")}`}
              fill="none"
              stroke="#40887f"
              stroke-width="1.6"
            />
          ))}
          {sites.map((s) => {
            const [x, y] = s.point;
            const flagged = catalog.resources.some(
              (r) =>
                r.siteId === s.id &&
                conditions.resourceHealth[r.id] !== "Healthy",
            );
            return (
              <g key={s.id}>
                <circle
                  cx={x}
                  cy={y}
                  r="11"
                  fill={flagged ? "#70573b" : "#285e55"}
                  opacity=".55"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill={flagged ? "var(--amber)" : "var(--cyan)"}
                />
                <text
                  x={x}
                  y={y + (s.id === "london" ? -14 : 21)}
                  text-anchor="middle"
                >
                  {s.city}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div class="dependency-map">
          <strong>{app.name}</strong>
          <span>Depends on</span>
          <ul>
            {deps.map((d) => (
              <li key={d.id}>{d.label}</li>
            ))}
          </ul>
        </div>
      )}
      <div class="cc-caption">
        {geo
          ? "Regional paths · five Axiom sites"
          : "Frankfurt order processing · direct prerequisites"}
      </div>
    </section>
  );
}
