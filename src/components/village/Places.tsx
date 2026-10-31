import { useId } from 'react'
import { motion } from 'framer-motion'
import type { Qvevri } from '../../state/store'

/**
 * Village places, drawn in the shared scene coordinate space (viewBox 0 0 390 300).
 * Every place is a pure function of verified-behaviour counters — never of balance size.
 */

export type PlaceId = 'tower' | 'school' | 'cellar' | 'station' | 'bridge'

export const TOWER_MAX = 12
export const BRIDGE_MAX = 20
export const STATION_MAX = 5
export const BOOKS_PER_TOPIC = 6

/** crop boxes used for the sheet hero illustration */
export const PLACE_BOX: Record<PlaceId, [number, number, number, number]> = {
  tower: [2, 64, 72, 158],
  school: [60, 138, 100, 80],
  cellar: [146, 158, 92, 96],
  station: [302, 48, 76, 80],
  bridge: [244, 220, 114, 62],
}

/** generous invisible tap areas in the scene */
export const PLACE_HIT: Record<PlaceId, [number, number, number, number]> = {
  tower: [12, 70, 52, 150],
  school: [62, 148, 94, 66],
  cellar: [154, 166, 74, 86],
  station: [306, 50, 70, 78],
  bridge: [252, 230, 98, 44],
}

const spring = { type: 'spring' as const, damping: 13, stiffness: 170 }

/* ───────────────────────── Svan tower ───────────────────────── */
export function TowerPlace({ stones }: { stones: number }) {
  const n = Math.min(TOWER_MAX, Math.max(0, stones))
  const cx = 38
  const base = 216
  const ch = 9
  const courseW = (i: number) => 30 - i * 0.4
  const done = n >= TOWER_MAX
  const crownY = base - TOWER_MAX * ch // 108
  return (
    <g>
      <ellipse cx={cx} cy={base + 1} rx="22" ry="4" fill="rgba(0,0,0,0.13)" />
      {/* ghost silhouette of the full tower — shows the goal */}
      {Array.from({ length: TOWER_MAX - n }).map((_, k) => {
        const i = n + k
        const w = courseW(i)
        return <rect key={'g' + i} x={cx - w / 2} y={base - (i + 1) * ch} width={w} height={ch} fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" strokeDasharray="2 2" />
      })}
      {!done && (
        <g fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" strokeDasharray="2 2">
          <rect x={cx - 17} y={crownY - 10} width="34" height="10" />
          <path d={`M${cx - 19} ${crownY - 10} L${cx} ${crownY - 22} L${cx + 19} ${crownY - 10} Z`} />
        </g>
      )}
      {/* built courses */}
      {Array.from({ length: n }).map((_, i) => {
        const w = courseW(i)
        const y = base - (i + 1) * ch
        return (
          <motion.g key={i} initial={{ opacity: 0, y: -26 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.15 + i * 0.06 }}>
            <rect x={cx - w / 2} y={y} width={w} height={ch} fill={i % 2 ? '#d3c6ad' : '#c2b398'} stroke="#a39478" strokeWidth="0.7" />
            <path d={`M${cx + (i % 2 ? -5 : 4)} ${y} v${ch} M${cx + (i % 2 ? 7 : -9)} ${y} v${ch}`} stroke="#a39478" strokeWidth="0.6" />
            {(i === 3 || i === 6 || i === 9) && <rect x={cx - 1.6} y={y + 2} width="3.2" height="5.4" rx="1.6" fill="#3e3226" />}
            {i === 1 && <path d={`M${cx - 4} ${y + ch} v-6 a4 4 0 0 1 8 0 v6 Z`} fill="#5b4632" />}
          </motion.g>
        )
      })}
      {/* crown + roof at 12 */}
      {done && (
        <motion.g initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.15 + TOWER_MAX * 0.06 }}>
          <rect x={cx - 17} y={crownY - 10} width="34" height="10" fill="#cbbda3" stroke="#a39478" strokeWidth="0.7" />
          {[-10, -3.5, 3, 9.5].map(dx => <path key={dx} d={`M${cx + dx} ${crownY - 1} v-4 a1.6 1.6 0 0 1 3.2 0 v4 Z`} fill="#3e3226" />)}
          <path d={`M${cx - 19} ${crownY - 10} L${cx} ${crownY - 22} L${cx + 19} ${crownY - 10} Z`} fill="#7a5a3a" />
          <path d={`M${cx} ${crownY - 22} L${cx + 19} ${crownY - 10} L${cx + 6} ${crownY - 10} Z`} fill="#664a2f" />
          <path d={`M${cx} ${crownY - 22} V${crownY - 36}`} stroke="#5b4636" strokeWidth="1.4" />
          <motion.path d={`M${cx} ${crownY - 36} L${cx + 13} ${crownY - 32} L${cx} ${crownY - 28} Z`} fill="#e63946" animate={{ scaleX: [1, 0.82, 1] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }} style={{ originX: 0 }} />
        </motion.g>
      )}
    </g>
  )
}

/* ───────────────────────── School ───────────────────────── */
const BOOK_COLORS = ['#e76f51', '#2a9d8f', '#f4a261', '#5a7bd8', '#9b5de5']
const WINDOWS: [number, number][] = [
  [88, 187], [104.5, 187], [121, 187],
  [88, 199], [104.5, 199], [121, 199],
]
export function SchoolPlace({ books, topics }: { books: number; topics: number }) {
  const shown = Math.min(14, Math.max(0, books))
  return (
    <g>
      <ellipse cx="104" cy="211" rx="42" ry="4" fill="rgba(0,0,0,0.12)" />
      {/* chimney + smoke */}
      <rect x="120" y="161" width="7" height="16" fill="#9a5536" />
      <g fill="#ffffff">
        <circle cx="123.5" cy="157" r="3.4" style={{ animation: 'vlgSmoke 3.2s ease-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
        <circle cx="123.5" cy="157" r="3.4" style={{ animation: 'vlgSmoke 3.2s ease-out 1.6s infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
      </g>
      {/* body */}
      <rect x="68" y="182" width="68" height="28" rx="1.5" fill="#f6e6c8" stroke="#d9c39c" strokeWidth="0.8" />
      <path d="M64 184 L102 160 L140 184 Z" fill="#d1683f" />
      <path d="M102 160 L140 184 L126 184 Z" fill="#b5532f" />
      <circle cx="102" cy="173" r="4.2" fill="#fff6e6" stroke="#b5532f" strokeWidth="0.8" />
      <path d="M102 170.6 v2.6 l1.8 1.2" stroke="#7a3a1f" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      {/* door */}
      <path d="M71 210 v-12 a5 5 0 0 1 10 0 v12 Z" fill="#7a4e2d" />
      <circle cx="78.6" cy="204" r="0.8" fill="#f2c14e" />
      {/* windows: one lit per mastered topic */}
      {WINDOWS.map(([x, y], i) => {
        const lit = i < topics
        return (
          <g key={i}>
            {lit && <rect x={x - 3} y={y - 3} width="16" height="14" rx="4" fill="#ffd166" opacity="0.2" />}
            <rect x={x} y={y} width="10" height="8" rx="1.2" fill={lit ? '#ffd166' : '#55667a'} opacity={lit ? 1 : 0.45} style={lit ? { animation: `glow 3s ease-in-out ${i * 0.4}s infinite` } : undefined} />
            <path d={`M${x + 5} ${y} v8 M${x} ${y + 4} h10`} stroke="#f6e6c8" strokeWidth="0.9" />
          </g>
        )
      })}
      {/* book stack: one book per completed morning lesson */}
      {Array.from({ length: shown }).map((_, i) => (
        <motion.rect key={i} x={140 + (i % 3 === 1 ? 0.9 : i % 3 === 2 ? -0.6 : 0)} y={210 - (i + 1) * 2.7} width="12" height="2.4" rx="0.6" fill={BOOK_COLORS[i % BOOK_COLORS.length]} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }} />
      ))}
    </g>
  )
}

/* ───────────────────────── Wine cellar (marani) ───────────────────────── */
const JAR = 'M0 0 C-7 0 -12 -8 -12 -16 C-12 -24 -7 -28 -5 -30 L5 -30 C7 -28 12 -24 12 -16 C12 -8 7 0 0 0 Z'
const INNER = 'translate(0 -15) scale(0.72) translate(0 15)'

export const jarPct = (q: Qvevri) => Math.max(0, Math.min(1, q.filled / Math.max(1, q.target)))

export function Jar({ x, y, q, ghost }: { x: number; y: number; q?: Qvevri; ghost?: boolean }) {
  const id = 'vq' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const pct = q ? jarPct(q) : 0
  const h = 21.6 * pct
  if (ghost) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <path d={JAR} fill="rgba(255,255,255,0.35)" stroke="#fff" strokeWidth="1" strokeDasharray="2.2 2" />
        <text x="0" y="-10" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ffffff">+</text>
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="15" ry="3.6" fill="rgba(0,0,0,0.16)" />
      <path d={JAR} fill="#c4744a" />
      <path d={JAR} fill="#f4e4cb" transform={INNER} />
      <clipPath id={id}><path d={JAR} transform={INNER} /></clipPath>
      <g clipPath={`url(#${id})`}>
        {h > 0 && (
          <motion.rect x="-12" y={-4.2 - h} width="24" height={h + 0.5} fill="#e9a23b" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.1, delay: 0.35, ease: 'easeOut' }} style={{ originY: 1 }} />
        )}
        {pct > 0 && pct < 1 && <rect x="-12" y={-4.2 - h} width="24" height="1.2" fill="#ffd27a" />}
      </g>
      <path d="M-9 -20 q1 -6 4 -8" stroke="#e6a27c" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8" />
      <rect x="-6.5" y="-33" width="13" height="3.4" rx="1.4" fill="#a85f3a" />
      {q?.sealedAt && (
        <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 8, delay: 1.3 }}>
          <ellipse cx="0" cy="-34" rx="8.5" ry="2.6" fill="#8d8473" />
          <path d="M-2 -33 l-4 9 l3 -1 l1 3 z M2 -33 l4 9 l-3 -1 l-1 3 z" fill="#c1121f" />
          <circle cx="0" cy="-34.5" r="3.4" fill="#d62828" stroke="#9d0208" strokeWidth="0.8" />
        </motion.g>
      )}
    </g>
  )
}

export function CellarPlace({ qvevri }: { qvevri: Qvevri[] }) {
  const jars = qvevri.slice(0, 3)
  const k = Math.max(1, jars.length)
  const jx = (i: number) => 190 + (i - (k - 1) / 2) * 27
  return (
    <g>
      <ellipse cx="190" cy="211" rx="36" ry="4" fill="rgba(0,0,0,0.12)" />
      {/* grapevine */}
      <path d="M158 210 C152 196 160 188 156 178" stroke="#6b4a2b" strokeWidth="2" fill="none" />
      <g fill="#4e9d57"><circle cx="156" cy="180" r="5" /><circle cx="162" cy="176" r="4.5" /><circle cx="152" cy="186" r="4" /></g>
      <g fill="#7b2d6b"><circle cx="158" cy="188" r="1.6" /><circle cx="160" cy="190" r="1.6" /><circle cx="157" cy="191" r="1.6" /><circle cx="159" cy="193" r="1.5" /></g>
      {/* building */}
      <rect x="162" y="186" width="58" height="24" rx="1.5" fill="#dcc9a8" stroke="#bea781" strokeWidth="0.8" />
      <path d="M170 192 h8 M188 196 h10 M204 191 h9 M166 203 h7 M206 203 h9" stroke="#bea781" strokeWidth="0.8" />
      <path d="M157 188 L191 171 L225 188 Z" fill="#c8643b" />
      <path d="M163 185 h56 M169 181.5 h44 M176 178 h30" stroke="#a84e2c" strokeWidth="0.8" />
      <path d="M184 210 v-10 a7 7 0 0 1 14 0 v10 Z" fill="#4a3324" />
      <path d="M191 193 v17" stroke="#6b4a33" strokeWidth="0.8" />
      {/* jars: one per savings goal */}
      {jars.length === 0 ? <Jar x={190} y={244} ghost /> : jars.map((q, i) => <Jar key={i} x={jx(i)} y={244} q={q} />)}
    </g>
  )
}

/* ───────────────────────── Weather station ───────────────────────── */
export const INSTRUMENTS = ['ქარის ისარი', 'ქარის საზომი', 'თერმომეტრის ყუთი', 'წვიმის საზომი', 'თანამგზავრული თეფში']

export function StationPlace({ level }: { level: number }) {
  const lv = Math.max(1, Math.min(STATION_MAX, level))
  const sx = 340
  const sy = 120
  const H = 30 + lv * 5
  const top = sy - H
  return (
    <g>
      <ellipse cx={sx} cy={sy + 1} rx="22" ry="3.6" fill="rgba(0,0,0,0.12)" />
      {/* guy wires */}
      <path d={`M${sx} ${top + 6} L${sx - 14} ${sy} M${sx} ${top + 6} L${sx + 14} ${sy}`} stroke="#9aa7b4" strokeWidth="0.6" />
      <rect x={sx - 1.6} y={top} width="3.2" height={H} rx="1" fill="#6f7f90" />
      <rect x={sx - 5} y={sy - 3} width="10" height="3" rx="1" fill="#8a97a5" />
      {/* L1: wind vane on top */}
      <g transform={`translate(${sx} ${top - 1})`}>
        <motion.g animate={{ rotate: [-14, 10, -14] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
          <path d="M-9 0 H9" stroke="#38485a" strokeWidth="1.3" />
          <path d="M9 0 l-3.5 -2.6 v5.2 Z" fill="#38485a" />
          <path d="M-9 0 l-3 -3.4 h4 l2 3.4 l-2 3.4 h-4 Z" fill="#e63946" />
        </motion.g>
        <circle r="1.6" fill="#38485a" />
      </g>
      {/* L2: anemometer on an arm */}
      {lv >= 2 && (
        <g>
          <path d={`M${sx} ${top + 12} H${sx + 13} V${top + 6}`} stroke="#6f7f90" strokeWidth="1.3" fill="none" />
          <g transform={`translate(${sx + 13} ${top + 5})`}>
            <g style={{ animation: 'spin 1.6s linear infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
              {[0, 120, 240].map(a => (
                <g key={a} transform={`rotate(${a})`}><path d="M0 0 H6" stroke="#38485a" strokeWidth="1" /><circle cx="6.6" cy="0" r="2" fill="#ffb020" /></g>
              ))}
            </g>
          </g>
        </g>
      )}
      {/* L3: Stevenson screen (thermometer box) */}
      {lv >= 3 && (
        <g>
          <path d={`M${sx - 24} ${sy} v-8 M${sx - 14} ${sy} v-8`} stroke="#7d8b99" strokeWidth="1.2" />
          <rect x={sx - 26} y={sy - 19} width="14" height="11" rx="1" fill="#ffffff" stroke="#b8c3cf" strokeWidth="0.7" />
          <path d={`M${sx - 24} ${sy - 16} h10 M${sx - 24} ${sy - 13.5} h10 M${sx - 24} ${sy - 11} h10`} stroke="#c9d2dc" strokeWidth="0.8" />
          <path d={`M${sx - 27} ${sy - 19} L${sx - 19} ${sy - 23} L${sx - 11} ${sy - 19} Z`} fill="#e9eef3" />
        </g>
      )}
      {/* L4: rain gauge */}
      {lv >= 4 && (
        <g>
          <rect x={sx + 11} y={sy - 10} width="6" height="10" rx="1" fill="#5aa9e6" />
          <path d={`M${sx + 9} ${sy - 13} h10 l-2 3 h-6 Z`} fill="#3f86c4" />
          <rect x={sx + 12} y={sy - 6} width="4" height="5" fill="#bfe3ff" opacity="0.8" />
        </g>
      )}
      {/* L5: dish + beacon */}
      {lv >= 5 && (
        <g>
          <path d={`M${sx} ${top + 22} h-6`} stroke="#6f7f90" strokeWidth="1.3" />
          <g transform={`translate(${sx - 10} ${top + 22}) rotate(-28)`}>
            <path d="M-7 0 A7 7 0 0 0 7 0 Z" fill="#eef2f6" stroke="#9aa7b4" strokeWidth="0.8" />
            <path d="M0 0 V-6" stroke="#6f7f90" strokeWidth="0.9" />
            <circle cx="0" cy="-6.5" r="1.3" fill="#6f7f90" />
          </g>
          <circle cx={sx} cy={top - 5} r="1.8" fill="#ff4d4d" style={{ animation: 'glow 1.4s infinite' }} />
        </g>
      )}
    </g>
  )
}

/* ───────────────────────── Stream + bridge ───────────────────────── */
export function Stream() {
  return (
    <g>
      <path d="M244 166 Q238 196 254 222 Q274 258 278 300 L346 300 Q332 252 304 220 Q278 192 258 166 Z" fill="#7cc4ef" />
      <path d="M244 166 Q238 196 254 222 Q274 258 278 300" stroke="#c9b27f" strokeWidth="2" fill="none" opacity="0.55" />
      <path d="M346 300 Q332 252 304 220 Q278 192 258 166" stroke="#c9b27f" strokeWidth="2" fill="none" opacity="0.55" />
      <g stroke="#e6f6ff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeDasharray="7 11" style={{ animation: 'vlgFlow 2.4s linear infinite' }}>
        <path d="M251 172 Q250 200 266 226 Q288 260 296 300" />
        <path d="M256 186 Q262 210 284 232 Q306 262 318 300" opacity="0.7" />
      </g>
    </g>
  )
}

export function BridgePlace({ planks }: { planks: number }) {
  const n = Math.min(BRIDGE_MAX, Math.max(0, planks))
  const x0 = 264
  const x1 = 338
  const yB = 258
  const pos = (i: number) => {
    const t = (i + 0.5) / BRIDGE_MAX
    return { x: x0 + t * (x1 - x0), y: yB - Math.sin(t * Math.PI) * 7 }
  }
  const done = n >= BRIDGE_MAX
  return (
    <g>
      {/* abutments */}
      <path d={`M${x0 - 10} ${yB + 9} h14 l-2 -12 h-10 Z`} fill="#b9aa90" />
      <path d={`M${x1 - 4} ${yB + 9} h14 l-2 -12 h-10 Z`} fill="#b9aa90" />
      {/* ghost planks — the rest of the crossing */}
      {Array.from({ length: BRIDGE_MAX - n }).map((_, k) => {
        const p = pos(n + k)
        return <rect key={'g' + k} x={p.x - 1.6} y={p.y - 3} width="3.2" height="6" rx="0.6" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.9)" strokeWidth="0.5" strokeDasharray="1.2 1" />
      })}
      {/* planks: one per check before a purchase */}
      {Array.from({ length: n }).map((_, i) => {
        const p = pos(i)
        return (
          <motion.rect key={i} x={p.x - 1.7} y={p.y - 3} width="3.4" height="6" rx="0.6" fill={i % 2 ? '#a8713f' : '#c08552'} stroke="#7a4e2d" strokeWidth="0.4" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 + i * 0.035 }} />
        )
      })}
      {/* posts + ropes */}
      {[x0 - 2, x1 + 2].map(x => <rect key={x} x={x - 1.4} y={yB - 15} width="2.8" height="16" rx="1" fill="#6b4a2b" />)}
      <path d={`M${x0 - 2} ${yB - 14} Q${(x0 + x1) / 2} ${yB - 14} ${x1 + 2} ${yB - 14}`} stroke="#8a6a48" strokeWidth="1.1" fill="none" />
      <path d={`M${x0 - 2} ${yB - 8} Q${(x0 + x1) / 2} ${yB - 12} ${x1 + 2} ${yB - 8}`} stroke="#8a6a48" strokeWidth="0.8" fill="none" opacity="0.8" />
      {done && (
        <g>
          {[x0 - 2, x1 + 2].map(x => (
            <g key={'l' + x}>
              <circle cx={x} cy={yB - 17.5} r="6" fill="#ffd166" opacity="0.2" />
              <circle cx={x} cy={yB - 17.5} r="2.6" fill="#ffd166" style={{ animation: 'glow 2s infinite' }} />
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

/** keyframes used only by the village; injected once by the scene */
export const VILLAGE_KEYFRAMES = `
@keyframes vlgFlow { to { stroke-dashoffset: -36; } }
@keyframes vlgSmoke { 0% { transform: translateY(0) scale(0.5); opacity: 0.75; } 100% { transform: translateY(-18px) scale(1.5); opacity: 0; } }
@keyframes vlgSnow { from { transform: translateY(-10px); opacity: 0; } 15% { opacity: 0.9; } to { transform: translateY(300px); opacity: 0.2; } }
`
