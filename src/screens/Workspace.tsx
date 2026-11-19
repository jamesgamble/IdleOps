import type { Simulation } from "../simulation/session";
import { Icon } from "../ui/Icon";
import { type Route, screens } from "../ui/routes";
import { SessionDetails } from "../ui/SessionDetails";
import { CommandCenter } from "./CommandCenter";

import { Infrastructure } from "./Infrastructure";

const placeholders = {
  networking: [
    "Network topology",
    "Regional connections and simulated network paths will appear here.",
  ],
  security: [
    "Security activity",
    "Simulated security events and alerts will appear here.",
  ],
  "event-console": [
    "Event stream",
    "The local event log and diagnostic terminal will appear here.",
  ],
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
    <>
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
    </>
  );
}
