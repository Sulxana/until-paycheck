import { memo } from 'react'
import { fmt } from '../../engine/view'
import { Month, Run, ForkInst, OptInst, FORK_LEN, LANE_DY, hillAt, laneProfile, laneSign, locked } from '../sim'

export const WIN = 300
export const JOY_Y = 128
const MEADOW_TOP = 165

interface Props {
  m: Month
  r: Run
  /** bumps whenever the run changes in a way the road shows (choices, scams, joys, bills) */
  ver: number
  win: number
  baseY: number
  H: number
  pend: { i: number; preview: 0 | 1 | null } | null
  waiting: boolean
  onHover: (side: 0 | 1 | null) => void
}

const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s) }

/** the road for the part of the month near the screen: meadow, lanes, signs, scams, joys, the rent gate, the payday arch */
export const World = memo(function World({ m, r, win, baseY, H, pend, waiting, onHover }: Props) {
  const x0 = win * WIN - 420, x1 = win * WIN + 1320
  const ry = (x: number) => baseY - hillAt(m, x)
  const X = (x: number) => (x - x0).toFixed(1)
  const line = (a: number, b: number) => {
    let d = `M${X(a)} ${ry(a).toFixed(1)}`
    for (let x = a + 16; x < b; x += 16) d += ` L${X(x)} ${ry(x).toFixed(1)}`
    return d + ` L${X(b)} ${ry(b).toFixed(1)}`
  }
  const branch = (f: ForkInst, side: 0 | 1) => {
    const y = (u: number) => (ry(f.x + u) + laneSign(side) * LANE_DY * laneProfile(u)).toFixed(1)
    let d = `M${X(f.x)} ${y(0)}`
    for (let u = 10; u < FORK_LEN; u += 10) d += ` L${X(f.x + u)} ${y(u)}`
    return d + ` L${X(f.x + FORK_LEN)} ${y(FORK_LEN)}`
  }

  // meadow edge, a little uneven
  let meadow = `M0 ${H + 400}`
  for (let x = x0; x <= x1; x += 24) meadow += ` L${X(x)} ${(ry(x) - MEADOW_TOP + 7 * Math.sin(x / 83) + 4 * Math.sin(x / 37)).toFixed(1)}`
  meadow += ` L${X(x1)} ${H + 400} Z`

  const tufts: JSX.Element[] = []
  for (let x = Math.ceil(x0 / 47) * 47; x < x1; x += 47) {
    const h = hash(x), y = ry(x) - 140 + hash(x + 7) * (H - baseY + 120)
    if (h < 0.55) tufts.push(<path key={x} d={`M${X(x)} ${y.toFixed(1)} q2 -8 4 0 q2 -11 4 0 q2 -7 4 0`} className="f-tuft" />)
    else if (h < 0.7) tufts.push(<circle key={x} cx={X(x)} cy={y.toFixed(1)} r="2.6" fill={['#ff9fb6', '#ffd166', '#ffffff', '#c7a6ff'][Math.floor(hash(x + 3) * 4)]} />)
  }

  type Seg = { d: string; cls: string }
  const segs: Seg[] = []
  const islands: JSX.Element[] = []
  let cur = x0
  for (const f of m.forks) {
    if (f.x + FORK_LEN < x0) continue
    if (f.x > x1) break
    if (f.x > cur) segs.push({ d: line(cur, f.x), cls: '' })
    const ch = r.choice[f.i]
    for (const side of [0, 1] as const) {
      const cls = ch !== undefined ? (ch === side ? ' on' : ' off') : pend?.i === f.i && pend.preview === side ? ' pv' : ''
      segs.push({ d: branch(f, side), cls })
    }
    const ix = f.x + FORK_LEN / 2
    islands.push(
      <g key={f.i} transform={`translate(${X(ix)} ${ry(ix).toFixed(1)})`}>
        <ellipse cx="0" cy="18" rx="44" ry="8" fill="rgba(0,0,0,0.08)" />
        <circle cx="-18" cy="4" r="16" fill="#5fa868" /><circle cx="12" cy="0" r="20" fill="#6fb877" /><circle cx="-2" cy="-14" r="15" fill="#7cc483" />
        <circle cx="6" cy="-6" r="2.4" fill="#ff9fb6" /><circle cx="-14" cy="0" r="2.2" fill="#ffd166" />
      </g>,
    )
    cur = Math.max(cur, f.x + FORK_LEN)
  }
  if (cur < x1) segs.push({ d: line(cur, x1), cls: '' })

  const forks = m.forks.filter(f => f.x > x0 - 200 && f.x < x1 + 100)
  const items = m.items.map((it, i) => ({ it, i })).filter(({ it }) => it.x > x0 - 100 && it.x < x1 + 100)
  const rentPaid = r.day >= 21 && !r.failed
  const showGate = m.rentX > x0 - 200 && m.rentX < x1 + 200
  const showArch = m.length < x1 + 300
  const rentBills = m.bills.filter(b => b.rent)

  return (
    <>
      <svg className="f-road" style={{ left: x0, width: x1 - x0, height: H + 400 }} aria-hidden="true">
        <defs>
          <linearGradient id="f-meadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a9da9d" /><stop offset="0.45" stopColor="#8fcb88" /><stop offset="1" stopColor="#74b56f" />
          </linearGradient>
        </defs>
        <path d={meadow} fill="url(#f-meadow)" />
        {tufts}
        {segs.map((s, k) => <path key={'e' + k} d={s.d} className={'f-edge' + s.cls} />)}
        {segs.map((s, k) => <path key={'s' + k} d={s.d} className={'f-surf' + s.cls} />)}
        {segs.map((s, k) => <path key={'d' + k} d={s.d} className={'f-dash' + s.cls} />)}
        {islands}
      </svg>

      {showGate && (
        <div className="f-gate" style={{ left: m.rentX, top: ry(m.rentX) }}>
          <div className="lintel">
            <b>{m.days[21].label}</b>
            <span>{rentBills.map(b => `${b.icon} ${b.label} ${fmt(b.amount)} ₾`).join(' · ')}</span>
            {rentPaid && <div className="f-stamp">გადახდილია ✓</div>}
          </div>
          <div className="posts"><i /><i /></div>
        </div>
      )}
      {showArch && (
        <div className="f-arch" style={{ left: m.length, top: ry(m.length) }}>
          <div className="top"><span className={'bell' + (r.arrived ? ' ring' : '')}>🔔</span> ხელფასი · {m.days[30].label}</div>
          <div className="posts"><i /><i /></div>
        </div>
      )}

      {items.map(({ it, i }) => {
        const st = r.item[i] ?? ''
        if (it.kind === 'scam') {
          return (
            <div key={'i' + i} className={'f-scam ' + st} style={{ left: it.x, top: ry(it.x) }}>
              <div className="bubble"><span className="ic">{it.def.e}</span><span>{it.def.sign}</span>{st === 'hit' && <b className="cost">−{fmt(it.def.p)} ₾</b>}</div>
              <div className="trap"><span>{it.def.e}</span></div>
            </div>
          )
        }
        return (
          <div key={'i' + i} className={'f-joy ' + st} style={{ left: it.x, top: ry(it.x) - JOY_Y }}>
            <span>{it.def.e}</span>
          </div>
        )
      })}

      {forks.map(f => {
        const ch = r.choice[f.i]
        const isPend = pend?.i === f.i
        return (
          <div key={'f' + f.i} className={'f-signs' + (isPend && waiting ? ' waiting' : '')} style={{ left: f.x - 10, top: ry(f.x) }}>
            {([0, 1] as const).map(side => (
              <Sign key={side} o={f.opts[side]} side={side} m={m}
                state={ch !== undefined ? (ch === side ? 'on' : 'off') : isPend && pend!.preview === side ? 'pv' : ''}
                lock={ch === undefined && locked(m, r, f.i, side)}
                onHover={isPend ? onHover : undefined} />
            ))}
          </div>
        )
      })}
    </>
  )
})

function Sign({ o, side, m, state, lock, onHover }: { o: OptInst; side: 0 | 1; m: Month; state: string; lock: boolean; onHover?: (s: 0 | 1 | null) => void }) {
  const en = o.en > 0 ? <span className="en pos">⚡+{o.en}</span> : o.en < 0 ? <span className="en neg">⚡−{-o.en}</span> : null
  return (
    <div className={`f-sign ${side ? 'down' : 'up'} ${state}${lock ? ' lock' : ''}`} data-side={side}
      onPointerEnter={e => { if (e.pointerType === 'mouse' && onHover) onHover(side) }}
      onPointerLeave={e => { if (e.pointerType === 'mouse' && onHover) onHover(null) }}>
      <div className="row"><span className="ic">{o.e}</span><span className="t">{o.t}</span></div>
      <div className="meta">
        {lock ? <span className="lk">🔒 ანგარიშზე არ არის</span> : <><b>{fmt(o.p)} ₾</b>{en}{o.back && o.backDay < 30 && <span className="bk">↩ {m.days[o.backDay].label}</span>}</>}
      </div>
      {state === 'on' && <span className="ok">✓</span>}
      <span className="arr">{side ? '↘' : '↗'}</span>
    </div>
  )
}
