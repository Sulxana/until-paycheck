import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import './game.css'
import { usePersona, fmt } from '../engine/view'
import { useStore, evolutionStage } from '../state/store'
import { WeatherKind } from '../engine/engine'
import { JikhoMood } from '../components/Jikho'
import {
  buildCycle, newRun, advance, takeEvent, chooseOption, windowEvent, nextEventAt, forecast, wallet as walletOf,
  DEFAULT_SEED, WINDOW_SPEED, Run, Mark, Forecast, Fired, GameEvent,
} from './cycle'
import { useGameLoop, useHidden } from './useGameLoop'
import { Scene, PX_PER_DAY, FAR_TILE, MID_TILE, DASH_TILE, Layers } from './parts/Scene'
import { TopBar, BottomHud } from './parts/Hud'
import { QvevriCard, DilemmaCard } from './parts/Cards'
import { Finish } from './parts/Finish'

type Phase = 'qvevri' | 'run' | 'dilemma' | 'arrive' | 'end'
interface Props { onExit: () => void; onCheck: () => void; onTalk: () => void }

/** "გზა ხელფასამდე": the selected persona's month, payday to payday. "თავიდან" plays another possible month. */
export function GameScreen(props: Props) {
  const [round, setRound] = useState(0)
  return <GameRun key={round} round={round} onRestart={() => setRound(n => n + 1)} {...props} />
}

function GameRun({ round, onRestart, onExit, onCheck, onTalk }: Props & { round: number; onRestart: () => void }) {
  const p = usePersona()
  const calm = p.id === 'tamar'
  const reduced = !!useReducedMotion()
  const game = useStore(s => s.games[p.id])
  const stage = evolutionStage(game)
  const c = useMemo(() => buildCycle(p, DEFAULT_SEED[p.id] + (round ? 1000 + round : 0)), [p, round])
  const runRef = useRef<Run | null>(null)
  if (!runRef.current) runRef.current = newRun(c, 0)
  const r = runRef.current

  const [phase, setPhase] = useState<Phase>('qvevri')
  const [paused, setPaused] = useState(false)
  const [hud, setHud] = useState({ wallet: walletOf(c, r), qvevri: 0, joy: 0, day: 0 })
  const [marks, setMarks] = useState<(Mark | null)[]>(() => r.marks.slice())
  const [fc, setFc] = useState<Forecast>(() => forecast(c, r))
  const [focus, setFocus] = useState<{ idx: number; now: WeatherKind; take: WeatherKind; hint: boolean } | null>(null)
  const [dilemma, setDilemma] = useState<{ idx: number; now: WeatherKind; weathers: WeatherKind[] } | null>(null)
  const [banner, setBanner] = useState<{ n: number; title: string; line: string } | null>(null)
  const [flows, setFlows] = useState<{ id: number; text: string; x0: number; y0: number; x1: number; y1: number }[]>([])
  const [pulse, setPulse] = useState<{ kind: 'glow' | 'shake'; n: number } | null>(null)
  const [jarOpen, setJarOpen] = useState(0)
  const [hop, setHop] = useState(0)
  const [hearts, setHearts] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const layers: Layers = { world: useRef<HTMLDivElement>(null), far: useRef<HTMLDivElement>(null), mid: useRef<HTMLDivElement>(null), dash: useRef<HTMLDivElement>(null) }
  const fcRef = useRef(fc)
  fcRef.current = fc
  const speed = useRef(1 / c.secPerDay)
  const focusIdx = useRef(-1)
  const hintsLeft = useRef(2)
  const hudAcc = useRef(0)
  const seq = useRef(1)
  /** set when a card opens or payday is reached, so a frame already queued does not move Jikho on */
  const halt = useRef(false)
  const timers = useRef<number[]>([])
  const later = (f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)) }
  useEffect(() => () => timers.current.forEach(t => clearTimeout(t)), [])

  const syncHud = () => setHud({ wallet: walletOf(c, r), qvevri: r.qvevri, joy: r.joy, day: Math.min(c.nDays - 1, Math.floor(r.x)) })
  const refresh = () => { setMarks(r.marks.slice()); const f = forecast(c, r); fcRef.current = f; setFc(f); syncHud() }

  /** the only per-frame work: transforms of the road and the parallax layers */
  const place = () => {
    const x = r.x * PX_PER_DAY
    const { world, far, mid, dash } = layers
    if (world.current) world.current.style.transform = `translate3d(${-x}px,0,0)`
    if (dash.current) dash.current.style.transform = `translate3d(${-(x % DASH_TILE)}px,0,0)`
    if (reduced) return
    if (far.current) far.current.style.transform = `translate3d(${-((x * 0.12) % FAR_TILE)}px,0,0)`
    if (mid.current) mid.current.style.transform = `translate3d(${-((x * 0.4) % MID_TILE)}px,0,0)`
  }
  useLayoutEffect(place, [])

  /** the price of a temptation walked past flows into the money bar, and the bar glows: saved money shines */
  const flowToBar = (idx: number, price: number) => {
    const root = rootRef.current?.getBoundingClientRect()
    const item = document.getElementById(`g-ev-${idx}`)?.getBoundingClientRect()
    const bar = barRef.current?.getBoundingClientRect()
    const n = seq.current++
    if (!root || !item || !bar || reduced) { setPulse({ kind: 'glow', n }); return }
    const fill = Math.max(0.08, Math.min(0.92, walletOf(c, r) / Math.max(1, c.startBalance)))
    setFlows(fl => [...fl, { id: n, text: `${fmt(price)} ₾`, x0: item.left + item.width / 2 - root.left, y0: item.top - root.top, x1: bar.left + bar.width * fill - root.left, y1: bar.top - root.top - 8 }])
    later(() => { setFlows(fl => fl.filter(f => f.id !== n)); setPulse({ kind: 'glow', n }) }, 850)
  }

  const onFired = (fired: Fired[], quiet = false) => {
    let changed = false
    for (const f of fired) {
      if (f.kind === 'arrive') { halt.current = true; setFocus(null); setPhase('arrive'); later(() => setPhase('end'), reduced ? 900 : 2600); continue }
      const ev = c.events[f.idx]
      changed = true
      if (f.kind === 'dilemma' && ev.kind === 'dilemma') {
        halt.current = true
        setFocus(null)
        setBanner(null)
        const now = forecast(c, r).weather
        setDilemma({ idx: f.idx, now, weathers: ev.options.map(o => forecast(c, r, f.idx, o.cost).weather) })
        setPhase('dilemma')
      } else if (f.kind === 'pass' && ev.kind === 'temptation' && !quiet) flowToBar(f.idx, ev.price)
      else if (f.kind === 'oneoff' && ev.kind === 'oneoff' && !quiet) {
        const fromQ = r.hits[f.idx] ?? 0
        const n = seq.current++
        const line = fromQ >= ev.amount ? 'ქვევრი გაიხსნა — სწორედ ამისთვის იყო' : fromQ > 0 ? `ქვევრმა ${fmt(fromQ)} ₾ დაიჭირა, დანარჩენი — ბალანსიდან` : 'ბალანსიდან გადავიხადეთ'
        setBanner({ n, title: `${ev.icon} ${ev.label} · ${fmt(ev.amount)} ₾`, line })
        later(() => setBanner(b => (b?.n === n ? null : b)), 2800)
        if (fromQ > 0) setJarOpen(j => j + 1)
        else if (!calm && !reduced) setPulse({ kind: 'shake', n })
      }
    }
    if (changed) refresh()
  }

  const step = (dt: number) => {
    if (halt.current) return
    const w = windowEvent(c, r)
    if (w !== focusIdx.current) {
      focusIdx.current = w
      if (w >= 0) {
        const ev = c.events[w]
        const now = fcRef.current.weather
        const take = ev.kind === 'temptation' ? forecast(c, r, w, ev.price).weather : now
        const hint = hintsLeft.current > 0
        if (hint) hintsLeft.current--
        setFocus({ idx: w, now, take, hint })
      } else setFocus(null)
    }
    // slow down at once when something is in front (the full decision window stays ≥ 1.5 s), ease back afterwards
    const target = (w >= 0 ? WINDOW_SPEED : 1) / c.secPerDay
    speed.current = target < speed.current ? target : speed.current + (target - speed.current) * Math.min(1, dt * 6)
    const fired = advance(c, r, speed.current * dt)
    place()
    if (fired.length) onFired(fired)
    hudAcc.current += dt
    if (hudAcc.current >= 0.1) { hudAcc.current = 0; syncHud() }
  }
  useGameLoop(phase === 'run' && !paused, step)
  useHidden(() => { if (phase === 'run') setPaused(true) })

  /** one input: a tap takes what is in front of Jikho; nothing in front → a small hop */
  const tap = () => {
    if (phase !== 'run' || paused) return
    setHop(h => h + 1)
    const w = windowEvent(c, r)
    if (w < 0) return
    const ev = c.events[w]
    takeEvent(c, r, w)
    if (ev.kind === 'joy') setHearts(h => h + 1)
    focusIdx.current = -1
    setFocus(null)
    refresh()
  }

  const pickQvevri = (a: number) => {
    r.qvevriStart = a
    r.qvevri = a
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    refresh()
    setPhase('run')
  }
  const pickOption = (opt: number) => {
    if (!dilemma) return
    chooseOption(c, r, dilemma.idx, opt)
    setDilemma(null)
    halt.current = false
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    refresh()
    setPhase('run')
  }

  // presenter keys (desktop): N → the next event, E → payday (open dilemmas take the middle option)
  const presenterNext = () => {
    if (phase !== 'run') return
    const t = nextEventAt(c, r)
    if (t === null) return
    focusIdx.current = -1
    onFired(advance(c, r, t - r.x), true)
    place()
  }
  const presenterEnd = () => {
    if (phase !== 'run' && phase !== 'dilemma') return
    if (dilemma) { chooseOption(c, r, dilemma.idx, 1); setDilemma(null) }
    const all: Fired[] = []
    for (let guard = 0; guard < 50 && r.x < c.nDays; guard++) {
      for (const f of advance(c, r, c.nDays)) {
        if (f.kind === 'dilemma') chooseOption(c, r, f.idx, 1)
        else all.push(f)
      }
    }
    focusIdx.current = -1
    setFocus(null)
    place()
    if (!all.some(f => f.kind === 'arrive')) all.push({ kind: 'arrive', idx: -1 })
    onFired(all, true)
    refresh()
  }
  const keys = useRef({ tap, presenterNext, presenterEnd, phase })
  keys.current = { tap, presenterNext, presenterEnd, phase }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && e.code !== 'Space') return
      const k = keys.current
      if (e.code === 'Space' && k.phase === 'run') { e.preventDefault(); k.tap() }
      else if (e.code === 'KeyN') k.presenterNext()
      else if (e.code === 'KeyE') k.presenterEnd()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const mood: JikhoMood = phase === 'arrive' || phase === 'end' ? 'celebrate' : phase === 'dilemma' ? 'thinking' : 'happy'
  const accessories = game.equipped
  const dEv = dilemma ? (c.events[dilemma.idx] as Extract<GameEvent, { kind: 'dilemma' }>) : null

  return (
    <div className="g-root" ref={rootRef}>
      <TopBar c={c} day={hud.day} days={fc.days} calm={calm} onExit={onExit} />
      <div className="g-scene" onPointerDown={e => { e.preventDefault(); tap() }}>
        <Scene c={c} layers={layers} marks={marks} focus={focus} weather={fc.weather} calm={calm} reduced={reduced}
          mood={mood} walking={phase === 'run' && !paused} hop={hop} hearts={hearts} stage={stage} accessories={accessories} arrived={phase === 'arrive' || phase === 'end'} />
        <AnimatePresence>
          {banner && (
            <motion.div key={banner.n} className="g-banner" initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="tiny muted" style={{ fontWeight: 800 }}>მოულოდნელი ხარჯი</span>
              <b>{banner.title}</b>
              <span>{banner.line}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BottomHud c={c} wallet={hud.wallet} qvevri={hud.qvevri} joy={hud.joy} barRef={barRef} pulse={pulse} jarOpen={jarOpen} />

      {flows.map(f => (
        <motion.div key={f.id} className="g-tag" style={{ position: 'absolute', left: 0, top: 0, zIndex: 7, margin: 0, background: 'var(--sun)', color: '#3b2a00', pointerEvents: 'none' }}
          initial={{ x: f.x0 - 18, y: f.y0, opacity: 1, scale: 1.1 }} animate={{ x: f.x1 - 18, y: f.y1, opacity: 0.3, scale: 0.85 }} transition={{ duration: 0.8, ease: 'easeInOut' }}>
          {f.text}
        </motion.div>
      ))}

      <AnimatePresence>
        {phase === 'qvevri' && <QvevriCard key="q" c={c} calm={calm} onPick={pickQvevri} />}
        {phase === 'dilemma' && dEv && dilemma && <DilemmaCard key={`d${dilemma.idx}`} ev={dEv} now={dilemma.now} weathers={dilemma.weathers} onPick={pickOption} />}
      </AnimatePresence>

      {paused && phase === 'run' && (
        <div className="g-pause">
          <button className="pill-btn btn-sun" style={{ width: 'auto', padding: '14px 26px' }} onClick={() => setPaused(false)}>▶ გავაგრძელოთ</button>
        </div>
      )}

      {phase === 'end' && (
        <Finish c={c} r={r} calm={calm} stage={stage} accessories={accessories} onRestart={onRestart} onExit={onExit} onCheck={onCheck} onTalk={onTalk} />
      )}
    </div>
  )
}
