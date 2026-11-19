import { useState } from "preact/hooks";
import type { SimulationSnapshot } from "../simulation/session";
import { DependencyDiagram } from "./DependencyDiagram";
import { NetworkMap } from "./NetworkMap";

export function OperationsMap({ snapshot }: { snapshot: SimulationSnapshot }) {
  const [geo, setGeo] = useState(true);
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
        <NetworkMap mode="Geographic" snapshot={snapshot} />
      ) : (
        <DependencyDiagram snapshot={snapshot} />
      )}
      <div class="cc-caption">
        {geo
          ? "Regional paths · five Axiom sites"
          : "Resource dependencies · direct prerequisites"}
      </div>
    </section>
  );
}
