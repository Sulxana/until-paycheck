import { useEffect, useRef, useState, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Game } from '../../state/store'
import { Jikho } from '../Jikho'
import {
  PlaceId, PLACE_HIT, TowerPlace, SchoolPlace, CellarPlace, StationPlace, BridgePlace, Stream, VILLAGE_KEYFRAMES,
  TOWER_MAX, BRIDGE_MAX, STATION_MAX, jarPct,
} from './Places'

const VW = 390
const VH = 300

interface Props {
  game: Game
  stage: 0 | 1 | 2 | 3
  hardship: boolean
  tips: string[]
  onOpen: (p: PlaceId) => void
}

export const PLACE_ICON: Record<PlaceId, string> = { tower: '🗼', school: '🏫', cellar: '🏺', station: '📡', bridge: '🌉' }

export function placeBadge(id: PlaceId, g: Game): string {
  switch (id) {
    case 'tower': return `კოშკი ${Math.min(TOWER_MAX, g.stones)}/${TOWER_MAX}`
    case 'school': return `სკოლა · ${g.books} წიგნი`
    case 'cellar': {
      const q = g.qvevri[0]
      if (!q) return 'მარანი'
      return q.sealedAt ? 'მარანი · დალუქული' : `მარანი ${Math.round(jarPct(q) * 100)}%`
    }
    case 'station': return `სადგური ${Math.min(STATION_MAX, g.station)}/${STATION_MAX}`
    case 'bridge': return `ხიდი ${Math.min(BRIDGE_MAX, g.planks)}/${BRIDGE_MAX}`
  }
}

/** label pill positions (scene coords) — kept apart from each other and from Jikho */
const PILLS: { id: PlaceId; x: number; y: number; anchor: 'left' | 'center' | 'right' }[] = [
  { id: 'tower', x: 8, y: 58, anchor: 'left' },
  { id: 'school', x: 100, y: 146, anchor: 'center' },
  { id: 'cellar', x: 190, y: 258, anchor: 'center' },
  { id: 'station', x: 384, y: 138, anchor: 'right' },
  { id: 'bridge', x: 304, y: 284, anchor: 'center' },
]

const SNOW = Array.from({ length: 26 }, (_, i) => ({ x: (i * 47 + 13) % VW, r: 1 + (i % 3) * 0.6, d: 5 + (i % 5) * 1.3, delay: -((i * 0.83) % 7) }))

export function VillageScene({ game, stage, hardship, tips, onOpen }: Props) {
  const [hop, setHop] = useState(false)
  const [tipIdx, setTipIdx] = useState<number | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const pokeJikho = () => {
    setHop(true)
    setTipIdx(i => (i === null ? 0 : (i + 1) % Math.max(1, tips.length)))
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { setHop(false); setTipIdx(null) }, 3600)
  }

  const skyTop = hardship ? '#a7c0d6' : '#86cdfb'
  const skyBottom = hardship ? '#eef3f8' : '#e8f7ff'

  const place = (id: PlaceId, children: ReactNode) => {
    const [x, y, w, h] = PLACE_HIT[id]
    return (
      <motion.g
        key={id}
        onClick={() => onOpen(id)}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
        style={{ cursor: 'pointer', originY: 1 }}
      >
        {children}
        <rect x={x} y={y} width={w} height={h} fill="transparent" />
      </motion.g>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}`, overflow: 'hidden' }}>
      <style>{VILLAGE_KEYFRAMES}</style>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0, display: 'block' }} role="img" aria-label="ჯიხოს სოფელი">
        <defs>
          <linearGradient id="vlg-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skyTop} />
            <stop offset="100%" stopColor={skyBottom} />
          </linearGradient>
          <linearGradient id="vlg-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a9c4dc" /><stop offset="100%" stopColor="#cddfee" /></linearGradient>
          <linearGradient id="vlg-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={hardship ? '#a9c9b0' : '#8fc49a'} /><stop offset="100%" stopColor={hardship ? '#94b89b' : '#75b07f'} /></linearGradient>
          <linearGradient id="vlg-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={hardship ? '#b9d8b8' : '#a3d69f'} /><stop offset="100%" stopColor={hardship ? '#a3c6a3' : '#82c382'} /></linearGradient>
        </defs>

        <rect width={VW} height={VH} fill="url(#vlg-sky)" />

        {/* sun */}
        <g opacity={hardship ? 0.55 : 1}>
          <g style={{ animation: 'spin 50s linear infinite', transformOrigin: '262px 40px' }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={i} x="260.5" y="10" width="3" height="9" rx="1.5" fill="#ffd45c" transform={`rotate(${i * 36} 262 40)`} />
            ))}
          </g>
          <circle cx="262" cy="40" r="26" fill="#ffd45c" opacity="0.18" />
          <circle cx="262" cy="40" r="17" fill="#ffd45c" />
        </g>

        {/* snowy Caucasus */}
        <path d="M0 150 L40 96 L74 126 L122 70 L168 118 L208 86 L250 130 L296 80 L342 122 L390 94 L390 300 L0 300 Z" fill="url(#vlg-far)" />
        <path d="M122 70 L110 86 L120 84 L128 90 L134 82 Z M296 80 L284 96 L294 94 L302 100 L308 92 Z M40 96 L32 106 L42 104 L48 108 Z M208 86 L199 98 L208 96 L214 100 Z M390 94 L378 106 L388 104 L390 105 Z" fill="#fff" opacity="0.95" />

        {/* drifting clouds */}
        {[{ x: 90, y: 34, s: 0.9, d: 11 }, { x: 196, y: 60, s: 0.7, d: 14 }].map((c, i) => (
          <g key={i} style={{ animation: `drift ${c.d}s ease-in-out ${i * 2}s infinite alternate` }}>
            <g transform={`translate(${c.x} ${c.y}) scale(${c.s})`} fill="#ffffff" opacity="0.92">
              <ellipse cx="0" cy="0" rx="30" ry="11" />
              <ellipse cx="-12" cy="-7" rx="14" ry="11" />
              <ellipse cx="9" cy="-10" rx="15" ry="13" />
            </g>
          </g>
        ))}

        {/* mid hill with the station knoll */}
        <path d="M0 182 Q50 160 110 172 Q170 184 230 172 Q290 116 340 118 Q372 120 390 128 L390 300 L0 300 Z" fill="url(#vlg-mid)" />
        {[[64, 180], [228, 176], [380, 214], [368, 218], [8, 186]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0 -20 L8 0 L-8 0 Z" fill="#3f8a52" />
            <path d="M0 -27 L6.5 -11 L-6.5 -11 Z" fill="#4d9a5f" />
            <rect x="-1.4" y="0" width="2.8" height="4" fill="#7a5230" />
          </g>
        ))}

        {/* near meadow */}
        <path d="M0 222 Q90 206 180 218 Q240 226 290 214 Q340 204 390 210 L390 300 L0 300 Z" fill="url(#vlg-near)" />
        {/* footpath to the cellar */}
        <path d="M118 300 C132 268 176 252 190 214" stroke="#ead9b8" strokeWidth="11" fill="none" strokeLinecap="round" />
        <path d="M118 300 C132 268 176 252 190 214" stroke="#f3e6cc" strokeWidth="6" fill="none" strokeLinecap="round" />
        {/* meadow flowers */}
        {[[22, 252, '#ff7aa2'], [150, 288, '#ffd166'], [236, 276, '#ffffff'], [368, 252, '#ff9f68'], [372, 288, '#8ed1fc'], [96, 262, '#ffd166'], [218, 252, '#ff7aa2']].map(([x, y, c], i) => (
          <g key={i}>
            <circle cx={x as number} cy={y as number} r="2.2" fill={c as string} />
            <circle cx={(x as number) + 5} cy={(y as number) + 3} r="1.6" fill={c as string} opacity="0.85" />
          </g>
        ))}

        <Stream />

        {place('station', <StationPlace level={game.station} />)}
        {place('tower', <TowerPlace stones={game.stones} />)}
        {place('school', <SchoolPlace books={game.books} topics={game.topics} />)}
        {place('cellar', <CellarPlace qvevri={game.qvevri} />)}
        {place('bridge', <BridgePlace planks={game.planks} />)}

        {/* hardship: calm snowfall, nothing breaks */}
        {hardship && (
          <g fill="#ffffff" pointerEvents="none">
            {SNOW.map((s, i) => (
              <circle key={i} cx={s.x} cy={0} r={s.r} style={{ animation: `vlgSnow ${s.d}s linear ${s.delay}s infinite` }} />
            ))}
          </g>
        )}
      </svg>

      {/* label pills: real buttons for touch + screen readers */}
      {PILLS.map((p, i) => (
        <motion.button
          key={p.id}
          className="chip"
          onClick={() => onOpen(p.id)}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 14, delay: 0.5 + i * 0.08 }}
          whileTap={{ scale: 0.9 }}
          style={{
            position: 'absolute',
            left: `${(p.x / VW) * 100}%`,
            top: `${(p.y / VH) * 100}%`,
            x: p.anchor === 'center' ? '-50%' : p.anchor === 'right' ? '-100%' : '0%',
            y: '-50%',
            background: 'rgba(255,255,255,0.93)',
            boxShadow: 'var(--shadow-sm)',
            padding: '4px 9px',
            gap: 4,
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--navy)',
            zIndex: 2,
          }}
        >
          <span aria-hidden>{PLACE_ICON[p.id]}</span>
          {placeBadge(p.id, game)}
        </motion.button>
      ))}

      {/* Jikho, idling in the meadow */}
      <div style={{ position: 'absolute', left: `${(54 / VW) * 100}%`, top: `${(294 / VH) * 100}%`, transform: 'translate(-50%, -88%)', zIndex: 3 }}>
        <AnimatePresence>
          {tipIdx !== null && tips.length > 0 && (
            <motion.div
              key={tipIdx}
              initial={{ opacity: 0, y: 8, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ type: 'spring', damping: 16 }}
              style={{ position: 'absolute', bottom: '92%', left: 30, width: 180, background: '#fff', borderRadius: 14, borderBottomLeftRadius: 4, padding: '8px 10px', fontSize: 12, fontWeight: 600, lineHeight: 1.4, boxShadow: 'var(--shadow)', color: 'var(--ink)' }}
            >
              {tips[tipIdx % tips.length]}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          key={game.equipped.join('|')}
          onClick={pokeJikho}
          aria-label="ჯიხო — შეეხე მინიშნებისთვის"
          initial={{ scale: 0.85 }}
          animate={hop ? { scale: 1, y: [0, -14, 0] } : { scale: 1, y: 0 }}
          transition={hop ? { duration: 0.5 } : { type: 'spring', damping: 10 }}
          style={{ display: 'block', padding: 0 }}
        >
          <Jikho size={76} mood={hop ? 'celebrate' : hardship ? 'calm' : 'happy'} stage={stage} accessories={game.equipped} />
        </motion.button>
      </div>
    </div>
  )
}
