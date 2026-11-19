import type { Simulation } from "../simulation/session";
import { Icon } from "../ui/Icon";
import { SimulationContext } from "../ui/OperationControls";
import { type Route, screens } from "../ui/routes";
import { SessionDetails } from "../ui/SessionDetails";
import { CommandCenter } from "./CommandCenter";
import { EventConsole } from "./EventConsole";
import { Infrastructure } from "./Infrastructure";
import { Networking } from "./Networking";
import { Security } from "./Security";

const placeholders = {
  settings: [
    "Workspace preferences",
    "Appearance, presentation, and simulation preferences will appear here.",
  ],
} as const;

export function Workspace({
  route,
  simulation,
}: {
  route: Route;
  simulation: Simulation;
}) {
  const screen = screens[route];
  return (
    <SimulationContext.Provider value={simulation}>
      <div class="breadcrumb">
        Workspace <span>/</span>{" "}
        {route === "settings" ? "System" : "Operations"}
      </div>
      <header class="page-title">
        <h1>{screen.name}</h1>
        <p>{screen.description}</p>
      </header>
      {route === "command-center" ? (
        <CommandCenter simulation={simulation} />
      ) : route === "infrastructure" ? (
        <Infrastructure simulation={simulation} />
      ) : route === "networking" ? (
        <Networking simulation={simulation} />
      ) : route === "security" ? (
        <Security simulation={simulation} />
      ) : route === "event-console" ? (
        <EventConsole simulation={simulation} />
      ) : (
        <div class="workspace-grid">
          <section class="panel placeholder">
            <div class="panel-heading">
              <Icon name={route} />
              <h2>{placeholders[route][0]}</h2>
              <span class="tag">Placeholder</span>
            </div>
            <div class="empty">
              <div class="empty-icon">
                <Icon name={route} size={32} />
              </div>
              <p>{placeholders[route][1]}</p>
            </div>
          </section>
          <SessionDetails simulation={simulation} />
        </div>
      )}
    </SimulationContext.Provider>
  );
}
