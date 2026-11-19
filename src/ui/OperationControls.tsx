import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";
import type { Resource } from "../simulation/model";
import {
  type Action,
  labels,
  stages,
  unavailable,
} from "../simulation/operations";
import type { Simulation, SimulationSnapshot } from "../simulation/session";

export const SimulationContext = createContext<Simulation | null>(null);
export function OperationControls({
  resource,
  snapshot,
  incidentId,
  actions,
}: {
  resource: Resource;
  snapshot: SimulationSnapshot;
  incidentId?: string;
  actions?: readonly Action[];
}) {
  const simulation = useContext(SimulationContext);
  const [feedback, setFeedback] = useState("");
  const operation = snapshot.operations[resource.id];
  return (
    <section
      class="operation-controls"
      aria-label={`Operations for ${resource.name}`}
    >
      <h3>Simulated actions · {resource.name}</h3>
      {(actions ?? (Object.keys(labels) as Action[])).map((action) => {
        const reason = unavailable(resource, action, operation);
        return (
          <div class="operation-row" key={action}>
            <button
              type="button"
              disabled={!!reason}
              onClick={() =>
                setFeedback(
                  simulation?.dispatch(action, resource.id, incidentId) ??
                    "Session unavailable.",
                )
              }
            >
              {labels[action]}
            </button>
            {reason && <small>{reason}</small>}
          </div>
        );
      })}
      <p role="status">
        {feedback ||
          (operation &&
            labels[operation.action] +
              " · " +
              stages[operation.action][operation.stage] +
              (operation.result ? ` · ${operation.result}` : ""))}
      </p>
    </section>
  );
}
