export const screens = {
  "command-center": {
    name: "Command Center",
    description: "Overview of the Axiom operations environment.",
  },
  infrastructure: {
    name: "Infrastructure",
    description: "Resources, services, and their dependencies.",
  },
  networking: {
    name: "Networking",
    description: "Network topology and regional connectivity.",
  },
  security: {
    name: "Security",
    description: "Security posture and activity across the environment.",
  },
  "event-console": {
    name: "Event Console",
    description: "Operational events and simulated diagnostics.",
  },
  settings: {
    name: "Settings",
    description: "Preferences for the local simulation workspace.",
  },
} as const;
export type Route = keyof typeof screens;
export const operations = (Object.keys(screens) as Route[]).filter(
  (route) => route !== "settings",
);
export function readRoute(hash: string): Route {
  const route = hash.replace(/^#\//, "");
  return Object.hasOwn(screens, route) ? (route as Route) : "command-center";
}
export const href = (route: Route) => `#/${route}`;
