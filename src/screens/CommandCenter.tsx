import { useSyncExternalStore } from "preact/compat";
import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  activityValue,
  dashboard,
  healthValue,
  utc,
} from "../simulation/dashboard";
import type { Simulation } from "../simulation/session";
import { OperationControls } from "../ui/OperationControls";
import { OperationsMap } from "../ui/OperationsMap";
import { SessionDetails } from "../ui/SessionDetails";
import { Trend } from "../ui/Trend";
import "./command-center.css";

type Selection = { kind: "indicator" | "alert"; id: string };
export function CommandCenter({ simulation }: { simulation: Simulation }) {
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );
  const { catalog, telemetry, journal } = snapshot;
  const view = useMemo(() => dashboard(snapshot), [snapshot]);
  const [selection, select] = useState<Selection | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    if (selection) dialog.current?.showModal();
  }, [selection]);
  const indicator = view.indicators.find(
    (i) => selection?.kind === "indicator" && i.name === selection.id,
  );
  const issue =
    selection?.kind === "alert"
      ? view.queue.find((q) => q.alert.id === selection.id)
      : undefined;
  const historical =
    selection?.kind === "alert"
      ? journal.incidents.find((i) => i.id === selection.id)
      : undefined;
  const title =
    indicator?.name ??
    issue?.alert.message ??
    historical?.timeline[0]?.message ??
    "Incident details";
  const timeline = historical?.timeline ?? issue?.timeline ?? [];
  const now = snapshot.startedAt + snapshot.elapsedSeconds * 1000;
  const affectedId = historical?.resourceId ?? issue?.alert.resourceId;
  const affected = affectedId && view.resources.get(affectedId);
  const metric = affectedId && telemetry.current.resources[affectedId];
  const linkId = historical?.timeline[0]?.linkId;
  const link =
    linkId && telemetry.routes.topology.find((r) => r.primary.id === linkId);
  const endpoint = link && view.resources.get(link.primary.from);
  const resolved = journal.incidents
    .filter((i) => i.stage === "resolved")
    .slice()
    .reverse();
  const recentResolution = resolved.find(
    (i) => now - (i.timeline.at(-1)?.at ?? 0) < 30000,
  );
  return (
    <div class="cc">
      <section class="scores" aria-label="Enterprise scorecard">
        {view.indicators.map((i) => (
          <button
            key={i.name}
            class="score"
            type="button"
            onClick={() => select({ kind: "indicator", id: i.name })}
          >
            <span>{i.name}</span>
            <b>
              {i.value} <small>{i.unit}</small>
            </b>
            <em>{i.detail}</em>
          </button>
        ))}
      </section>
      <div class="cc-grid">
        <div class="cc-column">
          <section class="panel">
            <div class="cc-heading">
              <h2>Infrastructure</h2>
            </div>
            <dl class="facts">
              <div>
                <dt>Physical servers</dt>
                <dd>{catalog.enterpriseTotals.physicalServers}</dd>
              </div>
              <div>
                <dt>Virtual machines</dt>
                <dd>{catalog.enterpriseTotals.virtualMachines}</dd>
              </div>
              <div>
                <dt>Monitored resources</dt>
                <dd>{catalog.resources.length}</dd>
              </div>
            </dl>
          </section>
          <section class="panel">
            <div class="cc-heading">
              <h2>Network &amp; security</h2>
            </div>
            <dl class="facts">
              {view.indicators.slice(3, 5).map((i) => (
                <div key={i.name}>
                  <dt>{i.detail}</dt>
                  <dd>
                    {i.value} {i.unit}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <SessionDetails simulation={simulation} />
        </div>
        <div class="cc-column">
          <OperationsMap snapshot={snapshot} />
          <Trend
            telemetry={telemetry}
            markers={view.markers}
            title="Enterprise health trend"
            unit="pts"
            read={healthValue}
          />
        </div>
        <div class="cc-column">
          <section class="panel">
            <div class="cc-heading">
              <h2>Incident queue</h2>
              <span>{view.queue.length} signals</span>
            </div>
            {recentResolution && (
              <p class="resolution-notice" role="status">
                Resolved · {recentResolution.timeline[0]?.message}
              </p>
            )}
            <div class="queue">
              {view.queue.map((q) => (
                <button
                  type="button"
                  key={q.alert.id}
                  onClick={() => select({ kind: "alert", id: q.alert.id })}
                >
                  <span class={`severity ${q.alert.severity}`}>
                    {q.alert.severity}
                  </span>
                  <strong>{q.alert.message}</strong>
                  <span>{q.resourceName}</span>
                  <small>
                    {q.stage} · {Math.floor((now - q.since) / 60000)} min ·{" "}
                    {q.alert.acknowledged ? "Acknowledged" : "Unacknowledged"}
                  </small>
                </button>
              ))}
            </div>
            <details class="incident-history">
              <summary>Resolved incidents ({resolved.length})</summary>
              {resolved.map((i) => (
                <button
                  type="button"
                  key={i.id}
                  onClick={() => select({ kind: "alert", id: i.id })}
                >
                  {i.id} · {view.resources.get(i.resourceId)?.name}
                </button>
              ))}
            </details>
          </section>
          <Trend
            telemetry={telemetry}
            markers={view.markers}
            title="System activity trend"
            unit="% CPU"
            read={activityValue}
          />
        </div>
      </div>
      <section class="panel stream">
        <div class="cc-heading">
          <h2>Live event stream</h2>
          <span>UTC</span>
        </div>
        {journal.logs
          .slice(-4)
          .reverse()
          .map((e) => (
            <div class="event-row" key={`${e.at}-${e.message}`}>
              <span>{utc(e.at)}</span>
              <span class={`severity ${e.severity}`}>{e.severity}</span>
              <span>{view.resources.get(e.resourceId)?.name}</span>
              <strong>{e.message}</strong>
            </div>
          ))}
      </section>
      <dialog
        class="cc-drawer"
        ref={dialog}
        onClose={() => select(null)}
        aria-labelledby="detail-title"
      >
        <div class="cc-heading">
          <h2 id="detail-title">{title}</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
        {indicator && (
          <>
            <p>
              {indicator.detail} · {indicator.value} {indicator.unit}
            </p>
            <dl class="facts">
              {indicator.rows.length ? (
                indicator.rows.map(([name, val]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{val}</dd>
                  </div>
                ))
              ) : (
                <p>No open incidents.</p>
              )}
            </dl>
          </>
        )}
        {(issue || historical) && (
          <>
            <p>
              {issue?.resourceName ??
                (historical &&
                  view.resources.get(historical.resourceId)?.name)}{" "}
              · {issue?.stage ?? historical?.stage}
            </p>
            {issue && (
              <button
                type="button"
                disabled={issue.alert.acknowledged}
                onClick={() => simulation.acknowledge(issue.alert.id)}
              >
                {issue.alert.acknowledged
                  ? "Acknowledged"
                  : "Acknowledge alert"}
              </button>
            )}
            <p>
              Severity · {issue?.alert.severity ?? historical?.severity} ·
              Affected system · {affected?.name}
              {link && ` · ${link.primary.id}`}
            </p>
            {historical?.stage === "resolved" && (
              <p role="status" class="resolution-notice">
                Incident resolved
              </p>
            )}
            <h3>Current metrics</h3>
            {metric && (
              <p>
                Response {metric.responseMs.toFixed(1)} ms · CPU{" "}
                {metric.cpuPercent.toFixed(1)}% · Enterprise health{" "}
                {telemetry.health.score.toFixed(1)}
              </p>
            )}
            {link && (
              <p>
                {link.selected?.id ?? "No path"} · {link.lossPercent.toFixed(1)}
                % loss
              </p>
            )}
            {issue && (endpoint || affected) && (
              <>
                <h3>Guided investigation</h3>
                <p>
                  {endpoint
                    ? "Test connectivity on the primary endpoint, then run maintenance to restore the circuit."
                    : historical
                      ? "Check resource health, then restart the service to clear the delayed queue."
                      : "Check resource health to inspect the current condition."}
                </p>
                {endpoint ? (
                  <OperationControls
                    snapshot={snapshot}
                    resource={endpoint}
                    actions={["diagnose-link", "run-maintenance"]}
                    incidentId={historical?.id}
                  />
                ) : (
                  affected && (
                    <OperationControls
                      snapshot={snapshot}
                      resource={affected}
                      actions={
                        historical
                          ? ["check-health", "restart-service"]
                          : ["check-health"]
                      }
                      incidentId={historical?.id}
                    />
                  )
                )}
              </>
            )}
            <h3>Related logs</h3>
            {journal.logs
              .filter(
                (e) =>
                  e.incidentId === selection?.id ||
                  (!historical && e.resourceId === affectedId),
              )
              .slice(-8)
              .map((e) => (
                <p key={e.sequence}>
                  {utc(e.at)} UTC · {e.message}
                </p>
              ))}
            <h3>Timeline</h3>
            {timeline.length ? (
              timeline.map((e, i) => (
                <p key={`${e.at}-${i}`}>
                  {utc(e.at)} UTC · {e.message}
                </p>
              ))
            ) : (
              <p>{utc(snapshot.startedAt)} UTC · Monitoring began</p>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
