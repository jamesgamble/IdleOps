# IdleOps

IdleOps is a silent, fictional systems engineering dashboard for Axiom Industries. One local browser simulation drives infrastructure telemetry, network traffic, security activity and incident investigation.

The static shell includes Command Center, Infrastructure, Networking, Security, Event Console, and Settings. Each view shares one in-memory session. Navigation keeps its start time and uptime, and reloading starts a new session. The schematic and operational panels are labeled previews for later assignments.

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

## Project record

- [Approved design and acceptance criteria](docs/design-handoff-v1.md)
- [Product and architecture summary](docs/product.md)
- [Progressive MVP roadmap and Codex assignments](docs/roadmap.md)
- [Current release milestone](https://github.com/jamesgamble/IdleOps/milestone/2)
- [GitHub Project](https://github.com/users/jamesgamble/projects/1)
- [Contribution and review workflow](CONTRIBUTING.md)
