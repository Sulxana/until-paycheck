import { RefObject } from 'react'
import { motion } from 'framer-motion'
import { WeatherKind, WEATHER_LABEL } from '../../engine/engine'
import { Jikho, JikhoMood, Accessory } from '../../components/Jikho'
import { WEMOJI } from '../../components/ui'
import { Confetti } from '../../components/day/parts'
import { fmt } from '../../engine/view'
import { Cycle, Mark } from '../cycle'

export const PX_PER_DAY = 150
export const FAR_TILE = 400
export const MID_TILE = 400
export const DASH_TILE = 50

const SKY: Record<WeatherKind, [string, string]> = {
  sun: ['#7cc7ff', '#e4f5ff'],
  cloud: ['#9fb8cf', '#e6eef5'],
  rain: ['#6a87a6', '#c3d1de'],
  storm: ['#36435a', '#7f8ea6'],
}

export interface Layers { world: RefObject<HTMLDivElement>; far: RefObject<HTMLDivElement>; mid: RefObject<HTMLDivElement>; dash: RefObject<HTMLDivElement> }

interface Props {
  c: Cycle
  layers: Layers
  marks: (Mark | null)[]
  /** open decision window: event index and the payday weather if it is taken */
  focus: { idx: number; now: WeatherKind; take: WeatherKind; hint: boolean } | null
  weather: WeatherKind
  calm: boolean
  reduced: boolean
  mood: JikhoMood
  walking: boolean
  hop: number
  hearts: number
  stage: 0 | 1 | 2 | 3
  accessories: Accessory[]
  arrived: boolean
}

const weatherLine = (now: WeatherKind, next: WeatherKind) => (now === next ? `ამინდი: ${WEMOJI[now]} უცვლელი` : `ამინდი: ${WEMOJI[now]} → ${WEMOJI[next]}`)

export function Scene({ c, layers, marks, focus, weather, calm, reduced, mood, walking, hop, hearts, stage, accessories, arrived }: Props) {
  const dark = weather === 'storm'
  const acc: Accessory[] = [...accessories]
  if ((weather === 'rain' || weather === 'storm') && !acc.includes('umbrella')) acc.push('umbrella')
  const tiles = (n: number) => Array.from({ length: n })

  return (
    <>
      {(Object.keys(SKY) as WeatherKind[]).map(k => (
        <div key={k} className="g-sky" style={{ background: `linear-gradient(180deg, ${SKY[k][0]}, ${SKY[k][1]})`, opacity: weather === k ? 1 : 0 }} />
      ))}

      {/* sun and clouds */}
      <svg viewBox="0 0 400 160" width="100%" style={{ position: 'absolute', top: 0, left: 0, height: '30%', pointerEvents: 'none' }} preserveAspectRatio="xMidYMin slice">
        <g style={{ opacity: weather === 'sun' ? 1 : weather === 'cloud' ? 0.55 : 0, transition: 'opacity 0.9s' }}>
          <g style={{ animation: reduced ? undefined : 'spin 40s linear infinite', transformOrigin: '330px 56px' }}>
            {Array.from({ length: 12 }).map((_, i) => <rect key={i} x="328" y="18" width="4" height="11" rx="2" fill="#ffd45c" transform={`rotate(${i * 30} 330 56)`} />)}
          </g>
          <circle cx="330" cy="56" r="22" fill="#ffd45c" />
        </g>
        <g style={{ opacity: weather === 'sun' ? 0 : 1, transition: 'opacity 0.9s' }}>
          {[{ x: 70, y: 50, s: 1.1, d: 9 }, { x: 210, y: 34, s: 1.4, d: 12 }, { x: 320, y: 70, s: 0.9, d: 10 }].map((cl, i) => (
            <g key={i} style={{ animation: reduced ? undefined : `drift ${cl.d}s ease-in-out ${i}s infinite alternate` }}>
              <g transform={`translate(${cl.x} ${cl.y}) scale(${cl.s})`} fill={dark ? '#5a667c' : weather === 'rain' ? '#a9b6c4' : '#ffffff'}>
                <ellipse cx="0" cy="0" rx="34" ry="14" /><ellipse cx="-14" cy="-8" rx="16" ry="13" /><ellipse cx="10" cy="-12" rx="18" ry="16" />
              </g>
            </g>
          ))}
        </g>
      </svg>

      {/* far Caucasus range */}
      <div ref={layers.far} className="g-layer" style={{ bottom: '30%', height: '34%' }}>
        {tiles(3).map((_, i) => (
          <svg key={i} viewBox="0 0 400 160" width={FAR_TILE} height="100%" preserveAspectRatio="none" style={{ flexShrink: 0, display: 'block' }}>
            <path d="M0 120 L40 70 L70 95 L118 40 L160 92 L196 60 L240 105 L286 50 L330 98 L366 66 L400 120 L400 160 L0 160 Z" fill={dark ? '#56647b' : '#a9c4dc'} />
            <path d="M118 40 L106 56 L116 54 L124 60 L130 52 Z M286 50 L274 66 L284 64 L292 70 L298 62 Z M196 60 L188 70 L198 68 L204 72 L208 66 Z M40 70 L33 80 L42 78 L48 82 Z" fill="#fff" opacity={dark ? 0.6 : 0.95} />
          </svg>
        ))}
      </div>
      {/* near hills */}
      <div ref={layers.mid} className="g-layer" style={{ bottom: '24%', height: '20%' }}>
        {tiles(3).map((_, i) => (
          <svg key={i} viewBox="0 0 400 100" width={MID_TILE} height="100%" preserveAspectRatio="none" style={{ flexShrink: 0, display: 'block' }}>
            <path d="M0 60 Q50 20 100 45 T200 40 T300 35 T400 60 L400 100 L0 100 Z" fill={dark ? '#4c6a58' : '#8fc49a'} />
            {[40, 64, 230, 252, 350].map((x, k) => (
              <g key={k} transform={`translate(${x} ${k % 2 ? 44 : 40})`}>
                <path d="M0 -20 L8 0 L-8 0 Z" fill={dark ? '#2f4a3a' : '#3f8a52'} /><path d="M0 -27 L6 -11 L-6 -11 Z" fill={dark ? '#355341' : '#4d9a5f'} />
              </g>
            ))}
          </svg>
        ))}
      </div>
      {/* meadow and path */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '28%', background: dark ? 'linear-gradient(180deg,#47664f,#3a5442)' : 'linear-gradient(180deg,#9fd39c,#7fc07f)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '17%', height: '9%', background: dark ? '#a39581' : '#f3e4c8', borderTop: `3px solid ${dark ? '#8e8170' : '#e7d3b0'}`, borderBottom: `3px solid ${dark ? '#8e8170' : '#e7d3b0'}`, overflow: 'hidden' }}>
        <div ref={layers.dash} style={{ position: 'absolute', left: 0, top: '50%', marginTop: -2, height: 4, width: '200%', background: `repeating-linear-gradient(90deg, transparent 0 30px, rgba(255,255,255,0.7) 30px ${DASH_TILE}px)`, willChange: 'transform' }} />
      </div>

      {/* the road: bills, temptations, joys, unexpected costs, dilemmas, payday arch */}
      <div ref={layers.world} className="g-world">
        {c.events.map((ev, i) => {
          const left = ev.at * PX_PER_DAY
          const m = marks[i]
          if (ev.kind === 'bill') {
            // several bills on one day: stagger the lintels so none hides another
            const k = c.events.slice(0, i).filter(e => e.kind === 'bill' && Math.floor(e.at) === Math.floor(ev.at)).length
            return (
              <div key={i} className="g-gate" style={{ left, top: `calc(30% + ${k * 50}px)`, bottom: '16%' }}>
                <div className="lintel">
                  <div className="n">{ev.label}</div>
                  <div className="a">{ev.icon} {ev.range ? `~${fmt(ev.nominal)}` : fmt(ev.amount)} ₾</div>
                  {m === 'paid' && <div className="g-stamp">გადახდილია ✓<br />{fmt(ev.amount)} ₾</div>}
                </div>
                <div className="posts"><span /><span /></div>
              </div>
            )
          }
          if (ev.kind === 'temptation' || ev.kind === 'joy') {
            const f = focus && focus.idx === i ? focus : null
            return (
              <div key={i} id={`g-ev-${i}`} className={'g-ev' + (m === 'taken' ? ' taken' : m === 'passed' ? ' passed' : '')} style={{ left, bottom: '17%', zIndex: f ? 3 : 1 }}>
                {f && (
                  <div className="g-bubble">
                    <span>{ev.icon} {ev.label}</span>
                    {ev.kind === 'temptation' ? <span className="s">{fmt(ev.price)} ₾ · {weatherLine(f.now, f.take)}</span> : <span className="s">0 ₾</span>}
                    {f.hint && <span className="h">შეეხე, თუ გინდა</span>}
                  </div>
                )}
                <div className={ev.kind === 'joy' ? 'g-joy' : 'g-item'}>{ev.icon}</div>
                <div className={'g-tag' + (ev.kind === 'joy' ? ' free' : '')}>{ev.kind === 'joy' ? '0 ₾' : `${fmt(ev.price)} ₾`}</div>
              </div>
            )
          }
          if (ev.kind === 'oneoff') {
            if (m !== 'hit') return null
            return (
              <motion.div key={i} className="g-ev" style={{ left, bottom: '17%' }} initial={reduced ? false : { y: -160, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 14 }}>
                <div className="g-item" style={{ background: '#fff4dc' }}>{ev.icon}</div>
                <div className="g-tag" style={{ background: '#8a6a48' }}>{fmt(ev.amount)} ₾</div>
              </motion.div>
            )
          }
          return (
            <div key={i} className="g-post" style={{ left, bottom: '17%' }}>
              <div className="sign">{ev.icon} {m === 'chosen' ? '✓' : '?'}</div>
              <div className="pole" />
            </div>
          )
        })}
        <div className="g-arch" style={{ left: c.nDays * PX_PER_DAY, top: '24%', bottom: '16%' }}>
          <div className="top"><span className={'bell' + (arrived ? ' ring' : '')}>🔔</span><div>ხელფასი · {c.paydayLabel}</div></div>
          <div className="posts"><span /><span /></div>
        </div>
      </div>

      {/* weather effects */}
      {(weather === 'rain' || weather === 'storm') && !reduced && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: weather === 'storm' ? 40 : 24 }).map((_, i) => (
            <span key={i} className="g-rain" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${((i * 53) % 100) / 100}s`, animationDuration: `${0.75 + (i % 5) * 0.08}s` }} />
          ))}
        </div>
      )}
      {weather === 'storm' && !calm && !reduced && (
        <svg viewBox="0 0 400 300" width="100%" height="60%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} preserveAspectRatio="xMidYMin slice">
          <path d="M230 30 L214 80 L230 78 L216 124 L248 66 L232 68 L244 30 Z" fill="#ffe27a" style={{ animation: 'flash 3.2s infinite' }} />
        </svg>
      )}

      {/* Jikho */}
      <div className="g-jikho">
        <motion.div key={hop} animate={hop && !reduced ? { y: [0, -30, 0] } : undefined} transition={{ duration: 0.5, ease: 'easeOut' }}>
          <Jikho size={84} mood={mood} stage={stage} accessories={acc} walking={walking} />
        </motion.div>
      </div>
      {hearts > 0 && !reduced && (
        <div key={hearts} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {[0, 1, 2].map(k => (
            <motion.span key={k} className="g-heart" initial={{ x: -10 + k * 16, y: 0, opacity: 1, scale: 0.6 }} animate={{ y: -90 - k * 14, opacity: 0, scale: 1.1 }} transition={{ duration: 1.1, delay: k * 0.12, ease: 'easeOut' }}>❤️</motion.span>
          ))}
        </div>
      )}
      {arrived && !reduced && <Confetti n={calm ? 14 : 28} />}

      <div className="g-chip">ხელფასის დღე: {WEMOJI[weather]} {WEATHER_LABEL[weather]}</div>
    </>
  )
}
