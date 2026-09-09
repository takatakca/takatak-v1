export function Sparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const gradientId = `spark-${color.replace("#", "")}`;

  if (values.length < 2) {
    return (
      <svg viewBox="0 0 120 36" className="h-10 w-full" aria-hidden="true">
        <path d="M0 26 H120" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="2" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 120;
    const y = 30 - ((value - min) / span) * 24;
    return { x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `M${coords[0].x},${coords[0].y} L${coords
    .slice(1)
    .map((point) => `${point.x},${point.y}`)
    .join(" ")} L${last.x},36 L0,36 Z`;

  return (
    <svg viewBox="0 0 120 36" className="h-10 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
    </svg>
  );
}

export function DonutChart({
  slices,
  totalLabel,
  caption = "Total",
}: {
  slices: { key: string; value: number; color: string }[];
  totalLabel: string;
  caption?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40" aria-hidden="true">
      <circle cx="80" cy="80" r={radius} fill="none" stroke="#eef0f3" strokeWidth="18" />
      {total > 0
        ? slices
            .filter((slice) => slice.value > 0)
            .map((slice) => {
              const length = (slice.value / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const currentOffset = offset;
              offset += length;
              return (
                <circle
                  key={slice.key}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="18"
                  strokeDasharray={dash}
                  strokeDashoffset={-currentOffset}
                  strokeLinecap="butt"
                  transform="rotate(-90 80 80)"
                />
              );
            })
        : null}
      <text x="80" y="74" textAnchor="middle" className="fill-slate-400" fontSize="11">
        {caption}
      </text>
      <text x="80" y="96" textAnchor="middle" className="fill-slate-900" fontSize="18" fontWeight="650">
        {totalLabel}
      </text>
    </svg>
  );
}

export function LineChart({
  values,
  color = "#3b82f6",
  emptyLabel,
}: {
  values: number[];
  color?: string;
  emptyLabel?: string;
}) {
  if (values.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-400">
        {emptyLabel ?? "No data yet"}
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 320;
  const height = 140;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 16) + 8;
    const y = height - 16 - ((value - min) / span) * (height - 32);
    return { x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `M${coords[0].x},${coords[0].y} L${coords
    .slice(1)
    .map((point) => `${point.x},${point.y}`)
    .join(" ")} L${last.x},${height} L${coords[0].x},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" aria-hidden="true">
      <path d={area} fill={color} fillOpacity="0.08" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
    </svg>
  );
}
