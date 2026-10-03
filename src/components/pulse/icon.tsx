import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  pulse: "M2 12h4l3-9 5 18 3-9h5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  live: "M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0M12 12v8",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8m6 10v-2a4 4 0 0 0-3-3M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3a19 19 0 0 1 0 18 19 19 0 0 1 0-18",
  chart: "M3 3v18h18M7 14l4-4 4 3 6-7",
  bolt: "m13 2-9 12h7l-1 8 10-12h-7z",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  sun: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  moon: "M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10",
  check: "m5 12 4 4 10-10",
  copy: "M9 9h12v12H9zM15 5V3H3v12h2",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M3 6h18M3 12h18M3 18h18",
  calendar: "M3 5h18v16H3zM3 10h18M7 2v6m10-6v6",
  download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6",
  layers: "m12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5",
  help: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  external: "M15 3h6v6m0-6-10 10M9 3H3v18h18v-6",
  plus: "M12 5v14M5 12h14",
  terminal: "m4 5 6 6-6 6M12 19h8",
  target:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M12 10v4",
  filter: "M3 4h18l-7 8v7l-4 2v-9z",
};
export function Icon({
  name,
  size = 18,
  style,
  className = "",
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      className={className}
    >
      <path d={paths[name] || paths.pulse} />
    </svg>
  );
}
