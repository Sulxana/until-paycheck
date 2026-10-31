import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import './fork.css'
import { usePersona, fmt } from '../engine/view'
import { useStore, evolutionStage } from '../state/store'
import { Jikho, JikhoMood, Accessory } from '../components/Jikho'
import { WeatherKind } from '../engine/engine'
import {
  buildMonth, newRun, advanceTo, chooseFork, hitScam, dodgeScam, catchJoy, missJoy, forecast, locked, endingOf, moveStep, contactOf, wRank,
  hillAt, laneProfile, laneSign, forkFact, endFacts, pricier, keepTogether, Run, Fx, Fc, Ending, SeenFact,
  FORK_LEN, LANE_DY, FATIGUE_PAUSE, DEFAULT_SEED, E_RESET, LOOK, JUMP_V, GRAV, COMBO_MOVE, FACT_WAIT_MS, BANNER_AHEAD, NOTE_MS,
  NOTE_SEEN_MS, SHARE_ROOM, factMs, factMayShow, scamAhead, noticeAhead,
} from './sim'
import { audio } from './audio'
import { Backdrop, Rain, FAR_W, MID_W } from './parts/Backdrop'
import { World, WIN, JOY_Y } from './parts/World'
import { Hud } from './parts/Hud'
import { Pads, PADS_H } from './parts/Pads'
import { StartCard, EndCard } from './parts/Screens'
import { loadBest, recordRun, tutorialDone, markTutorialDone, SeedRec } from './best'

const J_SIZE = 80
const J_FOOT = 71 // from the top of Jikho's drawing to his hooves
const CAM_FOLLOW = 0.55
const SPIN_T = 0.6 // s: the combo spin, on the ground (a jump could come down on a scam ahead)
const TUT_SLOW = 120 // first run only: time slows to a quarter when the first joy / scam is this close…
const TUT_STOP = 46 // …and waits here for the tap
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)

/** "გზის გასაყარი": Nino's month as a runner. Jikho runs, the road forks, scammers wait on the way. */
export function ForkGame({ onExit }: { onExit: () => void }) {
  const p = usePersona()
  const calm = p.id === 'tamar'
  const note = p.id !== 'nino' ? 'პროტოტიპი: ნინოს თვე' : null
  const [seed, setSeed] = useState(DEFAULT_SEED)
  const [round, setRound] = useState(0)
  const [started, setStarted] = useState(false)
  useEffect(() => () => audio.stopMusic(), [])
  const again = () => { audio.resume(); audio.startMusic(calm) }
  return (
    <div className={'f-root' + (calm ? ' calm' : '')}>
      <RunView key={round} seed={seed} calm={calm} note={note} started={started}
        onStart={() => { audio.init(); audio.startMusic(calm); setStarted(true) }}
        onReplay={() => { again(); setRound(n => n + 1) }}
        onNew={() => { again(); setSeed(s => s + 7919); setRound(n => n + 1) }}
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
  buffered: number
  /** seconds into the combo spin, −1 when none */
  spinT: number
  squash: number
  lean: number
  pend: number
  preview: 0 | 1 | null
  /** the pending fork is close enough to choose (its pads show) */
  active: boolean
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
  /** first-run help: slow motion at the first joy and the first scam */
  tut: boolean
  tutIdx: number
  tutTap: boolean
  timeScale: number
  tutOn: boolean
  hint: string | null
  banner: string | null
  tension: boolean
  dayToasts: { work: boolean; rest: boolean }
  lowWarned: boolean
  trudge: boolean
  salary: boolean
  /** index of the last fork whose fact was shown */
  factLast: number
  /** a fact that waits (briefly) for the toasts to clear */
  factWait: (SeenFact & { i: number; until: number }) | null
  /** the facts the player met on the way (for the end card) */
  seen: SeenFact[]
  /** key of the fact on screen (0: none), and when it goes */
  factOn: number
  factEnd: number
  /** a scam's rule is on screen until then (no fact next to it) */
  ruleUntil: number
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
      r, x: 0, v: 0, t: 0, jumpY: 0, jumpV: 0, air: false, buffered: 0, spinT: -1, squash: 0, lean: 0,
      pend: 0, preview: null, active: false, stopped: false, waitSince: 0, holdUntil: 0, ended: false, win: 0, nextItem: 0, dustT: 0, prop: '',
      ptr: null, keySide: null, seenJoy: false, seenScam: false, tut: !tutorialDone(), tutIdx: -1, tutTap: false, timeScale: 1, tutOn: false,
      hint: null, banner: null, tension: false, dayToasts: { work: false, rest: false }, lowWarned: false, trudge: false, salary: false,
      factLast: -99, factWait: null, seen: [], factOn: 0, factEnd: 0, ruleUntil: 0,
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
  const sweatRef = useRef<HTMLSpanElement>(null)
  const fxRef = useRef<HTMLDivElement>(null)
  const moneyRef = useRef<HTMLDivElement>(null)
  const energyRef = useRef<HTMLDivElement>(null)
  const weatherRef = useRef<WeatherKind>('sun')
  /** both previews of the pending fork, computed when it appears (never in the frame loop) */
  const fcsRef = useRef<{ i: number; base: Fc; fcs: [Fc, Fc] } | null>(null)

  const [size, setSize] = useState({ W: 400, H: 780 })
  const jx = size.W < 420 ? 64 : 92 // Jikho's x on screen: more road ahead on a narrow screen
  // the road sits above the choice pads: the lower lane's sign must clear them
  const baseY = Math.max(Math.round(size.H * 0.5), Math.min(Math.round(size.H * 0.6), size.H - PADS_H - LANE_DY - 72))
  // room above Jikho's head for a scam banner and a fact together (the notices start 158 px down: fork.css .f-info)
  const share = baseY - J_FOOT - 158 >= SHARE_ROOM
  const [hud, setHud] = useState(() => ({ fc: forecast(m, r), money: r.money, energy: r.energy, day: r.day, combo: 0, emptied: false }))
  const [fk, setFk] = useState<ForkUi | null>(null)
  const [active, setActive] = useState(false)
  const [ver, setVer] = useState(0)
  const [win, setWin] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [tutOn, setTutOn] = useState(false)
  const [moodTmp, setMoodTmp] = useState<JikhoMood | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [paused, setPaused] = useState(false)
  const [end, setEnd] = useState<{ kind: Ending; prev: SeedRec | null } | null>(null)
  const [showEnd, setShowEnd] = useState(false)
  const [combo, setCombo] = useState<{ n: number; k: number } | null>(null)
  const [tension, setTension] = useState(false)
  const [muted, setMuted] = useState(audio.muted)
  const [stamp, setStamp] = useState<{ k: number; text: string } | null>(null)
  const [fact, setFact] = useState<{ k: number; t: string } | null>(null)
  /** when each notice on screen goes (performance.now() ms) */
  const notes = useRef<number[]>([])
  const notesLeft = (now: number) => { notes.current = notes.current.filter(e => e > now); return notes.current.map(e => e - now) }
  const [best] = useState(loadBest)
  const touch = useMemo(() => { try { return window.matchMedia('(pointer: coarse)').matches } catch { return false } }, [])

  const seq = useRef(1)
  const timers = useRef<number[]>([])
  const later = (f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)) }
  useEffect(() => () => timers.current.forEach(t => clearTimeout(t)), [])

  // ---------------- helpers ----------------
  const pendFork = () => { while (g.pend < m.forks.length && r.choice[g.pend] !== undefined) g.pend++; return m.forks[g.pend] }
  const toast = (icon: string, title: string, line?: string, ms = 2800) => {
    const id = seq.current++
    setToasts(ts => [...ts.slice(-1), { id, icon, title, line }])
    const now = performance.now()
    notes.current.push(now + ms)
    // under a scam banner a notice waits behind the fact, unless it would then be seen too briefly: then the fact goes
    if (g.factOn && scamAhead(m, r, g.x) < BANNER_AHEAD && ms - (g.factEnd - now) < NOTE_SEEN_MS) hideFact()
    later(() => setToasts(ts => ts.filter(t => t.id !== id)), ms)
  }
  /** a short true fact under the HUD for a moment: it never blocks input and never covers the pads */
  const showFact = (t: string, i: number, w: number, p: number) => {
    const k = seq.current++
    g.factLast = i
    g.seen.push({ t, w, p })
    g.factOn = k
    g.factEnd = performance.now() + factMs(t)
    setFact({ k, t })
    later(() => { if (g.factOn === k) g.factOn = 0; setFact(f => (f && f.k === k ? null : f)) }, factMs(t))
  }
  /** a fact on screen goes early (a scam's rule, or a notice under a scam banner, needs the room); it stays among the seen
   * ones. Under a scam banner a fact and a notice never show together (on a small phone the three reach down to Jikho). */
  const hideFact = () => { if (g.factOn) { g.factOn = 0; setFact(null) } }
  const refresh = () => {
    const fc = forecast(m, r)
    setHud({ fc, money: r.money, energy: r.energy, day: r.day, combo: r.combo, emptied: r.zeroHits > 0 })
    const f = pendFork()
    if (f && !g.ended) {
      const fcs: [Fc, Fc] = [forecast(m, r, { f: f.i, side: 0 }), forecast(m, r, { f: f.i, side: 1 })]
      fcsRef.current = { i: f.i, base: fc, fcs }
      setFk({ i: f.i, preview: g.preview, fcs })
    } else { fcsRef.current = null; setFk(null) }
    setVer(v => v + 1)
    if (started && !g.ended && r.energy <= 2 && !g.lowWarned) { g.lowWarned = true; toast('⚡', '⚡ ცოტაა', 'დასვენება და სიხარულები აღადგენს', NOTE_MS.low) }
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
  const laneAt = (): { off: number; fork: number; en: number } => {
    for (let i = Math.max(0, g.pend - 2); i < m.forks.length; i++) {
      const f = m.forks[i]
      if (f.x > g.x) break
      const u = g.x - f.x
      if (u < FORK_LEN) {
        const c = r.choice[i]
        return c === undefined ? { off: 0, fork: -1, en: 0 } : { off: laneSign(c) * LANE_DY * laneProfile(u), fork: i, en: f.opts[c].en }
      }
    }
    return { off: 0, fork: -1, en: 0 }
  }
  const footXY = (): [number, number] => {
    const hill = hillAt(m, g.x)
    return [jx, baseY - hill + laneAt().off + hill * CAM_FOLLOW - g.jumpY]
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
      el.style.setProperty('--dy', `${(Math.sin(a) * spread * (0.6 + Math.random() * 0.6) - (cls.startsWith('dust') ? 6 : 0)).toFixed(1)}px`)
      el.addEventListener('animationend', () => el.remove())
      host.appendChild(el)
      window.setTimeout(() => el.remove(), 1600)
    }
  }

  // ---------------- per frame: transforms only ----------------
  const place = () => {
    const camX = g.x - jx
    const hill = hillAt(m, g.x)
    const camY = hill * CAM_FOLLOW
    if (worldRef.current) worldRef.current.style.transform = `translate3d(${(-camX).toFixed(1)}px, ${camY.toFixed(1)}px, 0)`
    if (!reduced) {
      if (farRef.current) farRef.current.style.transform = `translate3d(${(-((camX * 0.07) % FAR_W)).toFixed(1)}px, ${(hill * 0.2).toFixed(1)}px, 0)`
      if (midRef.current) midRef.current.style.transform = `translate3d(${(-((camX * 0.26) % MID_W)).toFixed(1)}px, ${(hill * 0.38).toFixed(1)}px, 0)`
    }
    const lane = laneAt()
    g.trudge = lane.fork >= 0 && lane.en < 0
    const low = r.energy <= 2
    // a ⚡− road is a trudge (short quick steps), low ⚡ a slow tired bob
    const freq = g.trudge ? 17 : low ? 9 : 13, amp = g.trudge ? 1.5 : low ? 2.2 : 3
    const foot = baseY - hill + lane.off + camY - g.jumpY
    const bob = !g.air && g.v > 40 && !reduced ? -Math.abs(Math.sin(g.t * freq)) * amp : 0
    if (jRef.current) jRef.current.style.transform = `translate3d(${jx - J_SIZE / 2}px, ${(foot - J_FOOT + bob).toFixed(1)}px, 0)`
    let sx = 1, sy = 1, rot = g.lean
    if (!reduced) {
      if (g.air) { const s = Math.max(0, Math.min(1, g.jumpV / JUMP_V)); sy = 1 + 0.1 * s; sx = 1 - 0.07 * s }
      else if (g.squash > 0) { sy = 1 - 0.16 * g.squash; sx = 1 + 0.12 * g.squash }
      if (g.spinT >= 0) rot -= 360 * easeInOut(Math.min(1, g.spinT / SPIN_T))
    }
    if (jRotRef.current) jRotRef.current.style.transform = `rotate(${rot.toFixed(1)}deg)`
    if (jScaleRef.current) jScaleRef.current.style.transform = `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
    const prop = lane.fork >= 0 ? g.prop : ''
    if (propRef.current && propRef.current.dataset.v !== prop) { propRef.current.dataset.v = prop; propRef.current.textContent = prop; propRef.current.style.opacity = prop ? '1' : '0' }
    const sweat = g.trudge && g.v > 40 && !g.air ? '1' : '0'
    if (sweatRef.current && sweatRef.current.style.opacity !== sweat) sweatRef.current.style.opacity = sweat
  }

  // ---------------- events from the simulation ----------------
  const finish = (kind: Ending) => {
    if (g.ended) return
    g.ended = true
    g.v = 0
    const { prev } = recordRun(seed, kind, Math.round(r.failed ? r.failed.money : r.money))
    if (g.tut) { g.tut = false; markTutorialDone() }
    setEnd({ kind, prev })
    setWaiting(false)
    setHint(null)
    setBanner(null)
    setFact(null)
    g.factOn = 0
    g.factWait = null
    g.active = false
    setActive(false)
    audio.stopMusic()
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
          toast('🏠', `${rentBills.map(b => b.label).join(' და ')} · ${fmt(sum)} ₾ — გადახდილია`, 'ანგარიში შემცირდა, ხელფასის დღის პროგნოზი თითქმის არ შეცვლილა: ქირა თავიდანვე დათვლილი იყო', NOTE_MS.rent)
        } else if (e.nth === 0) toast(e.bill.icon, `${e.bill.label} · ${fmt(e.bill.amount)} ₾ — გადახდილია`, 'ანგარიში შემცირდა, ხელფასის დღის პროგნოზი — არა: ეს გადასახადი უკვე დათვლილი იყო', NOTE_MS.bill)
      } else if (e.k === 'fail') finish('storm')
      else if (e.k === 'arrive') finish(endingOf(m, r))
      else if (e.k === 'later') {
        toast(e.s.e, `${e.s.t} · ${fmt(e.paid)} ₾`, e.s.was, NOTE_MS.later); audio.scam(); floatMoney(-e.paid); if (e.s.en) floatEnergy(e.s.en)
        if (e.s.fact) g.seen.push({ t: e.s.fact, w: 3, p: e.paid })
      }
      else if (e.k === 'back') { toast(e.s.e, e.s.t, undefined, NOTE_MS.back); audio.joy(); floatMoney(-e.s.p) }
      else if (e.k === 'surprise') { toast(e.s.e, `მოულოდნელი: ${e.s.t} · ${fmt(e.paid)} ₾`, 'პროგნოზი ასეთ შემთხვევებსაც ითვალისწინებდა', NOTE_MS.surprise); audio.scam(); floatMoney(-e.paid) }
      else if (e.k === 'dayEn') {
        floatEnergy(e.delta, e.delta < 0 ? '💼 ' : '🛋️ ')
        if (e.delta < 0 && !g.dayToasts.work) { g.dayToasts.work = true; toast('💼', 'სამუშაო დღე ⚡-ს ხარჯავს', 'შაბათ-კვირა და სიხარულები ⚡-ს აბრუნებს', NOTE_MS.work) }
        if (e.delta > 0 && !g.dayToasts.rest) { g.dayToasts.rest = true; toast('🛋️', 'შაბათ-კვირა: დასვენება ⚡+1', undefined, NOTE_MS.rest) }
      } else if (e.k === 'fatigue') {
        g.holdUntil = performance.now() + FATIGUE_PAUSE * 1000
        setMoodTmp('resting')
        later(() => setMoodTmp(mm => (mm === 'resting' ? null : mm)), FATIGUE_PAUSE * 1000)
        toast(e.e, `${e.t} · ${fmt(e.p)} ₾`, `⚡ დაიცალა: ჯიხომ დაისვენა, ⚡ ${E_RESET}-მდე აღდგა. ამ თვეს ☀️ აღარ გამოვა`, NOTE_MS.fatigue)
        audio.tired()
        floatMoney(-e.p)
      }
    }
    if (changed) refresh()
  }

  const celebrate = (n: number) => {
    const k = seq.current++
    setCombo({ n, k })
    audio.combo()
    later(() => setCombo(c => (c && c.k === k ? null : c)), 1400)
    setMoodTmp('celebrate')
    later(() => setMoodTmp(mm => (mm === 'celebrate' ? null : mm)), 1200)
    if (reduced) return
    if (COMBO_MOVE === 'flip') doJump()
    else { g.spinT = 0; g.squash = 0.7 }
  }

  // ---------------- input ----------------
  const doJump = () => {
    // allowed while Jikho rests after ⚡ ran out: a scam close ahead must stay avoidable
    if (!started || g.ended || paused) return
    if (g.timeScale < 1) g.tutTap = true
    if (g.air) { g.buffered = performance.now(); return }
    g.air = true
    g.jumpV = JUMP_V
    audio.jump()
    const [fx0, fy0] = footXY()
    burst(fx0, fy0, 4, 'dust', 22)
  }
  /** an unresolved scam or joy close ahead (a tap then means "jump" at once) */
  const itemNear = () => m.items.some((it, i) => !r.item[i] && it.x - g.x > -30 && it.x - g.x < 280)
  const forkActive = () => { const f = pendFork(); return !!f && !g.ended && f.x - g.x < LOOK }
  const setPreview = (side: 0 | 1 | null) => {
    if (side !== null && !forkActive()) return
    if (g.preview === side) return
    g.preview = side
    g.lean = side === null ? 0 : side === 0 ? -7 : 7
    setFk(cur => (cur ? { ...cur, preview: side } : cur))
    if (side !== null) { const c = fcsRef.current; audio.preview(!!c && wRank(c.fcs[side].weather) > wRank(c.base.weather)) }
  }
  const lockedToast = () => toast('🔒', 'ამ გზისთვის ანგარიშზე საკმარისი თანხა არ არის', undefined, NOTE_MS.locked)
  const commit = (side: 0 | 1) => {
    if (!started || paused || g.ended || !forkActive()) return
    const f = pendFork()
    if (locked(m, r, f.i, side)) { lockedToast(); setPreview(null); return }
    const fx = chooseFork(m, r, f.i, side)
    if (!fx.length) return
    const o = f.opts[side]
    g.preview = null
    g.lean = 0
    g.prop = o.e
    g.active = false
    setActive(false)
    audio.whoosh(side === 0)
    audio.duck(false)
    const ch = fx[0]
    if (ch.k === 'choose' && ch.paid > 0) floatMoney(-ch.paid)
    if (o.en) floatEnergy(o.en)
    if (g.stopped) { g.stopped = false; setWaiting(false) }
    setMoodTmp(mm => (mm === 'thinking' ? null : mm))
    if (ch.k === 'choose' && ch.balanced && ch.combo >= 3 && ch.combo % 3 === 0) celebrate(ch.combo)
    handleFx(fx.slice(1))
    refresh()
    const ft = forkFact(m, f.i, g.factLast)
    if (ft) g.factWait = { t: ft, i: f.i, w: pricier(f, side) ? 2 : 1, p: pricier(f, side) ? o.p : 0, until: performance.now() + FACT_WAIT_MS }
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
      // on the start and end cards (and over the pause button) the keys keep their usual meaning
      if (!k.started || g.ended) return
      if (k.paused) {
        if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); k.resume() }
        else if (e.code === 'KeyM') k.toggleMute()
        return
      }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) k.doJump(); return }
      if (e.repeat) return
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); g.keySide = 0; k.setPreview(0) }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); g.keySide = 1; k.setPreview(1) }
      else if (e.code === 'KeyM') k.toggleMute()
      else if (e.code === 'Escape' || e.code === 'KeyP') k.pause()
    }
    const up = (e: KeyboardEvent) => {
      const k = keys.current
      if (!k.started || g.ended || k.paused) return
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
  /** first run: the first joy / first scam close ahead that still waits for the player's tap (−1: none) */
  const tutItem = (): number => {
    if (!g.tut) return -1
    for (let i = g.nextItem; i < m.items.length; i++) {
      const it = m.items[i], ahead = it.x - g.x
      if (ahead > TUT_SLOW) break
      if (r.item[i] || ahead < -10 || (it.kind === 'joy' ? g.seenJoy : g.seenScam)) continue
      if (g.tutIdx !== i) { g.tutIdx = i; g.tutTap = false }
      return g.tutTap ? -1 : i
    }
    return -1
  }
  const wantHint = (now: number): string | null => {
    if (!started || g.ended) return null
    const it = m.items[g.nextItem]
    if (it && !r.item[g.nextItem] && it.x - g.x < 330) {
      if (it.kind === 'joy' && !g.seenJoy) return touch ? '👆 შეეხე ეკრანს — ახტი და დაიჭირე' : 'Space — ახტი და დაიჭირე'
      if (it.kind === 'scam' && !g.seenScam) return touch ? '👆 შეეხე ეკრანს — გადაახტი თაღლითს' : 'Space — გადაახტი თაღლითს'
    }
    if (g.active) {
      if (g.preview !== null) return g.pend <= 1 ? (touch ? 'აუშვი — ამ გზით წავალთ' : 'აუშვი ან დააწკაპუნე — ამ გზით წავალთ') : null
      if (g.pend <= 1) return touch ? '👇 დააკავე: ცაზე ხელფასის დღის ამინდი გამოჩნდება' : '↑ ↓ დააკავე: ცაზე ხელფასის დღის ამინდი გამოჩნდება'
      if (g.stopped && now - g.waitSince > 1600) return 'ჯიხო გელოდება: აირჩიე გზა 👇'
    }
    return null
  }
  const wantBanner = (): string | null => {
    if (!started || g.ended) return null
    // a scam ahead is announced early, so its full text can be read in time (the road shows a short version)
    const si = m.items.findIndex((it, i) => it.kind === 'scam' && !r.item[i] && it.x > g.x - 20)
    const sc = si >= 0 ? m.items[si] : null
    if (sc && sc.kind === 'scam' && sc.x - g.x < BANNER_AHEAD) return `!${sc.def.e} ${sc.def.sign}`
    if (g.x > m.climbFrom && g.x < m.rentX) {
      const rb = m.bills.filter(b => b.rent)
      return `⛰ ქირის მთა · ${m.days[21].label}: ${fmt(rb.reduce((s, b) => s + b.amount, 0))} ₾`
    }
    return null
  }

  const step = (dtReal: number) => {
    g.t += dtReal
    if (!started || paused || g.ended) { place(); return }
    const now = performance.now()
    // first run: slow motion as the first joy and the first scam come close, until the player taps
    const ti = tutItem()
    g.timeScale = ti < 0 ? 1 : m.items[ti].x - g.x <= TUT_STOP ? 0 : 0.25
    const dt = dtReal * g.timeScale
    if ((g.timeScale < 1) !== g.tutOn) { g.tutOn = g.timeScale < 1; setTutOn(g.tutOn) }

    const vBefore = g.v
    const atFork = moveStep(m, r, g, dt, pendFork(), now < g.holdUntil)
    if (atFork && !g.stopped) {
      g.stopped = true
      g.waitSince = now
      setWaiting(true)
      setMoodTmp(mm => mm ?? 'thinking')
      audio.duck(true)
      if (vBefore > 60 && !reduced) { g.squash = 0.8; const [fx0, fy0] = footXY(); burst(fx0 + 12, fy0 - 2, 5, 'dust', 18) }
    }

    const fx = advanceTo(m, r, g.x)
    if (fx.length) handleFx(fx)
    if (g.ended) { place(); return }
    // a fact waits while a scam is announced or its rule is up (the jump and the rule come first), and for the notices
    // to clear (sim.ts: factMayShow); then it takes a notice's slot
    const fw = g.factWait
    if (fw) {
      if (factMayShow(notesLeft(now), scamAhead(m, r, g.x), noticeAhead(m, r, g.x, g.dayToasts), now < g.ruleUntil, factMs(fw.t), share)) { g.factWait = null; showFact(fw.t, fw.i, fw.w, fw.p) }
      else if (now > fw.until) g.factWait = null
    }

    // scams and joys at Jikho's feet
    for (let i = g.nextItem; i < m.items.length; i++) {
      const it = m.items[i]
      if (it.x - g.x > 60) break
      if (r.item[i]) { if (i === g.nextItem) g.nextItem++; continue }
      const c = contactOf(m, r, i, g.x, g.jumpY)
      if (!c) continue
      if (it.kind === 'scam') g.seenScam = true
      else g.seenJoy = true
      if (c === 'hit' && it.kind === 'scam') {
        const out = hitScam(m, r, i)
        if (out.length && out[0].k === 'scam') {
          audio.scam()
          g.squash = 1.2
          // the rule is the lesson here: no fork fact next to it
          hideFact()
          g.factWait = null
          g.ruleUntil = now + NOTE_MS.scam
          toast(it.def.e, `−${fmt(out[0].paid)} ₾ · ${it.def.hit}`, it.def.rule, NOTE_MS.scam)
          g.seen.push({ t: it.def.rule, w: 3, p: out[0].paid })
          floatMoney(-out[0].paid)
          setMoodTmp('worried')
          later(() => setMoodTmp(mm => (mm === 'worried' ? null : mm)), 1000)
          refresh()
        }
      } else if (c === 'dodge') {
        dodgeScam(m, r, i)
        audio.dodge()
        const [fx0, fy0] = footXY()
        float('აირიდე ✓', fx0 + 20, fy0 - 96, 'good')
        setVer(v => v + 1)
      } else if (c === 'catch' && it.kind === 'joy') {
        const out = catchJoy(m, r, i)
        if (out.length) {
          audio.joy()
          const hill = hillAt(m, it.x)
          const sx = it.x - (g.x - jx), sy = baseY - hill + hill * CAM_FOLLOW - JOY_Y
          burst(sx, sy, 10, 'spark', 46)
          float(`${it.def.e} ${it.def.t} ⚡+1`, sx + 10, sy - 30, 'good')
          floatEnergy(1)
          handleFx(out.slice(1))
          refresh()
        }
      } else if (c === 'miss') { missJoy(r, i); refresh() }
    }
    if (g.tut && g.seenJoy && (g.seenScam || !m.items.some(it => it.kind === 'scam'))) { g.tut = false; markTutorialDone() }

    // jump
    if (g.air) {
      g.jumpV -= GRAV * dt
      g.jumpY += g.jumpV * dt
      if (g.jumpY <= 0) {
        g.jumpY = 0
        g.air = false
        g.squash = 1
        audio.land()
        const [fx0, fy0] = footXY()
        burst(fx0, fy0, 6, 'dust', 26)
        if (now - g.buffered < 160) { g.buffered = 0; doJump() }
      }
    } else if (g.squash > 0) g.squash = Math.max(0, g.squash - dtReal * 6)
    if (g.spinT >= 0) { g.spinT += dtReal; if (g.spinT >= SPIN_T) g.spinT = -1 }
    // dust while running; splashes on a ⚡− road in the rain
    g.dustT += dt
    if (!g.air && g.v > 120 && g.dustT > (g.trudge ? 0.12 : 0.16)) {
      g.dustT = 0
      const [fx0, fy0] = footXY()
      const wet = g.trudge && (weatherRef.current === 'rain' || weatherRef.current === 'storm')
      burst(fx0 - 18, fy0 - 2, wet ? 3 : 1, wet ? 'splash' : 'dust small', wet ? 16 : 10)
    }

    const w = Math.floor(g.x / WIN)
    if (w !== g.win) { g.win = w; setWin(w) }
    const ten = !calm && g.x > m.climbFrom && g.x < m.descendTo
    if (ten !== g.tension) { g.tension = ten; audio.setTension(ten); setTension(ten) }
    const act = forkActive()
    if (act !== g.active) { g.active = act; setActive(act) }
    const h = wantHint(now)
    if (h !== g.hint) { g.hint = h; setHint(h) }
    const b = wantBanner()
    if (b !== g.banner) {
      // a scam banner that comes while a fact and a notice are up (on a small phone: while a fact is up) sends the fact away
      if (b && b[0] === '!' && g.factOn && (!share || notesLeft(now).length > 0)) hideFact()
      g.banner = b
      setBanner(b)
    }
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

  // a hidden tab: the run pauses, and the sound stops in any case (also on the end card)
  useEffect(() => {
    const f = () => {
      if (document.visibilityState === 'hidden') { keys.current.pause(); audio.suspend() }
      else if (!keys.current.paused) audio.resume()
    }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  // payday morning: the salary arrives (once, also under StrictMode's double effects)
  useEffect(() => {
    if (!started || g.salary) return
    g.salary = true
    audio.salary()
    toast('💰', `ხელფასი · +${fmt(m.salary)} ₾`, `ანგარიშზე ${fmt(Math.round(r.money))} ₾ · შემდეგი ხელფასი ${m.days[30].label}`, NOTE_MS.salary)
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
  weatherRef.current = weather
  const low = hud.energy <= 2
  const baseMood: JikhoMood = weather === 'sun' ? 'happy' : weather === 'storm' ? 'worried' : 'calm'
  // Tamar's calm month: low ⚡ is shown, but without a worried face or pulsing
  const mood = moodTmp ?? (low && started && !end && !calm ? 'worried' : baseMood)
  const accessories: Accessory[] = [...game.equipped]
  if ((weather === 'rain' || weather === 'storm') && !accessories.includes('umbrella')) accessories.push('umbrella')
  const walking = started && !paused && !waiting && !end && mood !== 'resting'
  const horizon = baseY - 165
  const padFork = fk ? m.forks[fk.i] : null
  const showPads = started && !end && active && !!padFork && r.choice[padFork.i] === undefined

  return (
    <>
      <div ref={sceneRef} className={'f-scene' + (tension ? ' tension' : '')}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
        <Backdrop weather={weather} horizon={horizon} farRef={farRef} midRef={midRef} reduced={reduced} />
        <div ref={worldRef} className="f-world">
          <World m={m} r={r} ver={ver} win={win} baseY={baseY} H={size.H} pend={pendUi} waiting={waiting} lowEnergy={low} onHover={onHover} />
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
          <span ref={sweatRef} className="f-sweat" aria-hidden="true">💧</span>
        </div>
        <div ref={fxRef} className="f-fx" />
        <Rain weather={weather} reduced={reduced} />
        <AnimatePresence>
          {tutOn && !end && (
            <motion.div key="tut" className="f-tut" style={{ top: baseY - 214 }} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <span>👆 {touch ? 'შეეხე ეკრანს — ახლა!' : 'Space — ახლა!'}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {combo && (
            <motion.div key={combo.k} className="f-combo big" style={{ top: baseY - 230 }} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, y: -16 }} transition={{ type: 'spring', damping: 12, stiffness: 260 }}>
              <span>წონასწორობა ×{combo.n}!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Hud m={m} fc={hud.fc} preview={previewFc} money={hud.money} energy={hud.energy} emptied={hud.emptied} day={hud.day} combo={hud.combo} muted={muted}
        moneyRef={moneyRef} energyRef={energyRef} onMute={toggleMute} onPause={pause} onExit={onExit} />
      <AnimatePresence>
        {stamp && <motion.div key={stamp.k} className="f-billstamp" initial={{ scale: 1.7, opacity: 0, rotate: -16 }} animate={{ scale: 1, opacity: 1, rotate: -7 }} exit={{ opacity: 0 }} transition={{ type: 'spring', damping: 14, stiffness: 300 }}>{stamp.text}</motion.div>}
      </AnimatePresence>
      <div className="f-info">
        <AnimatePresence>
          {banner && <motion.div key={banner} className={'f-banner' + (banner[0] === '!' ? ' scam' : '')} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}><span>{banner[0] === '!' ? banner.slice(1) : banner}</span></motion.div>}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {(fact && !end ? (banner && banner[0] === '!' ? [] : toasts.slice(-1)) : toasts).map(t => (
            <motion.div key={t.id} layout className="f-toast" initial={{ opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              <span className="ic">{t.icon}</span>
              <span className="tx"><b>{t.title}</b>{t.line && <small>{t.line}</small>}</span>
            </motion.div>
          ))}
          {fact && !end && (
            <motion.div key={'fact' + fact.k} layout className="f-fact" role="status" initial={{ opacity: 0, y: -8, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
              <span className="ic">💡</span><span>{keepTogether(fact.t)}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="f-hints">
        <AnimatePresence mode="wait">
          {hint && !showPads && <motion.div key={'h' + hint} className="f-hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}><span>{hint}</span></motion.div>}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showPads && padFork && (
          <Pads key={'p' + padFork.i} f={padFork} preview={fk!.preview} lowEnergy={low} hint={hint}
            lock={[locked(m, r, padFork.i, 0), locked(m, r, padFork.i, 1)]}
            onPreview={setPreview} onCommit={commit} onLocked={lockedToast} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!started && <StartCard key="start" onStart={onStart} note={note} best={best} touch={touch} calm={calm} stage={stage} accessories={game.equipped} />}
      </AnimatePresence>
      {paused && !end && (
        <div className="f-over f-pause" onPointerDown={e => e.stopPropagation()}>
          <button className="f-go" onClick={resume} autoFocus>▶ გავაგრძელოთ</button>
        </div>
      )}
      {showEnd && end && <EndCard m={m} r={r} kind={end.kind} prev={end.prev} note={note} stage={stage} accessories={game.equipped} facts={endFacts(m, r, g.seen)} onReplay={onReplay} onNew={onNew} onExit={onExit} />}
    </>
  )
}
