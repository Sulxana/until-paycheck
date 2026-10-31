import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, evolutionStage, ChatMsg } from '../state/store'
import { useEngine, usePersona, gel, fmt } from '../engine/view'
import { Jikho, JikhoMood } from '../components/Jikho'
import { RangeBar, WEMOJI, InfoTip } from '../components/ui'
import { FanChart } from '../components/FanChart'
import { respond, greeting, Ctx, START_CHIPS, JikhoMsg } from '../chat/responder'
import { LearnLink } from '../components/learn/LearnLink'
import { WEATHER_LABEL, WeatherKind, weatherOf } from '../engine/engine'

const ctxByPersona: Record<string, Ctx> = {}

export function Chat() {
  const p = usePersona()
  const e = useEngine()
  const msgs = useStore(s => s.chats[p.id])
  const push = useStore(s => s.pushChat)
  const reward = useStore(s => s.reward)
  const game = useStore(s => s.games[p.id])
  const demo = useStore(s => s.demos[p.id])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [mood, setMood] = useState<JikhoMood>('happy')
  const listRef = useRef<HTMLDivElement>(null)
  const stage = evolutionStage(game)

  useEffect(() => { if (useStore.getState().chats[p.id].length === 0) push(greeting(p)) }, [p.id])
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [msgs.length, typing])

  // the side panel next to the phone can ask Jikho a question
  const cue = useStore(s => s.cue)
  useEffect(() => {
    const c = useStore.getState().takeCue(['ask'])
    if (!c?.texts?.length) return
    const [first, ...rest] = c.texts
    const needsCtx = rest.length > 0 && (ctxByPersona[p.id]?.kind ?? null) === 'installment'
    const queue = needsCtx ? rest : [first, ...rest]
    queue.forEach((q, i) => setTimeout(() => send(q), 400 + i * 4200))
  }, [cue?.n])

  const send = (raw: string) => {
    const t = raw.trim()
    if (!t || typing) return
    setText('')
    push({ id: `u${Date.now()}`, from: 'user', text: t })
    setTyping(true)
    setMood('thinking')
    setTimeout(() => {
      const ctx = ctxByPersona[p.id] ?? { kind: null }
      const r = respond(t, e, p, ctx, { day: demo.day, extra: demo.extra })
      ctxByPersona[p.id] = r.ctx
      setTyping(false)
      setMood(r.mood)
      r.msgs.forEach((m, i) => setTimeout(() => push(m), i * 650))
      if (r.msgs.some(m => m.card && (m.card.kind === 'purchase' || m.card.kind === 'installment'))) setTimeout(() => reward('check'), r.msgs.length * 650 + 200)
    }, 700)
  }

  const lastChips = [...msgs].reverse().find(m => m.from === 'jikho' && m.chips)?.chips ?? START_CHIPS

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'linear-gradient(180deg,#eaf4fd 0%,#fffaf2 40%)' }}>
      <div className="row" style={{ padding: '14px 16px 8px', borderBottom: '1px solid #e7e0d4', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}>
        <div style={{ width: 54, height: 54, borderRadius: 27, background: 'linear-gradient(160deg,#ffe6a3,#ffd166)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          <Jikho size={52} mood={typing ? 'thinking' : mood} stage={stage} accessories={game.equipped} bob={false} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="h3">ჯიხო</div>
          <div className="tiny muted">{typing ? 'ვითვლი…' : 'შენი ფინანსური თანამგზავრი'}</div>
        </div>
      </div>

      <div ref={listRef} className="screen" style={{ padding: '12px 12px 6px', isolation: 'isolate' }}>
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => <Bubble key={m.id} m={m} z={msgs.length - i} />)}
        </AnimatePresence>
        {typing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="row" style={{ margin: '6px 0' }}>
            <div className="card" style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 6px' }}>
              {[0, 1, 2].map(i => <span key={i} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: '#8193a5', margin: '0 2px', animation: `typing 1.1s ${i * 0.18}s infinite` }} />)}
            </div>
          </motion.div>
        )}
      </div>

      <div style={{ padding: '6px 10px 10px', background: '#fffaf2' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
          {lastChips.map(c => (
            <motion.button key={c} whileTap={{ scale: 0.94 }} className="chip" style={{ background: '#fff', boxShadow: 'var(--shadow-sm)', flexShrink: 0, color: 'var(--navy)' }} onClick={() => send(c)}>{c}</motion.button>
          ))}
        </div>
        <div className="tiny muted" style={{ textAlign: 'center', marginBottom: 6 }}>ℹ️ ინფორმაციაა, არა რჩევა — არჩევანი შენია.</div>
        <form className="row" onSubmit={ev => { ev.preventDefault(); send(text) }} style={{ background: '#fff', borderRadius: 18, padding: '6px 6px 6px 14px', boxShadow: 'var(--shadow-sm)' }}>
          <input value={text} onChange={ev => setText(ev.target.value)} placeholder="მაგ.: 300 ₾-ის ფეხსაცმელი ვიყიდო?" style={{ flex: 1, border: 0, outline: 'none', fontSize: 15, background: 'transparent', minWidth: 0 }} />
          <motion.button whileTap={{ scale: 0.9 }} type="submit" style={{ width: 40, height: 40, borderRadius: 14, background: text.trim() ? '#1f3b57' : '#d9d0c2', color: '#fff', fontSize: 18 }} aria-label="გაგზავნა">↑</motion.button>
        </form>
      </div>
    </div>
  )
}

/** `z`: earlier bubbles sit above later ones, so an opened ⓘ pop-up is not covered by the next message */
function Bubble({ m, z }: { m: ChatMsg; z: number }) {
  const mine = m.from === 'user'
  const info = (m as JikhoMsg).info
  return (
    <motion.div data-info-root initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 22, stiffness: 280 }} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', margin: '6px 0', position: 'relative', zIndex: z }}>
      <div style={{ maxWidth: '88%' }}>
        <div style={{
          background: mine ? '#1f3b57' : '#fff', color: mine ? '#fff' : 'var(--ink)', padding: '10px 13px', borderRadius: mine ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
          boxShadow: 'var(--shadow-sm)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-line',
        }}>{m.text}{info && <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 4 }}><InfoTip>{info}</InfoTip></span>}</div>
        {m.card && <div style={{ marginTop: 6 }}><Card card={m.card} /></div>}
      </div>
    </motion.div>
  )
}

function Card({ card }: { card: NonNullable<ChatMsg['card']> }) {
  const d = card.data
  if (card.kind === 'purchase') {
    return (
      <div className="card" style={{ padding: 14 }}>
        <div className="between">
          <span className="small" style={{ fontWeight: 800 }}>{d.item ? `${d.item} · ` : ''}{gel(d.amount)}</span>
          <span style={{ fontSize: 22 }}>{WEMOJI[d.base.weather as keyof typeof WEMOJI]} → {WEMOJI[d.r.weather as keyof typeof WEMOJI]}</span>
        </div>
        <div className="tiny muted" style={{ marginTop: 2 }}>{WEATHER_LABEL[d.base.weather as keyof typeof WEATHER_LABEL]} → {WEATHER_LABEL[d.r.weather as keyof typeof WEATHER_LABEL]} · 10-დან {d.r.inTen} თვე ზღვარს ქვემოთ</div>
        <RangeBar p10={d.r.p10} p50={d.r.p50} p90={d.r.p90} cushion={d.cushion} compare={d.base} />
        <LearnLink topic="M2" text={'რას ნიშნავს „ზღვარს ქვემოთ"?'} compact />
      </div>
    )
  }
  if (card.kind === 'installment') {
    const cmp = d.compare
    return (
      <div className="card" data-info-root style={{ padding: 14, position: 'relative' }}>
        <div className="between" style={{ gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
          <div className="small" style={{ fontWeight: 800 }}>{d.title}</div>
          <InfoTip>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <span>ხელფასამდე ამინდი:</span>
              {(['sun', 'cloud', 'rain', 'storm'] as const).map(w => (
                <span key={w} className="row" style={{ gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: STRIP_COLOR[w] }} />{WEATHER_LABEL[w]}</span>
              ))}
            </div>
            {d.note && <div>{d.note}</div>}
            {d.rows.filter((r: any) => r.eir > 0).map((r: any) => <div key={r.label}>{r.label}: ეფექტური წლიური {fmt(r.eir, 1)}%</div>)}
            <div className="muted tiny">შორეული თვეები მიახლოებითია.</div>
          </InfoTip>
        </div>
        {cmp && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: cmp.nowShort ? '#fdecea' : '#e6f6ea', borderRadius: 14, padding: '10px 12px' }}>
                <div className="tiny" style={{ fontWeight: 800, color: cmp.nowShort ? '#b4413b' : 'var(--good)' }}>ახლა</div>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{WEMOJI[(cmp.nowWeather ?? (cmp.nowShort ? 'storm' : 'sun')) as WeatherKind]} {cmp.nowShort}</div>
                <div className="tiny muted">თვე ზღვარს ქვემოთ</div>
              </div>
              <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: 'spring', damping: 11 }} style={{ background: cmp.short ? '#fff4d6' : '#e6f6ea', borderRadius: 14, padding: '10px 12px' }}>
                <div className="tiny" style={{ fontWeight: 800, color: cmp.short ? '#a07800' : 'var(--good)' }}>{cmp.from ?? 'მოგვიანებით'}</div>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{WEMOJI[(cmp.weather ?? (cmp.short ? 'cloud' : 'sun')) as WeatherKind]} {cmp.short}</div>
                <div className="tiny muted">თვე ზღვარს ქვემოთ</div>
              </motion.div>
            </div>
            {cmp.cost24 > cmp.cost && (
              <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }} className="between" style={{ marginTop: 8, background: '#1f3b57', color: '#fff', borderRadius: 14, padding: '10px 12px', gap: 8 }}>
                <span className="small">სესხის ფასი {gel(cmp.cost)}, ნაცვლად {gel(cmp.cost24)}-ისა</span>
                <span style={{ textAlign: 'right', lineHeight: 1.1 }}><span className="tiny" style={{ display: 'block', opacity: 0.8 }}>ზოგავ</span><b style={{ color: '#ffd977', fontSize: 20, whiteSpace: 'nowrap' }}>{gel(cmp.cost24 - cmp.cost)}</b></span>
              </motion.div>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gap: 10 }}>
          {d.rows.map((r: any, i: number) => (
            <div key={r.label} style={{ border: '1px solid #eee5d8', borderRadius: 14, padding: 10 }}>
              <div className="between">
                <span className="small" style={{ fontWeight: 800 }}>{r.label}</span>
                <span style={{ fontWeight: 800, fontSize: 18 }}>{fmt(Math.round(r.monthly))} ₾<span className="tiny muted">/თვე</span></span>
              </div>
              {!cmp && (
                <>
                  <div className="small" style={{ fontWeight: 800, marginTop: 2, color: r.nShort ? '#b4413b' : 'var(--good)' }}>
                    {r.nShort ? `⚠ ${r.window.length}-დან ${r.nShort} თვე ზღვარს ქვემოთ` : '✓ ყველა თვე ზღვარს ზემოთ'}
                  </div>
                  <div className="tiny muted" style={{ margin: '2px 0 8px' }}>
                    სულ <b style={{ color: 'var(--ink)' }}>{gel(r.total)}</b> · სესხის ფასი <b style={{ color: r.cost ? '#b4413b' : 'var(--good)' }}>{gel(r.cost)}</b>
                  </div>
                </>
              )}
              <Strip rows={r.window.slice(0, 12)} cushion={d.cushion} labels={i === d.rows.length - 1} />
            </div>
          ))}
        </div>
        <LearnLink topic="M3" text="რატომ ძვირდება გრძელი ვადა?" compact />
      </div>
    )
  }
  if (card.kind === 'forecast') {
    return (
      <div className="card" data-info-root style={{ padding: 12, position: 'relative' }}>
        <FanChart data={d.fan} cushion={d.cushion} height={150} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <InfoTip>
            <div><b>ცისფერი ზოლი</b> — სად შეიძლება აღმოჩნდე.</div>
            <div><b>მუქი ხაზი</b> — ყველაზე სავარაუდო.</div>
          </InfoTip>
        </div>
      </div>
    )
  }
  if (card.kind === 'safe') {
    return (
      <div className="card" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><div className="tiny muted" style={{ fontWeight: 700 }}>დღის თავისუფალი თანხა</div><div style={{ fontSize: 26, fontWeight: 800 }}>~{gel(d.safe)}</div><div className="tiny muted">ჩვეულებრივი ხარჯის გარდა</div></div>
        <div><div className="tiny muted" style={{ fontWeight: 700 }}>ერთი შესყიდვა</div><div style={{ fontSize: 26, fontWeight: 800 }}>≤{gel(d.max)}</div><div className="tiny muted">ამინდი ღრუბლიანზე უარესი არ გახდება</div></div>
      </div>
    )
  }
  if (card.kind === 'concept') {
    return (
      <div className="card" data-info-root style={{ padding: 14, background: 'linear-gradient(135deg,#fff,#f6f1ff)', position: 'relative' }}>
        <div className="between" style={{ gap: 8, alignItems: 'flex-start' }}>
          <div className="h3">{d.title}</div>
          {d.more && <InfoTip>{d.more}</InfoTip>}
        </div>
        <div className="small" style={{ marginTop: 8, background: '#fff7e0', borderRadius: 10, padding: '8px 10px' }}><b>შენთვის:</b> {d.mine}</div>
        <div className="small" style={{ marginTop: 6 }}><b>წესი:</b> {d.rule}</div>
      </div>
    )
  }
  return null
}

/** strip colours follow the weather scale (same as MonthStrip) */
const STRIP_COLOR: Record<WeatherKind, string> = { sun: '#58b368', cloud: '#f0c419', rain: '#f08a3c', storm: '#d9534f' }

/** month strip for chat cards: month names only under the last row, so they are not repeated */
function Strip({ rows, cushion, labels }: { rows: { label: string; p50: number; pBelow: number }[]; cushion: number; labels: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 3 }}>
      {rows.map((r, i) => (
        <motion.div key={r.label} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.03 }} title={`${r.label}: ~${Math.round(r.p50)} ₾`} style={{ textAlign: 'center' }}>
          <div style={{ height: 14, borderRadius: 5, background: STRIP_COLOR[weatherOf(r.pBelow)], opacity: r.p50 < cushion ? 1 : 0.85, boxShadow: r.p50 < cushion ? 'inset 0 0 0 2px rgba(0,0,0,0.15)' : undefined }} />
          {labels && <div style={{ fontSize: 9.5, color: '#8193a5', marginTop: 2 }}>{r.label.split(' ')[1]}</div>}
        </motion.div>
      ))}
    </div>
  )
}
