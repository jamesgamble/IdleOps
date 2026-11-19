import schematic from "../assets/schematic.svg";
import type { Simulation } from "../simulation/session";
import { Icon } from "../ui/Icon";
import { href, operations, type Route, screens } from "../ui/routes";
import { SessionDetails } from "../ui/SessionDetails";

const placeholders = {
  infrastructure: [
    "Resource inventory",
    "The fictional resource catalog and dependency views will appear here.",
  ],
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

function Summary() {
  return (
    <section class="metrics" aria-label="Planned simulation indicators">
      {(
        [
          ["pulse", "Infrastructure health", "Awaiting telemetry", "cyan"],
          ["alert", "Active incidents", "Awaiting incident model", "amber"],
          ["event-console", "Event activity", "Awaiting event stream", "green"],
        ] as const
      ).map(([icon, label, note, color]) => (
        <div class={`metric ${color}`} key={label}>
          <div class="metric-title">
            <span>{label}</span>
            <Icon name={icon} />
          </div>
          <div class="metric-state">
            <strong aria-hidden="true">—</strong>
            <span>{note}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function Schematic() {
  return (
    <section class="panel display" aria-labelledby="schematic-title">
      <div class="panel-heading">
        <Icon name="layers" />
        <h2 id="schematic-title">Environment schematic</h2>
        <span class="tag">Static preview</span>
      </div>
      <div class="figure">
        <img
          src={schematic}
          alt="Isometric line drawing of a fictional modular compute chassis"
        />
      </div>
      <div class="figure-caption">
        <span class="legend-key" />
        Infrastructure visualization placeholder
      </div>
    </section>
  );
}

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
      {route === "command-center" && <Summary />}
      <div class="workspace-grid">
        {route === "command-center" ? (
          <Schematic />
        ) : (
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
        )}
        <div class="side-panels">
          <SessionDetails simulation={simulation} />
          {route === "command-center" && (
            <section class="panel directory" aria-labelledby="directory-title">
              <div class="panel-heading">
                <h2 id="directory-title">Explore workspace</h2>
              </div>
              {operations
                .filter((item) => item !== "command-center")
                .map((item) => (
                  <a key={item} href={href(item)}>
                    <Icon name={item} />
                    {screens[item].name}
                    <Icon name="arrow" size={15} />
                  </a>
                ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
