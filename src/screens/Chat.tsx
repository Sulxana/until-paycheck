import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, evolutionStage, ChatMsg } from '../state/store'
import { useEngine, usePersona, gel, fmt } from '../engine/view'
import { Jikho, JikhoMood } from '../components/Jikho'
import { RangeBar, WEMOJI } from '../components/ui'
import { FanChart, MonthStrip } from '../components/FanChart'
import { respond, greeting, Ctx, START_CHIPS } from '../chat/responder'
import { WEATHER_LABEL } from '../engine/engine'

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
          <div className="tiny muted">{typing ? 'ითვლის 1 000 სცენარს…' : 'შენი ფინანსური თანამგზავრი · ინფორმაცია, არა რჩევა'}</div>
        </div>
        <span className="tag" style={{ background: '#e3f4e8', color: '#2f7a4c' }}>● ოფლაინ</span>
      </div>

      <div ref={listRef} className="screen" style={{ padding: '12px 12px 6px' }}>
        <AnimatePresence initial={false}>
          {msgs.map(m => <Bubble key={m.id} m={m} stage={stage} />)}
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
        <form className="row" onSubmit={ev => { ev.preventDefault(); send(text) }} style={{ background: '#fff', borderRadius: 18, padding: '6px 6px 6px 14px', boxShadow: 'var(--shadow-sm)' }}>
          <input value={text} onChange={ev => setText(ev.target.value)} placeholder="მაგ.: 300 ლარის ფეხსაცმელი ვიყიდო?" style={{ flex: 1, border: 0, outline: 'none', fontSize: 15, background: 'transparent', minWidth: 0 }} />
          <motion.button whileTap={{ scale: 0.9 }} type="submit" style={{ width: 40, height: 40, borderRadius: 14, background: text.trim() ? '#1f3b57' : '#d9d0c2', color: '#fff', fontSize: 18 }} aria-label="გაგზავნა">↑</motion.button>
        </form>
      </div>
    </div>
  )
}

function Bubble({ m, stage }: { m: ChatMsg; stage: 0 | 1 | 2 | 3 }) {
  const mine = m.from === 'user'
  return (
    <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 22, stiffness: 280 }} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', margin: '6px 0' }}>
      <div style={{ maxWidth: '88%' }}>
        <div style={{
          background: mine ? '#1f3b57' : '#fff', color: mine ? '#fff' : 'var(--ink)', padding: '10px 13px', borderRadius: mine ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
          boxShadow: 'var(--shadow-sm)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-line',
        }}>{m.text}</div>
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
        <div className="tiny muted" style={{ marginTop: 2 }}>{WEATHER_LABEL[d.base.weather as keyof typeof WEATHER_LABEL]} → {WEATHER_LABEL[d.r.weather as keyof typeof WEATHER_LABEL]} · 10-დან {d.r.inTen} ზღვარს ქვემოთ</div>
        <RangeBar p10={d.r.p10} p50={d.r.p50} p90={d.r.p90} cushion={d.cushion} compare={d.base} />
        <div className="tiny muted">წყვეტილი — შესყიდვის გარეშე · ხელფასის შემდეგ: ~{fmt(Math.round(d.afterPayday / 10) * 10)} ₾</div>
        <div className="disclaimer" style={{ textAlign: 'left' }}>ℹ️ ინფორმაციაა, არა რჩევა. 1 000 სცენარი შენი ისტორიიდან.</div>
      </div>
    )
  }
  if (card.kind === 'installment') {
    return (
      <div className="card" style={{ padding: 14 }}>
        <div className="small" style={{ fontWeight: 800, marginBottom: 8 }}>{d.title}</div>
        {d.compare && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: '#fdecea', borderRadius: 14, padding: '10px 12px' }}>
                <div className="tiny" style={{ fontWeight: 800, color: '#b4413b' }}>ახლა</div>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>⛈️ {d.compare.nowShort}</div>
                <div className="tiny muted">თვე ზღვარს ქვემოთ</div>
              </div>
              <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: 'spring', damping: 11 }} style={{ background: '#e6f6ea', borderRadius: 14, padding: '10px 12px' }}>
                <div className="tiny" style={{ fontWeight: 800, color: 'var(--good)' }}>{d.rows[0]?.label?.includes('აპრილ') ? 'აპრილიდან' : 'მოგვიანებით'}</div>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{d.compare.short === 0 ? '☀️ 0' : `🌥️ ${d.compare.short}`}</div>
                <div className="tiny muted">თვე ზღვარს ქვემოთ</div>
              </motion.div>
            </div>
            {d.compare.cost24 > d.compare.cost && (
              <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }} className="between" style={{ marginTop: 8, background: '#1f3b57', color: '#fff', borderRadius: 14, padding: '10px 12px' }}>
                <span className="small">პროცენტი {gel(d.compare.cost)}, არა {gel(d.compare.cost24)}</span>
                <b style={{ color: '#ffd977', fontSize: 20, whiteSpace: 'nowrap' }}>−{gel(d.compare.cost24 - d.compare.cost)}</b>
              </motion.div>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gap: 10 }}>
          {d.rows.map((r: any) => (
            <div key={r.label} style={{ border: '1px solid #eee5d8', borderRadius: 14, padding: 10 }}>
              <div className="between">
                <span className="small" style={{ fontWeight: 800 }}>{r.label}</span>
                <span style={{ fontWeight: 800, fontSize: 18 }}>{fmt(r.monthly, r.monthly % 1 ? 1 : 0)} ₾<span className="tiny muted">/თვე</span></span>
              </div>
              <div className="row tiny muted" style={{ gap: 10, margin: '4px 0 8px', flexWrap: 'wrap' }}>
                <span>სულ <b style={{ color: 'var(--ink)' }}>{gel(r.total)}</b></span>
                <span>კრედიტის ფასი <b style={{ color: r.cost ? '#b4413b' : 'var(--good)' }}>{gel(r.cost)}</b></span>
                {r.eir > 0 && <span>ეფექტური {fmt(r.eir, 1)}%</span>}
                <span>PTI ~{fmt(r.pti, 1)}%</span>
              </div>
              <MonthStrip rows={r.window.slice(0, 12)} cushion={d.cushion} compact />
              <div className="tiny" style={{ marginTop: 6, fontWeight: 700, color: r.nShort ? '#b4413b' : 'var(--good)' }}>
                {r.nShort ? `${r.nShort} თვე ზღვარს ქვემოთ (მედიანით)` : 'ყველა თვე ზღვარს ზემოთ'}
              </div>
            </div>
          ))}
        </div>
        <div className="tiny muted" style={{ marginTop: 8 }}>🟩 მზიანი · 🟨 ღრუბლიანი · 🟧 წვიმიანი · 🟥 ქარიშხალი — ხელფასამდე ყოველ თვეს. {d.note ?? ''}</div>
        <div className="disclaimer" style={{ textAlign: 'left' }}>ℹ️ ინფორმაციაა, არა რჩევა. ვადები ვადის მიხედვითაა, არცერთი არ არის მონიშნული. ერთ ხელფასზე შორს — ექსტრაპოლაცია.</div>
      </div>
    )
  }
  if (card.kind === 'forecast') {
    return (
      <div className="card" style={{ padding: 12 }}>
        <FanChart data={d.fan} cushion={d.cushion} height={150} />
        <div className="tiny muted">ზოლი — 10 მსგავსი თვიდან 8 · ხაზი — ყველაზე სავარაუდო</div>
      </div>
    )
  }
  if (card.kind === 'safe') {
    return (
      <div className="card" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><div className="tiny muted" style={{ fontWeight: 700 }}>დღეს თავისუფლად</div><div style={{ fontSize: 26, fontWeight: 800 }}>~{gel(d.safe)}</div><div className="tiny muted">ჩვეულ ხარჯს ზემოთ</div></div>
        <div><div className="tiny muted" style={{ fontWeight: 700 }}>ერთჯერადი შესყიდვა</div><div style={{ fontSize: 26, fontWeight: 800 }}>≤{gel(d.max)}</div><div className="tiny muted">ამინდი ღრუბლიანზე უარესი არ ხდება</div></div>
      </div>
    )
  }
  if (card.kind === 'concept') {
    return (
      <div className="card" style={{ padding: 14, background: 'linear-gradient(135deg,#fff,#f6f1ff)' }}>
        <div className="h3">📘 {d.title}</div>
        <div className="small" style={{ marginTop: 8, background: '#fff7e0', borderRadius: 10, padding: '8px 10px' }}><b>შენთვის:</b> {d.mine}</div>
        <div className="small" style={{ marginTop: 6 }}><b>წესი:</b> {d.rule}</div>
      </div>
    )
  }
  return null
}
