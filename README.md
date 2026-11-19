# IdleOps

IdleOps is a silent, fictional systems engineering dashboard for Axiom Industries. One local browser simulation drives infrastructure telemetry, network traffic, security activity and incident investigation.

The static shell includes Command Center, Infrastructure, Networking, Security, Event Console, and Settings. Each view shares one in-memory session. Navigation keeps its start time and uptime, and reloading starts a new session. The Command Center reads six indicators, a geographic and dependency overview, 24-hour charts, a severity-ordered queue and recent events from that session. Select an indicator to inspect its inputs, or select an alert to inspect its timeline and acknowledge it. Networking and Command Center share the geographic map, and Networking also provides a device topology.

## Run locally

Use Node.js 24 LTS and npm. From the repository root, run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To inspect the production build, run `npm run build` followed by `npm run preview`. The `dist/` directory contains the complete static app. Assets use relative paths and screens use hash URLs such as `#/event-console`.

## Verify the shell

With Python 3 available for the loopback-only static test server, run:

```sh
npx playwright install chromium
npm run check
```

On Linux runners, use `npx playwright install --with-deps chromium`. The check runs Biome, strict TypeScript, Vitest, the production build, and Playwright. Browser tests serve the build at `/review/idleops/`, exercise all six routes at three desktop sizes, and save screenshots under `test-results/`. CI attaches the screenshots to the Shell checks run.

## Extend the simulation

The entry point creates one session and advances its clock. The framework-independent [simulation boundary](src/simulation/session.ts) exposes immutable snapshots and subscriptions. Screens receive the session interface and unsubscribe on unmount. Add future operational state to this boundary so every view reads the same environment.

Each snapshot exposes four parts of the fictional environment:

- `catalog` defines the five sites, Nebula Cloud, Stratos Cloud, 36 named resources, and 17 network links. The enterprise totals of 48 physical servers and 216 virtual machines describe the whole estate. The detailed inventory samples that estate and also includes applications, services, and network devices.
- `conditions` holds session-owned health by resource ID and informational alerts referencing those same IDs. The default `backup-window` seed starts with minor delays in archive verification and reporting. Pass `"replica-refresh"` as the second argument to `createSession(startedAt, seed)` for a reproducible recovery-workload scenario.
- `journal` retains incident timelines, acknowledgments and the most recent 500 events.
- `telemetry` holds current resource readings and path conditions, the enterprise health score and its per-resource contributions, a rolling 24-hour sample history, and seeded historical markers. [Sampling and scoring assumptions](docs/telemetry.md) describe the units, fixture timeline, and retention bounds.

In the [catalog](src/simulation/catalog.ts), a resource’s `siteId` identifies its geographic region. Its `cloudId` identifies the hosting platform, with `null` for on-site equipment. Resource dependencies point from consumer to prerequisite. For example, Frankfurt order processing depends on its regional database, the Tampa directory service, and the primary circuit between those sites. Network links join two device IDs bidirectionally. A standby circuit’s `backupFor` points to the primary link serving the same endpoints.

The [resource profiles](src/simulation/profiles.ts) define static configuration, metric thresholds with units, and simulated action names for future consumers. Clock ticks retain the existing catalog and conditions. Run `npm test` for fixture integrity and session tests, or `npm run check` for the full suite.

## Project record

- [Approved design and acceptance criteria](docs/design-handoff-v1.md)
- [Product and architecture summary](docs/product.md)
- [Progressive MVP roadmap and Codex assignments](docs/roadmap.md)
- [Current release milestone](https://github.com/jamesgamble/IdleOps/milestone/2)
- [GitHub Project](https://github.com/users/jamesgamble/projects/1)
- [Contribution and review workflow](CONTRIBUTING.md)

The Infrastructure screen groups the monitored estate by resource category. Search by name, ID or purpose and select a row to inspect its configuration, live readings, CPU history and recent activity. Architecture and the Command Center dependency map share a resource selector and diagram. Resource and network drawers dispatch local operations through the shared session. Each resource supports one operation at a time. Commands advance through five-second stages on the simulation clock. Restarting a service briefly takes it offline. Updates and maintenance temporarily reduce availability. Diagnostics record the observed readings.

Open a Command Center incident to inspect its timeline, affected resource, metrics and recent logs. Acknowledgment records operator awareness. Restarting the affected application can clear its queue early. Running maintenance on the primary circuit endpoint can restore a failed route early. Completed investigations remain under Resolved incidents for this session.

## Network maps

Networking opens on a device topology grouped by site. Drag the background or use the pan buttons, zoom controls and Reset view. Select a device to inspect its resource drawer. Select either physical circuit to see its own traffic and the effective route. Dashed lines identify standby or offline links. Moving particles follow the two traffic directions and disappear when the link carries no traffic or reduced motion is enabled. The geographic map in Networking and Command Center shares these readings. Select a city to inspect its local time, cloud-hosted and on-site resources, connectivity, dependencies, diagnostics and recent events.

The bundled North Atlantic land silhouette uses [Natural Earth 1:110m land polygons](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson). The bundled SVG path data uses an equirectangular projection. Both geographic views draw that path with the site and circuit overlays in the same SVG. Natural Earth publishes its map data in the [public domain](https://www.naturalearthdata.com/about/terms-of-use/). All site, cloud, device and circuit overlays come from the fictional local catalog.

## Security and Event Console

Security shows local sign-in outcomes and perimeter decisions from the shared session journal. Delayed application queues can cause sign-in failures. Active warnings and the Command Center security indicator refer to the same open incident. Counts cover the retained journal, including recovered incidents until their events expire.

The Event Console follows new records in time order. Combine message or entity search with severity, resource and location filters. Select a row for its timestamp, resource, location and associated incident or circuit. Pause or scroll back to read while the simulation continues. The journal retains the latest 500 entries. If a paused entry expires, the console identifies the gap and offers Jump to live. Resume also follows the latest matching record.
