// Single-series daily bar chart (server-rendered SVG). One hue, no legend: the
// card title names the series. Hover shows a native tooltip; a visually hidden
// table carries the same data for screen readers.

export function DailyChart({ data, label }: { data: Array<{ day: string; value: number }>; label: string }) {
  const width = 720;
  const height = 160;
  const pad = { top: 8, right: 4, bottom: 18, left: 32 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, slot - 2);
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH;
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.ceil(data.length / 6);

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label={`${label} per day`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">
              {t.toLocaleString("en-CA")}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(0, pad.top + innerH - y(d.value));
          const x = pad.left + i * slot + (slot - barW) / 2;
          return (
            <g key={d.day} className="group">
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH} fill="transparent" />
              {h > 0 ? (
                <path
                  d={`M${x},${pad.top + innerH} v${-Math.max(0, h - Math.min(4, barW / 2, h))} q0,${-Math.min(4, barW / 2, h)} ${Math.min(4, barW / 2)},${-Math.min(4, barW / 2, h)} h${barW - 2 * Math.min(4, barW / 2)} q${Math.min(4, barW / 2)},0 ${Math.min(4, barW / 2)},${Math.min(4, barW / 2, h)} v${Math.max(0, h - Math.min(4, barW / 2, h))} z`}
                  className="fill-indigo-500 group-hover:fill-indigo-700"
                />
              ) : null}
              <title>{`${d.day}: ${d.value.toLocaleString("en-CA")} ${label.toLowerCase()}`}</title>
              {i % labelEvery === 0 ? (
                <text x={pad.left + i * slot + slot / 2} y={height - 4} textAnchor="middle" fontSize={9} fill="#94a3b8">
                  {d.day.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{label} per day</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function TopList({ title, rows, empty }: { title: string; rows: Array<{ label: string; count: number }>; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-900">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">{empty}</p>
      ) : (
        <table className="mt-2 w-full text-xs">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="relative py-1 pr-2">
                  <span className="absolute inset-y-0.5 left-0 rounded bg-indigo-50" style={{ width: `${(r.count / max) * 100}%` }} aria-hidden />
                  <span className="relative block truncate pl-1 text-slate-700">{r.label}</span>
                </td>
                <td className="w-12 py-1 text-right font-medium text-slate-900">{r.count.toLocaleString("en-CA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
