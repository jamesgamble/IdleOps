# Simulation telemetry and enterprise health

Read `simulation.getSnapshot().telemetry` from the session shared by all routes. `current.resources[id]` gives one named resource’s readings. `current.enterpriseScore` and `health.contributions` describe that same instant. Each historical sample contains the timestamp, all resource readings, sparse link conditions, and enterprise score.

## Clock and retention

The session accepts epoch milliseconds from its caller. The browser starts the session on first visibility and checks the clock once per second while visible. Live readings change every five seconds. Minute samples fall on a grid anchored to the session start, so even a start at 09:00:13.375 has exactly 24 hours of history immediately.

History includes both ends of the interval from the most recent minute boundary minus 24 hours through that boundary. The 1,441 samples hold 51,876 resource readings for the current 36-resource catalog. Between minute boundaries the live reading can lead history by up to 55 seconds. Historical samples and overlapping windows share immutable objects. Each minute evicts the oldest sample. The engine retains only the current window, live sample, and current contribution list.

The browser cancels its timer while hidden. On return it takes one clock reading and publishes once. Sampling is a deterministic function of time, scenario seed, resource identity, and fixture conditions. Reconciliation computes only missing minutes inside the retained window, up to 1,441 historical instants plus one live instant for a non-aligned return.

## Readings and historical markers

A shared daily traffic cycle and slower and faster variations per resource drive request load. Throughput determines CPU demand and connection occupancy. Memory follows the slower working set and current traffic. Storage fill varies on a much longer cycle. Above 68% CPU the queue delay rises quadratically. The two resources marked Degraded by each startup fixture carry additional workload.

| Reading | Unit and interpretation |
| --- | --- |
| `cpuPercent`, `memoryPercent` | Percent of modeled processing and memory capacity in use |
| `capacityPercent` | Percent of modeled storage in use |
| `networkMbps`, `throughputPercent` | Resource-side traffic in megabits per second and as a percent of modeled bandwidth |
| `connectionsPercent` | Percent of modeled connection slots in use |
| `responseMs` | Response time in milliseconds, including queuing and fixture delays |

Network devices use their catalog throughput in Gbps. Compute resources use 100 Mbps per vCPU and application resources use 50 Mbps per worker. Storage and database profiles use 2,000 and 1,000 Mbps respectively. These are fictional monitoring assumptions.

Each seed includes one resolved historical circuit interruption. The default seed affects Frankfurt order processing on the Tampa–Frankfurt primary circuit three hours before startup. The alternate seed affects the New York service desk on the New York–Tampa circuit six hours before startup. For 15 minutes the primary is Offline and work queues at the affected resource. Restoration starts a 20-minute drain of the excess demand and latency. The onset, recovery, and resolution markers carry the same episode, resource and link IDs that drive the sample calculation. Markers expire as their timestamps leave the chart. An absent entry in a sample’s `pathHealth` means Healthy.

## Score calculation

1. Assign each resource a weight of 4 for core, 2 for standard, or 1 for supporting. Operational state sets its score ceiling to 100 for Healthy, 75 for Degraded, 30 for Critical, 50 for Maintenance, or 0 for Offline.
2. Compare the resource’s measured profile metric with its catalog thresholds. The metric ceiling is 100 through the degraded threshold, falls linearly to 30 at the critical threshold, and stays at 30 above it. The lower of the state and metric ceilings gives the resource’s own score.
3. Limit each resource by its weakest prerequisite, recursively. Directly wired device dependencies also use the joining circuit. For a logical circuit, take the better of the primary rating and the best usable standby rating, then limit the result by the health of both endpoint devices. A standby receives a fraction of its condition rating equal to `0.75 + 0.20 × min(1, standby capacity / primary capacity)`. These weights model the service value of reduced-capacity connectivity.
4. Multiply the effective resource score by its weight and divide by the sum of all resource weights. This is the resource’s contribution in enterprise score points. Their sum is the enterprise score on a 0–100 scale. Each contribution exposes operational state, own score, effective score, weight, points, and the direct limiting prerequisite when one lowered the score.

For example, a failed 5,000 Mbps Tampa–Frankfurt primary with a healthy 1,000 Mbps standby gives the circuit a rating of 79. Losing both paths gives it 0. An offline shared endpoint also gives it 0. The live geographic map and topology data use those same catalog circuits.

## Session incidents and logs

The session snapshot exposes a journal of grouped incidents and up to 500 chronological events. A seeded application queue raises service latency and updates resource and enterprise health. Minor queues recur about every ten minutes. Larger batches recur every thirty minutes, progressing through investigation and saturation before the workers drain the queue. The simulator emits six routine events per minute plus condition changes and repeated observations. Acknowledging an active alert records the operator action without changing queue pressure.

Incident timelines own immutable entries and survive console log eviction. The initial resolved circuit timeline uses the chart marker timestamps and episode ID. On a long clock jump the engine finishes any previously observed fault, reconstructs the latest 100 minutes of activity, and publishes once. Unobserved episodes in the skipped interval are omitted. All records reset with the session.


## Live circuit failover

At session minute 45, the seed's primary circuit fails. The Tampa–Frankfurt scenario shifts the available traffic onto its 1,000 Mbps standby. New York–Tampa has no alternate circuit, so its traffic falls to zero, packet loss reaches 100%, and the service desk becomes critical. At minute 50 the primary returns. Queue pressure, loss and latency settle over the next five minutes. Acknowledgment leaves the route and service condition intact. Chart markers, the circuit timeline and the event log use the same phase times.

Read `telemetry.routes.topology` for every logical circuit and `telemetry.routes.geographic` for inter-site circuits. Both collections reference the same immutable route readings. Each reading identifies the primary and selected physical links, effective health and delivered throughput in both directions. Forward flow runs from the catalog link's `from` endpoint to `to`. The reverse flow runs the other way. An unreachable circuit has no selected link or latency reading. The five-second telemetry clock owns these values.
