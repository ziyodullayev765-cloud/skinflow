import { useState } from "react";
import { fmt } from "../../lib/format";

export function LineChart({ data, color = "rgb(var(--accent))", height = 180 }: { data: { day: string; value: number }[]; color?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 600;
  const h = height;
  const pad = { l: 8, r: 8, t: 16, b: 24 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(data.length - 1)},${h - pad.b} L${x(0)},${h - pad.b} Z`;
  const id = `lg-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Line chart" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={pad.l} x2={w - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="currentColor" strokeOpacity="0.06" />
        ))}
        {data.length > 0 && <path d={area} fill={`url(#${id})`} />}
        {data.length > 0 && <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
        {data.map((d, i) => (
          <g key={d.day}>
            <rect x={x(i) - w / data.length / 2} y={0} width={w / data.length} height={h} fill="transparent" onMouseEnter={() => setHover(i)} />
            {hover === i && <circle cx={x(i)} cy={y(d.value)} r="4" fill={color} />}
            {i % Math.ceil(data.length / 7) === 0 && (
              <text x={x(i)} y={h - 6} textAnchor="middle" className="fill-current text-[10px] opacity-50">
                {d.day.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-lg bg-surface2 px-2.5 py-1 text-xs ring-1 ring-white/10">
          {data[hover].day}: <b className="tabular-nums">{fmt(data[hover].value)}</b>
        </div>
      )}
    </div>
  );
}

export function BarList({ data, colorFor }: { data: { label: string; value: number; rarity?: string }[]; colorFor?: (d: { label: string; rarity?: string }) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="truncate">{d.label}</span>
            <span className="tabular-nums text-muted">{fmt(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(d.value / max) * 100}%`, background: colorFor?.(d) ?? "linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent-2)))" }} />
          </div>
        </li>
      ))}
      {data.length === 0 && <li className="py-6 text-center text-xs text-muted">No data yet</li>}
    </ul>
  );
}

export function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Rarity distribution">
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="16" />
        {total > 0 &&
          data.map((d) => {
            const len = (d.value / total) * c;
            const el = (
              <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
            );
            offset += len;
            return el;
          })}
        <text x="70" y="66" textAnchor="middle" className="fill-current font-display text-xl font-bold">
          {fmt(total)}
        </text>
        <text x="70" y="84" textAnchor="middle" className="fill-current text-[10px] opacity-50">
          drops
        </text>
      </svg>
      <ul className="space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 capitalize">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="w-20">{d.label}</span>
            <span className="tabular-nums text-muted">{total ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
