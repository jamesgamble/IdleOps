import { useSyncExternalStore } from "preact/compat";
import type { Simulation } from "../simulation/session";
import { Icon } from "./Icon";

function duration(seconds: number) {
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function SessionDetails({ simulation }: { simulation: Simulation }) {
  const session = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );
  const start = new Date(session.startedAt);
  return (
    <section class="panel session" aria-labelledby="session-title">
      <div class="panel-heading">
        <Icon name="clock" />
        <h2 id="session-title">Session details</h2>
      </div>
      <dl>
        <div>
          <dt>Environment</dt>
          <dd>Fictional / local</dd>
        </div>
        <div>
          <dt>Started (UTC)</dt>
          <dd>
            <time dateTime={start.toISOString()}>
              {start.toISOString().slice(11, 19)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Uptime</dt>
          <dd class="cyan">{duration(session.elapsedSeconds)}</dd>
        </div>
      </dl>
    </section>
  );
}
