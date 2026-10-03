"use client";
import { useId, useState } from "react";
export function PulseChart({
  series,
  comparison,
  label,
  compact = false,
}: {
  series: Array<{ time: string; value: number }>;
  comparison?: Array<{ time: string; value: number }>;
  label: string;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [point, setPoint] = useState<number | null>(null);
  const width = 1000,
    height = compact ? 160 : 230,
    max =
      Math.max(
        ...series.map((p) => p.value),
        ...(comparison || []).map((p) => p.value),
        1,
      ) * 1.15;
  const xy = (v: number, i: number) =>
    `${(i * width) / Math.max(series.length - 1, 1)},${height - 14 - (v / max) * (height - 28)}`;
  const points = series.map((p, i) => xy(p.value, i)).join(" ");
  return (
    <div className={"pulse-chart " + (compact ? "compact" : "")}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5b8cff" stopOpacity=".22" />
            <stop offset="100%" stopColor="#5b8cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((n) => (
          <line
            key={n}
            x1="0"
            x2={width}
            y1={n * height}
            y2={n * height}
            stroke="var(--line)"
            strokeDasharray="3 5"
          />
        ))}
        {comparison && (
          <polyline
            points={comparison.map((p, i) => xy(p.value, i)).join(" ")}
            fill="none"
            stroke="var(--muted)"
            strokeOpacity=".5"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill={`url(#${id})`}
        />
        <polyline
          points={points}
          fill="none"
          stroke="#5b8cff"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
        {point !== null && (
          <line
            x1={(point * width) / Math.max(series.length - 1, 1)}
            x2={(point * width) / Math.max(series.length - 1, 1)}
            y1="0"
            y2={height}
            stroke="var(--muted)"
          />
        )}
      </svg>
      <div className="chart-hit-zones">
        {series.map((p, i) => (
          <button
            key={p.time}
            aria-label={`${p.time}: ${p.value.toLocaleString()} ${label}`}
            onMouseEnter={() => setPoint(i)}
            onMouseLeave={() => setPoint(null)}
            onFocus={() => setPoint(i)}
            onBlur={() => setPoint(null)}
          />
        ))}
      </div>
      {point !== null && (
        <div className="chart-tooltip" role="status">
          {series[point].time}
          <strong>
            {series[point].value.toLocaleString()} {label}
          </strong>
        </div>
      )}
    </div>
  );
}
