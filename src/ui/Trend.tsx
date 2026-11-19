import { useMemo, useState } from "preact/hooks";
import { utc } from "../simulation/dashboard";
import type { Sample, Telemetry } from "../simulation/telemetry";

export function Trend({
  telemetry,
  markers,
  title,
  unit,
  read,
}: {
  telemetry: Telemetry;
  markers: readonly { at: number; phase: string; resourceId: string }[];
  title: string;
  unit: string;
  read: (sample: Sample) => number;
}) {
  const { history } = telemetry;
  const [selection, setSelection] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const last = history.length - 1;
  const endAt = history[last]?.at ?? telemetry.current.at;
  const firstAt = history[0]?.at ?? endAt;
  const span = endAt - firstAt;
  const points = useMemo(
    () =>
      history.map((s, i) => `${(i / last) * 1000},${100 - read(s)}`).join(" "),
    [history, last, read],
  );
  const index = selection ?? last;
  const sample = history[index] ?? telemetry.current;
  const mark = markers.find((m) => m.at === sample.at);
  return (
    <section
      class={`panel cc-trend ${expanded ? "enlarged" : ""}`}
      aria-label={title}
    >
      <div class="cc-heading">
        <h2>{title}</h2>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Reduce" : "Expand"} chart
        </button>
      </div>
      <div class="trend-readout">
        {read(sample).toFixed(1)} {unit}
        <small>
          {utc(sample.at)} UTC {mark && `· ${mark.phase} · ${mark.resourceId}`}
        </small>
      </div>
      <div class="plot">
        <svg
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}, rolling 24 hours`}
        >
          {[25, 50, 75].map((y) => (
            <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="#253b3b" />
          ))}
          <polyline
            points={points}
            fill="none"
            stroke="var(--cyan)"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
          />
          {markers.map((m) => (
            <line
              key={m.at}
              x1={((m.at - firstAt) / span) * 1000}
              x2={((m.at - firstAt) / span) * 1000}
              y1="0"
              y2="100"
              stroke="var(--amber)"
              stroke-dasharray="3 3"
            />
          ))}
          {selection !== null && (
            <g stroke="var(--green)" opacity=".8">
              <line
                x1={(index / last) * 1000}
                x2={(index / last) * 1000}
                y1="0"
                y2="100"
              />
              <line
                x1="0"
                x2="1000"
                y1={100 - read(sample)}
                y2={100 - read(sample)}
              />
            </g>
          )}
        </svg>
        <input
          aria-label={`Inspect ${title}`}
          aria-valuetext={`${utc(sample.at)} UTC, ${read(sample).toFixed(1)} ${unit}`}
          type="range"
          min="0"
          max={last}
          value={index}
          onInput={(e) => setSelection(Number(e.currentTarget.value))}
          onPointerMove={(e) => {
            const bounds = e.currentTarget.getBoundingClientRect();
            setSelection(
              Math.max(
                0,
                Math.min(
                  last,
                  Math.round(((e.clientX - bounds.left) / bounds.width) * last),
                ),
              ),
            );
          }}
          onPointerLeave={() => setSelection(null)}
        />
      </div>
      <div class="axis">
        <span>{utc(firstAt)} UTC</span>
        <span>24 hours</span>
        <span>{utc(endAt)} UTC</span>
      </div>
    </section>
  );
}
