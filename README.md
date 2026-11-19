# IdleOps

IdleOps is a silent, fictional systems engineering dashboard for Axiom Industries. One local browser simulation drives infrastructure telemetry, network traffic, security activity and incident investigation.

The static shell includes Command Center, Infrastructure, Networking, Security, Event Console, and Settings. Each view shares one in-memory session. Navigation keeps its start time and uptime, and reloading starts a new session. The Command Center reads six indicators, a geographic and dependency overview, 24-hour charts, a severity-ordered queue and recent events from that session. Select an indicator to inspect its inputs, or select an alert to inspect its timeline and acknowledge it. The full interactive map renderers are tracked in #12.

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

The entry point creates one session and advances its clock. The framework-independent [simulation boundary](src/simulation/session.ts) exposes immutable snapshots and subscriptions. Screens receive the read-only interface and unsubscribe on unmount. Add future operational state to this boundary so every view reads the same environment.

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

The Infrastructure screen groups the monitored estate by resource category. Search by name, ID or purpose and select a row to inspect its configuration, live readings, CPU history and recent activity. Architecture and the Command Center dependency map share a resource selector and diagram. The detail drawer lists supported action profiles; staged operations are tracked in #14.
