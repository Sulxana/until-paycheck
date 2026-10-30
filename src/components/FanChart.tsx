import { motion } from 'framer-motion'
import { fmt } from '../engine/view'

interface Pt { day: string; p10: number; p50: number; p90: number }

export function FanChart({ data, cushion, height = 170, bills }: { data: Pt[]; cushion: number; height?: number; bills?: { idx: number; name: string; amount: number }[] }) {
  const W = 340, H = height, L = 34, R = 8, T = 12, B = 22
  const vals = data.flatMap(d => [d.p10, d.p90]).concat([cushion, 0])
  const lo = Math.min(...vals) - 10, hi = Math.max(...vals) + 10
  const x = (i: number) => L + (i / (data.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const band = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.p90)}`).join(' ') + ' ' + data.slice().reverse().map((d, j) => `L${x(data.length - 1 - j)} ${y(d.p10)}`).join(' ') + ' Z'
  const mid = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.p50)}`).join(' ')
  const ticks = [lo + 10, (lo + hi) / 2, hi - 10].map(v => Math.round(v / 50) * 50)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#efe8dc" />
          <text x={L - 6} y={y(t) + 3} fontSize="9" textAnchor="end" fill="#8193a5">{fmt(t)}</text>
        </g>
      ))}
      {lo < 0 && <rect x={L} y={y(0)} width={W - L - R} height={H - B - y(0)} fill="#fbe3df" opacity="0.6" />}
      <line x1={L} x2={W - R} y1={y(cushion)} y2={y(cushion)} stroke="#d9534f" strokeDasharray="4 4" strokeWidth="1.5" />
      <text x={W - R} y={y(cushion) - 4} fontSize="9" textAnchor="end" fill="#d9534f" fontWeight="700">ზღვარი {fmt(cushion)} ₾</text>
      <motion.path d={band} fill="#5aa9e6" initial={{ opacity: 0 }} animate={{ opacity: 0.25 }} transition={{ duration: 0.8 }} />
      <motion.path d={mid} fill="none" stroke="#1f3b57" strokeWidth="2.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1 }} />
      {bills?.map(b => (
        <g key={b.name + b.idx}>
          <circle cx={x(b.idx + 1)} cy={y(data[b.idx + 1]?.p50 ?? 0)} r="4.5" fill="#ff7a59" stroke="#fff" strokeWidth="1.5" />
        </g>
      ))}
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].p50)} r="5" fill="#1f3b57" stroke="#fff" strokeWidth="2" />
      {data.map((d, i) => (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) && (
        <text key={i} x={x(i)} y={H - 6} fontSize="9" textAnchor="middle" fill="#8193a5">{d.day}</text>
      ))}
    </svg>
  )
}

/** 12-month strip of p50 landings, coloured by the probability of landing under the cushion */
export function MonthStrip({ rows, cushion, compact }: { rows: { label: string; p50: number; pBelow: number }[]; cushion: number; compact?: boolean }) {
  const col = (p: number) => (p < 0.1 ? '#58b368' : p < 0.3 ? '#f0c419' : p < 0.6 ? '#f08a3c' : '#d9534f')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 3 }}>
      {rows.map((r, i) => (
        <motion.div key={r.label} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.03 }} title={`${r.label}: ~${Math.round(r.p50)} ₾`} style={{ textAlign: 'center' }}>
          <div style={{ height: compact ? 14 : 22, borderRadius: 5, background: col(r.pBelow), opacity: r.p50 < cushion ? 1 : 0.85, boxShadow: r.p50 < cushion ? 'inset 0 0 0 2px rgba(0,0,0,0.15)' : undefined }} />
          <div style={{ fontSize: 8.5, color: '#8193a5', marginTop: 2 }}>{r.label.split(' ')[1]}</div>
        </motion.div>
      ))}
    </div>
  )
}
