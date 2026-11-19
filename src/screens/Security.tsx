import { useSyncExternalStore } from "preact/compat";
import { utc } from "../simulation/dashboard";
import type { LogEntry } from "../simulation/events";
import {
  cityById,
  resourceById,
  securitySummary,
} from "../simulation/security";
import type { Simulation } from "../simulation/session";
import { SessionDetails } from "../ui/SessionDetails";
import "./security-console.css";

function Activity({
  events,
  empty,
}: {
  events: readonly LogEntry[];
  empty: string;
}) {
  return events.length ? (
    <ul class="security-list">
      {events
        .slice(-8)
        .reverse()
        .map((event) => {
          const r = resourceById.get(event.resourceId);
          return (
            <li key={event.sequence}>
              <span class="log-level" data-level={event.severity}>
                {event.severity}
              </span>
              <span>
                {event.message}
                <small>
                  {r?.name} · {r && cityById.get(r.siteId)}
                </small>
              </span>
              <span class="event-clock">{utc(event.at)} UTC</span>
            </li>
          );
        })}
    </ul>
  ) : (
    <p class="log-empty">{empty}</p>
  );
}
export function Security({ simulation }: { simulation: Simulation }) {
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );
  const status = securitySummary(snapshot);
  return (
    <div class="security-workspace">
      <section class="security-scores" aria-label="Security measures">
        {[
          ["Current posture", status.posture, "Perimeter and sign-in health"],
          [
            "Authentication successes",
            status.successes,
            "Retained sign-in events",
          ],
          [
            "Authentication failures",
            status.failures.length,
            "Retained sign-in events",
          ],
          ["Blocked connections", status.blocked, "Retained policy decisions"],
        ].map(([label, value, detail]) => (
          <div class="panel security-score" key={label}>
            <h2>{label}</h2>
            <strong data-attention={value === "Attention"}>{value}</strong>
            <small>{detail}</small>
          </div>
        ))}
      </section>
      <div class="security-columns">
        <section class="panel">
          <header class="cc-heading">
            <h2>Live security activity</h2>
          </header>
          <Activity
            events={status.activity}
            empty="Waiting for security activity."
          />
        </section>
        <section class="panel">
          <header class="cc-heading">
            <h2>Active warnings</h2>
          </header>
          {status.warnings.length ? (
            <ul class="security-list">
              {status.warnings.map((w) => (
                <li key={w.id}>
                  <span class="log-level" data-level={w.severity}>
                    {w.severity}
                  </span>
                  <span>
                    {w.message}
                    <small>
                      {resourceById.get(w.resourceId)?.name} ·{" "}
                      {w.acknowledged ? "Acknowledged" : "Open"}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="log-empty">No active sign-in warnings.</p>
          )}
          <header class="cc-heading">
            <h2>Recent security alerts</h2>
          </header>
          <Activity
            events={status.failures}
            empty="No sign-in failures in the retained journal."
          />
        </section>
      </div>
      <SessionDetails simulation={simulation} />
    </div>
  );
}
