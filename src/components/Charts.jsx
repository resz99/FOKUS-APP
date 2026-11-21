// Grafik SVG ringan (tanpa library) — responsif & ikut tema.

export function BarChart({ data, height = 140, goal, format = (v) => v, colors }) {
  // data: [{ label, value, highlight? }] atau value bisa array (stacked) bila colors diberikan
  const W = 320, H = height, padB = 22, padT = 16;
  const totals = data.map((d) => (Array.isArray(d.value) ? d.value.reduce((a, b) => a + b, 0) : d.value));
  const max = Math.max(goal || 0, ...totals, 1);
  const bw = W / data.length;
  const y = (v) => H - padB - ((H - padB - padT) * v) / max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {goal ? (
        <>
          <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} className="chart-goal" />
          <text x={W - 2} y={y(goal) - 4} textAnchor="end" className="chart-goal-label">target {format(goal)}</text>
        </>
      ) : null}
      {data.map((d, i) => {
        const x = i * bw + bw * 0.2;
        const w = bw * 0.6;
        const vals = Array.isArray(d.value) ? d.value : [d.value];
        let acc = 0;
        return (
          <g key={i}>
            {vals.map((v, j) => {
              const y0 = y(acc), y1 = y(acc + v);
              acc += v;
              if (!v) return null;
              return <rect key={j} x={x} y={y1} width={w} height={Math.max(0, y0 - y1)} rx="3"
                className={!colors && d.highlight ? 'bar bar-hl' : 'bar'} style={colors ? { fill: colors[j] } : undefined}>
                <title>{`${d.label}: ${format(v)}`}</title>
              </rect>;
            })}
            {totals[i] > 0 && <text x={x + w / 2} y={y(totals[i]) - 4} textAnchor="middle" className="chart-val">{format(totals[i])}</text>}
            <text x={x + w / 2} y={H - 6} textAnchor="middle" className="chart-label">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ points, height = 170, targets = [], unit = '' }) {
  // points: [{ label, value }]
  const W = 320, H = height, padL = 30, padR = 10, padT = 14, padB = 22;
  if (!points.length) return null;
  const vals = [...points.map((p) => p.value), ...targets.map((t) => t.value)];
  const min = Math.floor(Math.min(...vals) - 1), max = Math.ceil(Math.max(...vals) + 1);
  const x = (i) => padL + (points.length === 1 ? (W - padL - padR) / 2 : ((W - padL - padR) * i) / (points.length - 1));
  const y = (v) => padT + ((H - padT - padB) * (max - v)) / (max - min || 1);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const ticks = [min, Math.round((min + max) / 2), max];
  const step = Math.ceil(points.length / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="chart-label">{t}</text>
        </g>
      ))}
      {targets.map((t) => (
        <g key={t.label}>
          <line x1={padL} x2={W - padR} y1={y(t.value)} y2={y(t.value)} className="chart-goal" />
          <text x={W - padR} y={y(t.value) - 4} textAnchor="end" className="chart-goal-label">{t.label}</text>
        </g>
      ))}
      <path d={path} className="chart-line" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="3.5" className="chart-dot"><title>{`${p.label}: ${p.value}${unit}`}</title></circle>
          {(i % step === 0 || i === points.length - 1) && <text x={x(i)} y={H - 6} textAnchor="middle" className="chart-label">{p.label}</text>}
        </g>
      ))}
    </svg>
  );
}
