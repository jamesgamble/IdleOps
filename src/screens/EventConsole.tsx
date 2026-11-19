import { useSyncExternalStore } from "preact/compat";
import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { utc } from "../simulation/dashboard";
import {
  cityById,
  filterLogs,
  type LogFilters,
  levels,
  resourceById,
} from "../simulation/security";
import type { Simulation } from "../simulation/session";
import { SessionDetails } from "../ui/SessionDetails";
import "./security-console.css";

const clearFilters: LogFilters = {
  text: "",
  severity: "",
  resource: "",
  location: "",
};
export function EventConsole({ simulation }: { simulation: Simulation }) {
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );
  const logs = snapshot.journal.logs;
  const [filters, setFilters] = useState(clearFilters);
  const [through, pauseAt] = useState<number | null>(null);
  const [selected, inspect] = useState<number | null>(null);
  const viewport = useRef<HTMLElement>(null);
  const anchor = useRef<{ sequence: number; offset: number } | null>(null);
  const rows = useMemo(
    () => filterLogs(logs, filters, through),
    [logs, filters, through],
  );
  const detail = logs.find((e) => e.sequence === selected);
  const resource = detail && resourceById.get(detail.resourceId);
  const expired = through !== null && !!logs[0] && logs[0].sequence > through;
  function pause() {
    if (through === null) pauseAt(logs.at(-1)?.sequence ?? 0);
  }
  function live() {
    anchor.current = null;
    inspect(null);
    pauseAt(null);
  }
  function trackPosition() {
    const list = viewport.current;
    if (!list) return;
    if (list.scrollHeight - list.clientHeight - list.scrollTop > 3) pause();
    const first = Array.from(
      list.querySelectorAll<HTMLButtonElement>("button[data-sequence]"),
    ).find((row) => row.offsetTop + row.offsetHeight > list.scrollTop);
    anchor.current = first
      ? {
          sequence: Number(first.dataset.sequence),
          offset: first.offsetTop - list.scrollTop,
        }
      : null;
  }
  function change(field: keyof LogFilters, value: string) {
    anchor.current = null;
    setFilters({ ...filters, [field]: value });
  }
  useLayoutEffect(() => {
    const list = viewport.current;
    if (!list) return;
    if (through === null) {
      list.scrollTop = list.scrollHeight;
      return;
    }
    const position = anchor.current;
    if (!position) return;
    const row = list.querySelector<HTMLElement>(
      `[data-sequence="${position.sequence}"]`,
    );
    list.scrollTop = row ? row.offsetTop - position.offset : 0;
  }, [rows, through]);
  return (
    <div class="security-workspace">
      <section class="panel console-panel" aria-label="Event log">
        <header class="cc-heading">
          <h2>Live event log</h2>
          <div class="console-actions">
            <span class="follow-state">
              {through === null ? "Following live" : "Paused"}
            </span>
            {through === null ? (
              <button type="button" onClick={pause}>
                Pause
              </button>
            ) : (
              <>
                <button type="button" onClick={live}>
                  Resume
                </button>
                <button type="button" onClick={live}>
                  Jump to live
                </button>
              </>
            )}
          </div>
        </header>
        <div class="log-filters">
          <label>
            Search logs
            <input
              type="search"
              placeholder="Message, resource or location"
              value={filters.text}
              onInput={(e) => change("text", e.currentTarget.value)}
            />
          </label>
          <label>
            Severity
            <select
              value={filters.severity}
              onChange={(e) => change("severity", e.currentTarget.value)}
            >
              <option value="">All levels</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Resource
            <select
              value={filters.resource}
              onChange={(e) => change("resource", e.currentTarget.value)}
            >
              <option value="">All resources</option>
              {snapshot.catalog.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location
            <select
              value={filters.location}
              onChange={(e) => change("location", e.currentTarget.value)}
            >
              <option value="">All locations</option>
              {snapshot.catalog.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.city}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div class="log-columns" aria-hidden="true">
          <span>Time · UTC</span>
          <span>Severity</span>
          <span>Resource / location</span>
          <span>Message</span>
        </div>
        <section
          class="log-viewport"
          ref={viewport}
          onScroll={trackPosition}
          aria-label="Log records"
        >
          {rows.map((e) => {
            const r = resourceById.get(e.resourceId);
            return (
              <button
                class="log-record"
                type="button"
                key={e.sequence}
                data-sequence={e.sequence}
                aria-pressed={e.sequence === selected}
                onClick={() => {
                  pause();
                  inspect(e.sequence);
                }}
              >
                <span class="event-clock">{utc(e.at)}</span>
                <span class="log-level" data-level={e.severity}>
                  {e.severity}
                </span>
                <span>
                  {r?.name}
                  <small>{r && cityById.get(r.siteId)}</small>
                </span>
                <span>{e.message}</span>
              </button>
            );
          })}
          {!rows.length && (
            <p class="log-empty">
              {expired
                ? "The paused records have expired. Jump to live to see the current journal."
                : "No matching events."}
            </p>
          )}
        </section>
        <div class="log-count">
          {rows.length} matching · {logs.length} / 500 retained
        </div>
        {selected !== null && (
          <section class="log-detail" aria-label="Event details">
            <header class="cc-heading">
              <h2>Event #{selected}</h2>
              <button type="button" onClick={() => inspect(null)}>
                Close details
              </button>
            </header>
            {detail ? (
              <>
                <p>{detail.message}</p>
                <dl class="facts">
                  {Object.entries({
                    "Time (UTC)": new Date(detail.at).toISOString(),
                    Severity: detail.severity.toUpperCase(),
                    Resource: resource?.name ?? detail.resourceId,
                    Location: resource && cityById.get(resource.siteId),
                    Incident: detail.incidentId,
                    Circuit: detail.linkId,
                  })
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
              </>
            ) : (
              <p>This event has expired from the session journal.</p>
            )}
          </section>
        )}
      </section>
      <SessionDetails simulation={simulation} />
    </div>
  );
}
