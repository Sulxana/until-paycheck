import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import './fork.css'
import { usePersona, fmt } from '../engine/view'
import { useStore, evolutionStage } from '../state/store'
import { Jikho, JikhoMood, Accessory } from '../components/Jikho'
import { WeatherKind } from '../engine/engine'
import {
  buildMonth, newRun, advanceTo, chooseFork, hitScam, dodgeScam, catchJoy, missJoy, forecast, locked, endingOf,
  hillAt, laneProfile, laneSign, climbing, Month, Run, Fx, Fc, Ending,
  SPEED, CLIMB_SLOW, FORK_LEN, LANE_DY, FATIGUE_PAUSE, DEFAULT_SEED, E_RESET,
} from './sim'
import { audio } from './audio'
import { Backdrop, Rain, FAR_W, MID_W } from './parts/Backdrop'
import { World, WIN, JOY_Y } from './parts/World'
import { Hud } from './parts/Hud'
import { StartCard, EndCard } from './parts/Screens'
import { loadBest, saveBest, Best } from './best'

const JX = 92 // Jikho's x on screen
const J_SIZE = 80
const J_FOOT = 71 // from the top of Jikho's drawing to his hooves
const JUMP_V = 620
const GRAV = 1650
const AIR_T = (2 * JUMP_V) / GRAV
const SLOW_DIST = 170
const STOP_PAD = 6
const LOOK = 520 // a fork can be chosen once its junction is this close
const HIT_HALF = 20
const SCAM_H = 36
const CAM_FOLLOW = 0.55

/** "გზის გასაყარი": Nino's month as a runner. Jikho runs, the road forks, scammers wait on the way. */
export function ForkGame({ onExit }: { onExit: () => void }) {
  const p = usePersona()
  const calm = p.id === 'tamar'
  const note = p.id !== 'nino' ? 'პროტოტიპი: ნინოს თვე' : null
  const [seed, setSeed] = useState(DEFAULT_SEED)
  const [round, setRound] = useState(0)
  const [started, setStarted] = useState(false)
  useEffect(() => () => audio.stopMusic(), [])
  return (
    <div className="f-root">
      <RunView key={round} seed={seed} calm={calm} note={note} started={started}
        onStart={() => { audio.init(); audio.startMusic(calm); setStarted(true) }}
        onReplay={() => setRound(n => n + 1)}
        onNew={() => { setSeed(s => s + 7919); setRound(n => n + 1) }}
        onExit={() => { audio.stopMusic(); onExit() }} />
    </div>
  )
}

interface GState {
  r: Run
  x: number
  v: number
  t: number
  jumpY: number
  jumpV: number
  air: boolean
  airT: number
  buffered: number
  flip: boolean
  squash: number
  lean: number
  pend: number
  preview: 0 | 1 | null
  stopped: boolean
  waitSince: number
  holdUntil: number
  ended: boolean
  win: number
  nextItem: number
  dustT: number
  prop: string
  ptr: { id: number; y0: number; side: 0 | 1 | null; drag: boolean; jumpLater: boolean } | null
  keySide: 0 | 1 | null
  seenJoy: boolean
  seenScam: boolean
  hint: string | null
  banner: string | null
  tension: boolean
  drains: { work: boolean; home: boolean }
}

interface Toast { id: number; icon: string; title: string; line?: string }
interface ForkUi { i: number; preview: 0 | 1 | null; fcs: [Fc, Fc] }

function RunView({ seed, calm, note, started, onStart, onReplay, onNew, onExit }: {
  seed: number; calm: boolean; note: string | null; started: boolean; onStart: () => void; onReplay: () => void; onNew: () => void; onExit: () => void
}) {
  const reduced = !!useReducedMotion()
  const p = usePersona()
  const game = useStore(s => s.games[p.id])
  const stage = evolutionStage(game)
  const m = useMemo(() => buildMonth(seed, calm), [seed, calm])
  const G = useRef<GState | null>(null)
  if (!G.current) {
    const r = newRun(m)
    advanceTo(m, r, 0)
    G.current = {
      r, x: 0, v: 0, t: 0, jumpY: 0, jumpV: 0, air: false, airT: 0, buffered: 0, flip: false, squash: 0, lean: 0,
      pend: 0, preview: null, stopped: false, waitSince: 0, holdUntil: 0, ended: false, win: 0, nextItem: 0, dustT: 0, prop: '',
      ptr: null, keySide: null, seenJoy: false, seenScam: false, hint: null, banner: null, tension: false, drains: { work: false, home: false },
    }
  }
  const g = G.current
  const r = g.r

  const sceneRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const farRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<HTMLDivElement>(null)
  const jRef = useRef<HTMLDivElement>(null)
  const jRotRef = useRef<HTMLDivElement>(null)
  const jScaleRef = useRef<HTMLDivElement>(null)
  const propRef = useRef<HTMLSpanElement>(null)
  const fxRef = useRef<HTMLDivElement>(null)
  const moneyRef = useRef<HTMLDivElement>(null)
  const energyRef = useRef<HTMLDivElement>(null)

  const [size, setSize] = useState({ W: 400, H: 780 })
  const baseY = Math.round(size.H * 0.6)
  const [hud, setHud] = useState(() => ({ fc: forecast(m, r), money: r.money, energy: r.energy, day: r.day, combo: 0 }))
  const [fk, setFk] = useState<ForkUi | null>(null)
  const [ver, setVer] = useState(0)
  const [win, setWin] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [moodTmp, setMoodTmp] = useState<JikhoMood | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [paused, setPaused] = useState(false)
  const [end, setEnd] = useState<{ kind: Ending; best: Best } | null>(null)
  const [showEnd, setShowEnd] = useState(false)
  const [combo, setCombo] = useState<{ n: number; k: number } | null>(null)
  const [tension, setTension] = useState(false)
  const [muted, setMuted] = useState(audio.muted)
  const [stamp, setStamp] = useState<{ k: number; text: string } | null>(null)
  const [best] = useState(loadBest)
  const touch = useMemo(() => { try { return window.matchMedia('(pointer: coarse)').matches } catch { return false } }, [])

  const seq = useRef(1)
  const timers = useRef<number[]>([])
  const later = (f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)) }
  useEffect(() => () => timers.current.forEach(t => clearTimeout(t)), [])

  // ---------------- helpers ----------------
  const pendFork = () => { while (g.pend < m.forks.length && r.choice[g.pend] !== undefined) g.pend++; return m.forks[g.pend] }
  const refresh = () => {
    const fc = forecast(m, r)
    setHud({ fc, money: r.money, energy: r.energy, day: r.day, combo: r.combo })
    const f = pendFork()
    if (f && !g.ended) setFk({ i: f.i, preview: g.preview, fcs: [forecast(m, r, { f: f.i, side: 0 }), forecast(m, r, { f: f.i, side: 1 })] })
    else setFk(null)
    setVer(v => v + 1)
  }
  const toast = (icon: string, title: string, line?: string, ms = 2800) => {
    const id = seq.current++
    setToasts(ts => [...ts.slice(-1), { id, icon, title, line }])
    later(() => setToasts(ts => ts.filter(t => t.id !== id)), ms)
  }
  const sceneXY = (el: HTMLElement | null): [number, number] | null => {
    const s = sceneRef.current?.getBoundingClientRect(), b = el?.getBoundingClientRect()
    return s && b ? [b.left - s.left + b.width / 2, b.top - s.top + b.height / 2] : null
  }
  const float = (text: string, x: number, y: number, cls = '') => {
    const host = fxRef.current
    if (!host) return
    const el = document.createElement('div')
    el.className = 'f-float ' + cls
    el.textContent = text
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.addEventListener('animationend', () => el.remove())
    host.appendChild(el)
    window.setTimeout(() => el.remove(), 2400)
  }
  const floatMoney = (v: number) => { const at = sceneXY(moneyRef.current); if (at) float(`${v > 0 ? '+' : '−'}${fmt(Math.abs(v))} ₾`, at[0], at[1] + 6, v > 0 ? 'good' : 'money') }
  const floatEnergy = (v: number, pre = '') => { const at = sceneXY(energyRef.current); if (at) float(`${pre}⚡${v > 0 ? '+' : '−'}${Math.abs(v)}`, at[0] - 30, at[1] + 4, v > 0 ? 'good' : 'en') }
  const footXY = (): [number, number] => {
    const hill = hillAt(m, g.x)
    return [JX, baseY - hill + laneAt().off + hill * CAM_FOLLOW - g.jumpY]
  }
  const burst = (x: number, y: number, n: number, cls: string, spread = 40) => {
    const host = fxRef.current
    if (!host || reduced) return
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span')
      el.className = 'f-part ' + cls
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6
      el.style.setProperty('--dx', `${(Math.cos(a) * spread * (0.6 + Math.random() * 0.6)).toFixed(1)}px`)
      el.style.setProperty('--dy', `${(Math.sin(a) * spread * (0.6 + Math.random() * 0.6) - (cls === 'dust' ? 6 : 0)).toFixed(1)}px`)
      el.addEventListener('animationend', () => el.remove())
      host.appendChild(el)
      window.setTimeout(() => el.remove(), 1600)
    }
  }
  const laneAt = (): { off: number; fork: number } => {
    for (let i = Math.max(0, g.pend - 2); i < m.forks.length; i++) {
      const f = m.forks[i]
      if (f.x > g.x) break
      const u = g.x - f.x
      if (u < FORK_LEN) { const c = r.choice[i]; return { off: c === undefined ? 0 : laneSign(c) * LANE_DY * laneProfile(u), fork: c === undefined ? -1 : i } }
    }
    return { off: 0, fork: -1 }
  }

  // ---------------- per frame: transforms only ----------------
  const place = () => {
    const camX = g.x - JX
    const hill = hillAt(m, g.x)
    const camY = hill * CAM_FOLLOW
    if (worldRef.current) worldRef.current.style.transform = `translate3d(${(-camX).toFixed(1)}px, ${camY.toFixed(1)}px, 0)`
    if (!reduced) {
      if (farRef.current) farRef.current.style.transform = `translate3d(${(-((camX * 0.07) % FAR_W)).toFixed(1)}px, ${(hill * 0.2).toFixed(1)}px, 0)`
      if (midRef.current) midRef.current.style.transform = `translate3d(${(-((camX * 0.26) % MID_W)).toFixed(1)}px, ${(hill * 0.38).toFixed(1)}px, 0)`
    }
    const lane = laneAt()
    const foot = baseY - hill + lane.off + camY - g.jumpY
    const bob = !g.air && g.v > 40 && !reduced ? -Math.abs(Math.sin(g.t * 13)) * 3 : 0
    if (jRef.current) jRef.current.style.transform = `translate3d(${JX - J_SIZE / 2}px, ${(foot - J_FOOT + bob).toFixed(1)}px, 0)`
    let sx = 1, sy = 1, rot = g.lean
    if (!reduced) {
      if (g.air) { const s = Math.max(0, Math.min(1, g.jumpV / JUMP_V)); sy = 1 + 0.1 * s; sx = 1 - 0.07 * s }
      else if (g.squash > 0) { sy = 1 - 0.16 * g.squash; sx = 1 + 0.12 * g.squash }
      if (g.flip && g.air) rot -= 360 * Math.min(1, g.airT / AIR_T)
    }
    if (jRotRef.current) jRotRef.current.style.transform = `rotate(${rot.toFixed(1)}deg)`
    if (jScaleRef.current) jScaleRef.current.style.transform = `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
    const prop = lane.fork >= 0 ? g.prop : ''
    if (propRef.current && propRef.current.dataset.v !== prop) { propRef.current.dataset.v = prop; propRef.current.textContent = prop; propRef.current.style.opacity = prop ? '1' : '0' }
  }

  // ---------------- events from the simulation ----------------
  const finish = (kind: Ending) => {
    if (g.ended) return
    g.ended = true
    g.v = 0
    const b = loadBest()
    b.runs++
    if (kind === 'sun') { b.suns++; b.best = Math.max(b.best ?? 0, Math.round(r.money)) }
    saveBest(b)
    setEnd({ kind, best: b })
    setWaiting(false)
    setHint(null)
    setBanner(null)
    audio.setTension(false)
    setTension(false)
    if (kind === 'sun') { audio.bell(); later(() => audio.endSun(), 700) } else if (kind === 'cloud') { audio.bell(); later(() => audio.endCloud(), 700) } else audio.endStorm()
    setMoodTmp(kind === 'sun' ? 'celebrate' : kind === 'cloud' ? 'calm' : 'resting')
    later(() => setShowEnd(true), kind === 'storm' ? 1300 : 1500)
  }

  const handleFx = (list: Fx[]) => {
    let changed = false
    for (const e of list) {
      changed = true
      if (e.k === 'bill') {
        audio.stamp()
        const k = seq.current++
        setStamp({ k, text: `${e.bill.icon} ${e.bill.label} · ${fmt(e.bill.amount)} ₾ ✓` })
        later(() => setStamp(s => (s && s.k === k ? null : s)), 1500)
        floatMoney(-e.bill.amount)
        const rentBills = m.bills.filter(b => b.rent)
        if (e.bill.rent && e.bill === rentBills[0]) {
          const sum = rentBills.reduce((s, b) => s + b.amount, 0)
          toast('🏠', `${rentBills.map(b => b.label).join(' და ')} · ${fmt(sum)} ₾ — გადახდილია`, 'ანგარიში დაეცა, ხელფასის დღე თითქმის არ შეცვლილა: ქირა თავიდანვე დათვლილი იყო', 4600)
        } else if (e.nth === 0) toast(e.bill.icon, `${e.bill.label} · ${fmt(e.bill.amount)} ₾ — გადახდილია`, 'ანგარიში შემცირდა, ხელფასის დღე — არა: პროგნოზმა ეს უკვე იცოდა', 4200)
      } else if (e.k === 'fail') finish('storm')
      else if (e.k === 'arrive') finish(endingOf(m, r))
      else if (e.k === 'later') { toast(e.s.e, `${e.s.t} · ${fmt(e.paid)} ₾`, e.s.was, 3800); audio.scam(); floatMoney(-e.paid); if (e.s.en) floatEnergy(e.s.en) }
      else if (e.k === 'back') { toast(e.s.e, e.s.t, undefined, 3000); audio.joy(); floatMoney(-e.s.p) }
      else if (e.k === 'surprise') { toast(e.s.e, `მოულოდნელი: ${e.s.t} · ${fmt(e.paid)} ₾`, 'პროგნოზი ასეთ შემთხვევებსაც ითვალისწინებდა', 3600); audio.scam(); floatMoney(-e.paid) }
      else if (e.k === 'drain') {
        floatEnergy(-1, e.weekend ? '🧺 ' : '💼 ')
        if (!e.weekend && !g.drains.work) { g.drains.work = true; toast('💼', 'სამუშაო დღე ⚡-ს ხარჯავს', 'სიხარულები და დასვენება ⚡-ს აბრუნებს', 3400) }
        if (e.weekend && !g.drains.home) { g.drains.home = true; toast('🧺', 'შაბათ-კვირის საქმეებიც ⚡-ს ხარჯავს', undefined, 2800) }
      } else if (e.k === 'fatigue') {
        g.holdUntil = performance.now() + FATIGUE_PAUSE * 1000
        setMoodTmp('resting')
        later(() => setMoodTmp(mm => (mm === 'resting' ? null : mm)), FATIGUE_PAUSE * 1000)
        toast(e.e, `${e.t} · ${fmt(e.p)} ₾`, `⚡ დაიცალა — ჯიხომ დაისვენა, ⚡ ${E_RESET}-მდე აღდგა`, 3800)
        audio.tired()
        floatMoney(-e.p)
      }
    }
    if (changed) refresh()
  }

  const celebrate = (n: number) => {
    if (n % 3 === 0) {
      const k = seq.current++
      setCombo({ n, k })
      audio.combo()
      later(() => setCombo(c => (c && c.k === k ? null : c)), 1400)
      setMoodTmp('celebrate')
      later(() => setMoodTmp(mm => (mm === 'celebrate' ? null : mm)), 1200)
      if (!g.air && !reduced) { g.flip = true; doJump() }
    }
  }

  // ---------------- input ----------------
  const doJump = () => {
    if (!started || g.ended || paused || performance.now() < g.holdUntil) return
    if (g.air) { g.buffered = performance.now(); return }
    g.air = true
    g.jumpV = JUMP_V
    g.airT = 0
    audio.jump()
    const [fx0, fy0] = footXY()
    burst(fx0, fy0, 4, 'dust', 22)
  }
  /** an unresolved scam or joy close ahead (a tap then means "jump" at once) */
  const itemNear = () => m.items.some((it, i) => !r.item[i] && it.x - g.x > -30 && it.x - g.x < 280)
  const scamBefore = (x: number) => m.items.some((it, i) => it.kind === 'scam' && !r.item[i] && it.x > g.x - 30 && it.x < x)
  const forkActive = () => { const f = pendFork(); return !!f && !g.ended && f.x - g.x < LOOK }
  const setPreview = (side: 0 | 1 | null) => {
    if (side !== null && !forkActive()) return
    if (g.preview === side) return
    g.preview = side
    g.lean = side === null ? 0 : side === 0 ? -7 : 7
    setFk(cur => (cur ? { ...cur, preview: side } : cur))
    if (side !== null) audio.hover()
  }
  const commit = (side: 0 | 1) => {
    if (!started || paused || g.ended || !forkActive()) return
    const f = pendFork()
    if (locked(m, r, f.i, side)) { toast('🔒', 'ამ გზისთვის ანგარიშზე საკმარისი არ არის', undefined, 2400); setPreview(null); return }
    const fx = chooseFork(m, r, f.i, side)
    if (!fx.length) return
    const o = f.opts[side]
    g.preview = null
    g.lean = 0
    g.prop = o.e
    audio.whoosh()
    const ch = fx[0]
    if (ch.k === 'choose' && ch.paid > 0) floatMoney(-ch.paid)
    if (o.en) floatEnergy(o.en)
    if (g.stopped) { g.stopped = false; setWaiting(false) }
    setMoodTmp(mm => (mm === 'thinking' ? null : mm))
    if (ch.k === 'choose' && ch.balanced && ch.combo >= 3) celebrate(ch.combo)
    handleFx(fx.slice(1))
    refresh()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!started || g.ended || paused) return
    audio.resume()
    const el = (e.target as HTMLElement).closest('[data-side]') as HTMLElement | null
    const side = el && forkActive() && el.closest('.f-signs') ? (Number(el.dataset.side) as 0 | 1) : null
    // with only a fork ahead a tap jumps on release, so a swipe to choose a road does not also make Jikho hop
    const jumpLater = side === null && forkActive() && !itemNear()
    g.ptr = { id: e.pointerId, y0: e.clientY, side, drag: false, jumpLater }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    if (side !== null) setPreview(side)
    else if (!jumpLater) doJump()
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const pt = g.ptr
    if (!pt || pt.id !== e.pointerId || !forkActive()) return
    const dy = e.clientY - pt.y0
    if (Math.abs(dy) > 22) { pt.drag = true; setPreview(dy < 0 ? 0 : 1) }
    else if (pt.drag && Math.abs(dy) < 10) setPreview(null)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const pt = g.ptr
    if (!pt || pt.id !== e.pointerId) return
    g.ptr = null
    if (pt.drag) { if (g.preview !== null) commit(g.preview) }
    else if (pt.side !== null) commit(pt.side)
    else if (pt.jumpLater) doJump()
    if (e.pointerType !== 'mouse') setPreview(null)
  }
  const onPointerCancel = () => { g.ptr = null; setPreview(null) }

  const pause = () => { if (started && !g.ended) { setPaused(true); audio.suspend() } }
  const resume = () => { setPaused(false); audio.resume() }
  const toggleMute = () => { audio.setMuted(!audio.muted); setMuted(audio.muted) }

  const keys = useRef({ doJump, setPreview, commit, pause, resume, toggleMute, paused, started })
  keys.current = { doJump, setPreview, commit, pause, resume, toggleMute, paused, started }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = keys.current
      if (!k.started) return
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) k.doJump(); return }
      if (e.repeat) return
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); g.keySide = 0; k.setPreview(0) }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); g.keySide = 1; k.setPreview(1) }
      else if (e.code === 'KeyM') k.toggleMute()
      else if (e.code === 'Escape' || e.code === 'KeyP') { if (k.paused) k.resume(); else k.pause() }
    }
    const up = (e: KeyboardEvent) => {
      const k = keys.current
      const side = e.code === 'ArrowUp' || e.code === 'KeyW' ? 0 : e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : null
      if (side === null || g.keySide !== side) return
      g.keySide = null
      if (g.preview === side) k.commit(side)
      else k.setPreview(null)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // ---------------- the loop ----------------
  const wantHint = (): string | null => {
    if (!started || g.ended) return null
    const it = m.items[g.nextItem]
    if (it && !r.item[g.nextItem] && it.x - g.x < 330) {
      if (it.kind === 'joy' && !g.seenJoy) return touch ? '👆 შეეხე ეკრანს — ახტი და დაიჭირე' : 'Space — ახტი და დაიჭირე'
      if (it.kind === 'scam' && !g.seenScam) return touch ? '👆 შეეხე ეკრანს — გადაახტი თაღლითს' : 'Space — გადაახტი თაღლითს'
    }
    const f = m.forks[g.pend]
    if (f && f.x - g.x < LOOK && r.choice[g.pend] === undefined) {
      if (g.pend === 0 || (g.stopped && performance.now() - g.waitSince > 1600)) return touch ? '⇅ გადაუსვი ან შეეხე ნიშანს' : '↑ ან ↓ — ან დააჭირე ნიშანს'
      if (g.pend === 1 && g.preview === null) return touch ? 'თითი დააკავე: ცა ხელფასის დღის ამინდს გაჩვენებს' : 'მაუსი ნიშანზე: ცა ხელფასის დღის ამინდს გაჩვენებს'
    }
    return null
  }
  const wantBanner = (): string | null => {
    if (!started || g.ended) return null
    const f = m.forks[g.pend]
    // a scam that comes before the next fork is announced early, so its text can be read in time
    const si = m.items.findIndex((it, i) => it.kind === 'scam' && !r.item[i] && it.x > g.x - 20)
    const sc = si >= 0 ? m.items[si] : null
    if (sc && sc.kind === 'scam' && sc.x - g.x < 460 && (!f || sc.x < f.x)) return `!${sc.def.e} ${sc.def.sign}`
    if (f && f.x - g.x < LOOK && r.choice[g.pend] === undefined) return f.card.q
    if (g.x > m.climbFrom && g.x < m.rentX) {
      const rb = m.bills.filter(b => b.rent)
      return `⛰ ქირის მთა · ${m.days[21].label}: ${fmt(rb.reduce((s, b) => s + b.amount, 0))} ₾`
    }
    return null
  }

  const step = (dt: number) => {
    g.t += dt
    if (!started || paused || g.ended) { place(); return }
    const now = performance.now()
    const f = pendFork()
    // speed: ease into an undecided fork and stop at it; sit while ⚡ recovers
    let target = SPEED * (climbing(m, g.x) ? CLIMB_SLOW : 1)
    if (now < g.holdUntil) target = 0
    const open = !!f && r.choice[f.i] === undefined
    // ease into an undecided fork — but never while a scam is still between Jikho and the junction (it must stay jumpable)
    if (open && !scamBefore(f.x)) { const dist = f.x - STOP_PAD - g.x; if (dist < SLOW_DIST) target *= Math.max(0.3, dist / SLOW_DIST) }
    g.v += (target - g.v) * Math.min(1, dt * (target < g.v ? 7 : 3.5))
    let nx = g.x + g.v * dt
    if (open && nx >= f.x - STOP_PAD) {
      nx = f.x - STOP_PAD
      g.v = 0
      if (!g.stopped) { g.stopped = true; g.waitSince = now; setWaiting(true); setMoodTmp(mm => mm ?? 'thinking') }
    }
    g.x = Math.max(g.x, nx)

    const fx = advanceTo(m, r, g.x)
    if (fx.length) handleFx(fx)
    if (g.ended) { place(); return }

    // scams and joys at Jikho's feet
    for (let i = g.nextItem; i < m.items.length; i++) {
      const it = m.items[i]
      if (it.x - g.x > 60) break
      if (r.item[i]) { if (i === g.nextItem) g.nextItem++; continue }
      const dx = it.x - g.x
      if (it.kind === 'scam') {
        if (Math.abs(dx) <= HIT_HALF && g.jumpY < SCAM_H) {
          const out = hitScam(m, r, i)
          if (out.length && out[0].k === 'scam') {
            g.seenScam = true
            audio.scam()
            g.squash = 1.2
            toast(it.def.e, `−${fmt(out[0].paid)} ₾ · ${it.def.hit}`, it.def.rule, 4200)
            floatMoney(-out[0].paid)
            setMoodTmp('worried')
            later(() => setMoodTmp(mm => (mm === 'worried' ? null : mm)), 1000)
            refresh()
          }
        } else if (dx < -HIT_HALF) {
          dodgeScam(m, r, i)
          g.seenScam = true
          audio.dodge()
          const [fx0, fy0] = footXY()
          float('აირიდე ✓', fx0 + 20, fy0 - 96, 'good')
          setVer(v => v + 1)
        }
      } else if (Math.abs(dx) <= 36 && g.jumpY > 30) {
        const out = catchJoy(m, r, i)
        if (out.length) {
          g.seenJoy = true
          audio.joy()
          const hill = hillAt(m, it.x)
          const sx = it.x - (g.x - JX), sy = baseY - hill + hill * CAM_FOLLOW - JOY_Y
          burst(sx, sy, 10, 'spark', 46)
          float(`${it.def.e} ${it.def.t} ⚡+1`, sx + 10, sy - 30, 'good')
          floatEnergy(1)
          handleFx(out.slice(1))
          refresh()
        }
      } else if (dx < -36) { missJoy(r, i); g.seenJoy = g.seenJoy || i > 0; setVer(v => v + 1) }
    }

    // jump
    if (g.air) {
      g.airT += dt
      g.jumpV -= GRAV * dt
      g.jumpY += g.jumpV * dt
      if (g.jumpY <= 0) {
        g.jumpY = 0
        g.air = false
        g.flip = false
        g.squash = 1
        audio.land()
        const [fx0, fy0] = footXY()
        burst(fx0, fy0, 6, 'dust', 26)
        if (now - g.buffered < 160) { g.buffered = 0; doJump() }
      }
    } else if (g.squash > 0) g.squash = Math.max(0, g.squash - dt * 6)
    // dust while running
    g.dustT += dt
    if (!g.air && g.v > 120 && g.dustT > 0.16) { g.dustT = 0; const [fx0, fy0] = footXY(); burst(fx0 - 18, fy0 - 2, 1, 'dust small', 10) }

    const w = Math.floor(g.x / WIN)
    if (w !== g.win) { g.win = w; setWin(w) }
    const ten = !calm && g.x > m.climbFrom
    if (ten !== g.tension) { g.tension = ten; audio.setTension(ten); setTension(ten) }
    const h = wantHint()
    if (h !== g.hint) { g.hint = h; setHint(h) }
    const b = wantBanner()
    if (b !== g.banner) { g.banner = b; setBanner(b) }
    place()
  }
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    let raf = 0, last = -1
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const dt = last < 0 ? 0 : Math.min(0.05, (t - last) / 1000)
      last = t
      stepRef.current(dt)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // size of the play area
  useLayoutEffect(() => {
    const el = sceneRef.current
    if (!el) return
    const measure = () => setSize(s => (s.W === el.clientWidth && s.H === el.clientHeight ? s : { W: el.clientWidth, H: el.clientHeight }))
    measure()
    let ro: ResizeObserver | null = null
    try { ro = new ResizeObserver(measure); ro.observe(el) } catch { /* old browser */ }
    return () => ro?.disconnect()
  }, [])
  useLayoutEffect(() => { place() })

  // pause when the tab is hidden
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'hidden') keys.current.pause() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  // payday morning: the salary arrives
  useEffect(() => {
    if (!started) return
    audio.salary()
    toast('💰', `ხელფასი · +${fmt(m.salary)} ₾`, `ანგარიშზე ${fmt(Math.round(r.money))} ₾ · შემდეგი ხელფასი ${m.days[30].label}`, 3200)
    refresh()
  }, [started])

  // ---------------- render ----------------
  const hoverRef = useRef(setPreview)
  hoverRef.current = setPreview
  const onHover = useMemo(() => (side: 0 | 1 | null) => { if (!G.current?.ptr) hoverRef.current(side) }, [])
  const pendUi = useMemo(() => (fk ? { i: fk.i, preview: fk.preview } : null), [fk?.i, fk?.preview])
  const previewFc = fk && fk.preview !== null ? fk.fcs[fk.preview] : null
  const endWeather: WeatherKind | null = end ? (end.kind === 'sun' ? 'sun' : end.kind === 'cloud' ? 'cloud' : 'rain') : null
  const weather: WeatherKind = endWeather ?? (previewFc ? previewFc.weather : hud.fc.weather)
  const baseMood: JikhoMood = weather === 'sun' ? 'happy' : weather === 'storm' ? 'worried' : 'calm'
  const mood = moodTmp ?? baseMood
  const accessories: Accessory[] = [...game.equipped]
  if ((weather === 'rain' || weather === 'storm') && !accessories.includes('umbrella')) accessories.push('umbrella')
  const walking = started && !paused && !waiting && !end && mood !== 'resting'
  const horizon = baseY - 165

  return (
    <>
      <div ref={sceneRef} className={'f-scene' + (tension ? ' tension' : '')}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
        <Backdrop weather={weather} horizon={horizon} farRef={farRef} midRef={midRef} reduced={reduced} />
        <div ref={worldRef} className="f-world">
          <World m={m} r={r} ver={ver} win={win} baseY={baseY} H={size.H} pend={pendUi} waiting={waiting} onHover={onHover} />
        </div>
        <div className={'f-tint ' + weather} />
        <div className="f-dusk" />
        <div ref={jRef} className={'f-jikho' + (walking ? ' run' : '')}>
          <div ref={jRotRef} className="rot">
            <div ref={jScaleRef} className="scl">
              <Jikho size={J_SIZE} mood={mood} stage={stage} accessories={accessories} walking={walking} bob={false} />
            </div>
          </div>
          <span ref={propRef} className="f-prop" />
        </div>
        <div ref={fxRef} className="f-fx" />
        <Rain weather={weather} reduced={reduced} />
        <AnimatePresence>
          {banner && <motion.div key={banner} className={'f-banner' + (banner[0] === '!' ? ' scam' : '')} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}><span>{banner[0] === '!' ? banner.slice(1) : banner}</span></motion.div>}
        </AnimatePresence>
        <AnimatePresence>
          {combo && (
            <motion.div key={combo.k} className={'f-combo' + (combo.n % 3 === 0 ? ' big' : '')} style={{ top: baseY - 230 }} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, y: -16 }} transition={{ type: 'spring', damping: 12, stiffness: 260 }}>
              <span>წონასწორობა ×{combo.n}!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Hud m={m} fc={hud.fc} preview={previewFc} money={hud.money} energy={hud.energy} day={hud.day} combo={hud.combo} muted={muted}
        moneyRef={moneyRef} energyRef={energyRef} onMute={toggleMute} onPause={pause} onExit={onExit} />
      <AnimatePresence>
        {stamp && <motion.div key={stamp.k} className="f-billstamp" initial={{ scale: 1.7, opacity: 0, rotate: -16 }} animate={{ scale: 1, opacity: 1, rotate: -7 }} exit={{ opacity: 0 }} transition={{ type: 'spring', damping: 14, stiffness: 300 }}>{stamp.text}</motion.div>}
      </AnimatePresence>
      <div className="f-toasts">
        <AnimatePresence>
          {hint && <motion.div key={'h' + hint} layout className="f-hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}><span>{hint}</span></motion.div>}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {toasts.map(t => (
            <motion.div key={t.id} layout className="f-toast" initial={{ opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              <span className="ic">{t.icon}</span>
              <span className="tx"><b>{t.title}</b>{t.line && <small>{t.line}</small>}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!started && <StartCard key="start" onStart={onStart} note={note} best={best} touch={touch} calm={calm} stage={stage} accessories={game.equipped} />}
      </AnimatePresence>
      {paused && !end && (
        <div className="f-over f-pause" onPointerDown={e => e.stopPropagation()}>
          <button className="f-go" onClick={resume} autoFocus>▶ გავაგრძელოთ</button>
        </div>
      )}
      {showEnd && end && <EndCard m={m} r={r} kind={end.kind} best={end.best} note={note} stage={stage} accessories={game.equipped} onReplay={onReplay} onNew={onNew} onExit={onExit} />}
    </>
  )
}
