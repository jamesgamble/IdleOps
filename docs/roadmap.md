# Progressive MVP development plan

**Planning complete; implementation awaits the Product Owner’s go-ahead.** The [approved handoff](design-handoff-v1.md) is the scope baseline. The eight stages are integration checkpoints within one MVP milestone. Priorities sequence work: P0 marks a dependency or release gate; P1 is also required for release. Do not dispatch an issue until its prerequisites are merged. Keep one implementation PR active initially and use measured throughput from the first three assignments before forecasting a date.

## Architecture recommendation

Use TypeScript with strict checks, Vite for a static production build, Preact for component rendering, and ordinary CSS with shared design tokens. Use local SVG geometry for maps, diagrams and charts. Render a bounded number of points and particles; profile before adding Canvas or a visualization dependency. Bundle assets with relative paths and use hash routes so hosting requires no rewrite rules. Dev-only tools: Vitest with an injectable clock and deterministic seeds, Playwright for end-to-end checks, and lightweight lint/format checks. Pin dependencies in a lockfile. No hosted tiles, fonts, CDNs, API calls, runtime analytics, backend or database.

Keep catalog, clock, incident engine, action dispatcher and derived selectors in framework-independent TypeScript. Views consume snapshots; terminal and panels call the same dispatcher. Stable entity IDs join events, resources, links and timelines. Use controlled simulation ticks, visible-only animation and bounded 24-hour series. Keep incident histories independent of log retention. Store only validated, versioned user preferences. Suggested directories when implementation starts: `src/simulation/`, `src/ui/`, `src/screens/`, `src/assets/`, and `tests/`. Avoid a router, state library or graph engine until a demonstrated requirement warrants one.

## Handoff reconciliation and proposed interpretations

- §§5–12 specify basic interactions also named as candidates for later refinement in §13. Include the working baseline for every named interaction now: chart inspection/crosshair/markers/expand; terminal suggestions; global search across all five entity classes; guided investigation; basic panel preference; backup failover; staged maintenance and subtle humor. Later releases can add depth in those areas. No approved functionality is removed. Owner confirmation requested on this boundary.
- Five operational screens rotate; Settings is a separate destination. About can live inside Settings. Restore the prior screen on presentation exit, including Settings if it was the starting screen. Boot is skippable every session; it always finishes with usable initialized state.
- §5.5 specifies upper and lower sections. Use a draggable horizontal divider with vertically stacked panes. Pausing the log view freezes follow behavior, while the engine continues appending to the bounded buffer.
- §6 requires 24-hour historical telemetry while §11 resets operations each session. Generate a consistent fictional past for each new session. Reload/restart regenerates the world; historical charts do not depend on durable operational storage. Summarize hidden time in bounded work and preserve any still-relevant incident transitions.
- Weighting, sampling granularity, exact cloud regions, thresholds and critical-incident cap are unspecified. Begin with documented synthetic fixtures: propose a minute-resolution chart history, importance-weighted health adjusted for effective redundancy, a single simultaneous critical incident by default, and short-lived minor warnings. Tune against the handoff; verify outcomes in seeded scenarios. Provide at least one toggleable supporting panel, while always keeping simulation identity visible.
- Browser performance lacks a numerical gate. Proposed reference: record hardware and browser, test 1920×1080, 2560×1440 and 3440×1440, target p95 input-to-visible response under 200 ms on the documented reference desktop, and check for growing timer counts, retained log entries or chart buffers during a 60-minute soak. Profile misses and agree an exception before release. Real historical incident summaries may grow with the session as required; keep records compact.
- The foundation docs formerly left scope and visual design open. The handoff now settles those. The repository license remains a separate owner decision in #4. Static build validation is independent of Hostinger access; verify provider-specific transfer, path and rollback before deployment. There is no committed release date or hosting expenditure.

## Delivery sequence and traceability

Each issue is a Codex assignment with an objective, constraints, acceptance checks, dependencies, test evidence and deliverables. The final release gate verifies the complete AC set independently of feature tests.

| Stage | Assignment | Priority | Depends on | AC coverage |
|---|---|---|---|---|
| 1 · Foundation | [#5 Create the static app shell and simulation boundary](https://github.com/jamesgamble/IdleOps/issues/5) | P0 | Kickoff | 01,02,18,20 |
| 2 · Simulation | [#6 Model Axiom’s locations, resources and dependencies](https://github.com/jamesgamble/IdleOps/issues/6) | P0 | #5 | 03,05,07 |
| 2 · Simulation | [#7 Generate rolling telemetry and weighted enterprise health](https://github.com/jamesgamble/IdleOps/issues/7) | P0 | #6 | 03,04,06,19 |
| 2 · Simulation | [#8 Generate incidents, grouped alerts and session event history](https://github.com/jamesgamble/IdleOps/issues/8) | P0 | #6, #7 | 04,10,11,13 |
| 3 · Command Center | [#9 Build the Command Center, scorecard and shared charts](https://github.com/jamesgamble/IdleOps/issues/9) | P1 | #5, #7, #8 | 03,04,06,10,20 |
| 4 · Infrastructure and network | [#10 Build searchable infrastructure inventory and reusable resource details](https://github.com/jamesgamble/IdleOps/issues/10) | P1 | #5, #6, #7, #8 | 02,03,05,06 |
| 4 · Infrastructure and network | [#11 Simulate link failure, backup routing and recovery](https://github.com/jamesgamble/IdleOps/issues/11) | P0 | #7, #8 | 03,04,07,08 |
| 4 · Infrastructure and network | [#12 Render geographic operations and interactive network topology](https://github.com/jamesgamble/IdleOps/issues/12) | P1 | #9, #10, #11 | 03,07,08,17 |
| 5 · Security and console | [#13 Create the Security screen and live Event Console log pane](https://github.com/jamesgamble/IdleOps/issues/13) | P1 | #5, #8 | 03,11,13,18 |
| 6 · Operations | [#14 Implement staged operations and guided incident investigation](https://github.com/jamesgamble/IdleOps/issues/14) | P0 | #8, #10, #11 | 03,08,10,11,12,18 |
| 5–6 · Console operations | [#15 Add diagnostic terminal, tabs and resizable console](https://github.com/jamesgamble/IdleOps/issues/15) | P1 | #13, #14 | 09,12,13,18 |
| 6 · Operations | [#16 Connect global search and contextual navigation](https://github.com/jamesgamble/IdleOps/issues/16) | P1 | #9, #10, #12, #13, #14 | 02,03,10,13 |
| 7 · Experience | [#17 Deliver cinematic startup, settings and session reset](https://github.com/jamesgamble/IdleOps/issues/17) | P1 | #5, #7, #9, #12 | 15,16,17,20 |
| 7 · Experience | [#18 Deliver idle presentation, incident spotlight and desktop polish](https://github.com/jamesgamble/IdleOps/issues/18) | P1 | #12, #13, #15, #16, #17 | 02,14,17,19,20 |
| 8 · Release readiness | [#19 Verify the integrated MVP and prepare the release decision](https://github.com/jamesgamble/IdleOps/issues/19) | P0 | #9, #10, #11, #12, #13, #14, #15, #16, #17, #18 | 01–20 |

## First Codex assignments

1. **#5, static shell.** Start from protected main when authorized. Deliver only the static skeleton, shared state boundary, identity and shell smoke tests. Work verifies a production build served at a nested path, persistent state across navigation, and absence of third-party requests.
2. **#6, fictional environment.** After #5 merges, implement the catalog, five sites, two clouds, stable IDs and resource/dependency fixtures. Work checks scale, geography and referential integrity against §2.
3. **#7, live telemetry and history.** After #6 merges, implement the fake-clock-tested model and documented weighted score. Work compares an active primary link and a redundant path under failure, and verifies startup history and hidden-tab reconciliation.

Then complete #8 before shipping the first dashboard slice. Networking behavior #11 can proceed once #7–8 are merged; terminal #15 follows its shared action dispatcher #14. The final integration review #19 depends on the completed feature set. Use the dependency column when stage numbers overlap.

## Development and verification workflow

Work moves a dependency-clear issue from Backlog to Ready at kickoff. Codex branches from current main (e.g. `feat/5-static-shell`) and opens one focused PR with `Closes #5` or the appropriate issue. Include exact verification commands/results, failures and limitations; for UI work attach normal/incident screenshots with viewport and browser. Do not merge unfinished slices as release-ready features. Work reviews the diff and acceptance evidence, requests fixes, verifies behavior in Testing, then merges only after protected checks pass. Maintain existing Foundation checks; add type, lint/format, build, unit and browser checks with #5, and require new checks only after they run successfully. Exercise seeded adverse cases and use clock advancement for long intervals; retain a real elapsed-time soak for #19. No app or deployment task has been dispatched by this plan.

## Subsequent releases

Once baseline QA is complete, review feedback before opening more tickets. Preserve the ten §13 enhancement areas: more sophisticated dependencies, extra commands and autocomplete refinements, deeper investigation, advanced animation, deeper chart interactions, broader panel customization, additional maintenance scenarios, more detailed redundancy/failover, expanded global search, and additional Easter eggs and visual refinements. Sequence by observed benefit and performance cost. No dates or scope cuts are implied.
