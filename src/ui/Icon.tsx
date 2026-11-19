import type { Route } from "./routes";

const paths = {
  "command-center": "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  infrastructure:
    "M3 4h18v6H3z M3 14h18v6H3z M6 7h.1 M6 17h.1 M15 7h3 M15 17h3",
  networking: "M9 2h6v5H9z M2 17h6v5H2z M16 17h6v5h-6z M12 7v5 M5 17v-5h14v5",
  security: "M12 2 20 5v6q0 6-8 11-8-5-8-11V5z M8.5 11.5l2.5 2.5 4.5-5",
  "event-console": "M2.5 4.5h19v15h-19z M6.5 9l3 3-3 3 M12 15h4",
  settings:
    "m9 3 1-2h4l1 2 1.5 1 2.5-.1 2 3.5-1.4 2.1v2.7l1.4 2.2-2 3.5-2.5-.1-1.5 1-1 2h-4l-1-2-1.5-1-2.5.1-2-3.5 1.4-2.2V9.5L3 7.4l2-3.5 2.5.1z M15.5 11.5a3.5 3.5 0 1 0-7 0 3.5 3.5 0 0 0 7 0",
  panel: "M3 4h18v16H3z M9 4v16 M16 9l-3 3 3 3",
  pulse: "M2 13h4l3-8 5 14 3-8 2 2h3",
  layers: "m2 8 10-5 10 5-10 5z M2 12l10 5 10-5 M2 16l10 5 10-5",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v6l4 2",
  alert: "m12 3 10 17H2z M12 9v4 M12 16h.01",
  chevron: "m9 6 6 6-6 6",
} satisfies Record<
  | Route
  | "panel"
  | "pulse"
  | "layers"
  | "arrow"
  | "clock"
  | "alert"
  | "chevron",
  string
>;

export function Icon({
  name,
  size = 18,
}: {
  name: keyof typeof paths;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.55"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
