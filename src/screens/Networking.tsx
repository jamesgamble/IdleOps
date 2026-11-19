import { useSyncExternalStore } from "preact/compat";
import { useState } from "preact/hooks";
import type { Simulation } from "../simulation/session";
import { NetworkMap } from "../ui/NetworkMap";
import { SessionDetails } from "../ui/SessionDetails";

export function Networking({ simulation }: { simulation: Simulation }) {
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );
  const [mode, setMode] = useState<"Topology" | "Geographic">("Topology");
  return (
    <div class="network-workspace">
      <section class="panel">
        <div class="cc-heading">
          <h2>Network {mode.toLowerCase()}</h2>
          <div class="switcher">
            {(["Topology", "Geographic"] as const).map((m) => (
              <button
                type="button"
                key={m}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <NetworkMap key={mode} snapshot={snapshot} mode={mode} />
      </section>
      <SessionDetails simulation={simulation} />
    </div>
  );
}
