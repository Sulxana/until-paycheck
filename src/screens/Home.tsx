import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, evolutionStage, LANDMARKS, COSMETIC_POOL } from '../state/store'
import { useToday, gel, fmt, rangeText } from '../engine/view'
import { RoadScene } from '../components/RoadScene'
import { Jikho, JikhoMood } from '../components/Jikho'
import { Sheet, PhonePortal, RangeBar, WeatherChip, Disclaimer, BankChip, WEMOJI } from '../components/ui'
import { BANK_META, PERSONAS } from '../engine/personas'
import { WeatherKind, WEATHER_LABEL } from '../engine/engine'
import { TowerPlace } from '../components/village/Places'
import { Confetti } from '../components/day/parts'

const r5 = (v: number) => Math.round(v / 5) * 5
const r10 = (v: number) => Math.round(v / 10) * 10
const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v))

export function daysOfSpendText(p50: number, avg: number) {
  const d = p50 / avg
  if (p50 <= 0) return 'ხარჯისთვის აღარაფერი რჩება'
  if (d < 1.5) return 'დაახლოებით ერთი დღის ხარჯი'
  return `დაახლოებით ${Math.round(d)} დღის ხარჯი`
}

export function jikhoLine(w: WeatherKind): string {
  return {
    sun: 'გზა მზიანია! ამ ტემპით ზღვარს ზემოთ ჩავალთ.',
    cloud: 'ცოტა ღრუბლიანია, მაგრამ გზა გასავლელია. თვალი ვადევნოთ.',
    rain: 'წვიმს… ხელფასამდე გზა მჭიდროა. ქოლგა მზად მაქვს.',
    storm: 'ქარიშხალია. გადაწყვეტილება შენია — მე უბრალოდ ამინდს გაჩვენებ.',
  }[w]
}
export const moodFor = (w: WeatherKind): JikhoMood => (w === 'sun' ? 'happy' : w === 'cloud' ? 'calm' : 'worried')

export function Home() {
  const v = useToday()
  const { e, p } = v
  const game = useStore(s => s.games[p.id])
  const demo = useStore(s => s.demos[p.id])
  const gameOff = useStore(s => s.gameOff)
  const setTab = useStore(s => s.setTab)
  const advanceDay = useStore(s => s.advanceDay)
  const [buyOpen, setBuyOpen] = useState(false)
  const [personaOpen, setPersonaOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [preview, setPreview] = useState<WeatherKind | null>(null)
  const stage = evolutionStage(game)
  const weather = preview ?? v.weather
  const idx = e.demoPathIndex()

  const step = () => advanceDay(v.nDays, (day, extra) => ({ landing: Math.round(e.forecastAtDay(day, idx, extra).balance), cushion: e.cushion }))

  return (
    <div className="screen" style={{ background: 'var(--paper)' }}>
      {/* top bar over the scene */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3, padding: '14px 14px 0' }} className="between">
        <button className="chip" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', padding: '6px 10px 6px 6px' }} onClick={() => setPersonaOpen(true)}>
          <span style={{ width: 26, height: 26, borderRadius: 13, background: '#1f3b57', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{p.name[0]}</span>
          {p.name} <span className="muted">▾</span>
        </button>
        <div className="row" style={{ gap: 6 }}>
          {!gameOff && (
            <span className="chip" style={{ background: 'rgba(255,255,255,0.85)' }} title="სერია">{v.hardship ? '❄ გაყინულია' : `🏮 ${game.streak}`}</span>
          )}
          <button className="chip" style={{ background: 'rgba(255,255,255,0.85)' }} onClick={() => setSettingsOpen(true)} aria-label="პარამეტრები">⚙️</button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <RoadScene weather={weather} nDays={v.nDays} day={v.day} labels={p.dayLabels} paydayLabel={p.paydayLabel.split(', ')[1]} mood={v.hardship ? 'calm' : preview ? moodFor(preview) : demo.finished ? 'celebrate' : moodFor(weather)} stage={stage} accessories={gameOff ? [] : game.equipped} height={300} walking={!demo.finished} />
        {/* time machine */}
        <div style={{ position: 'absolute', right: 12, bottom: 50, zIndex: 2 }} className="row">
          {!demo.finished ? (
            <motion.button whileTap={{ scale: 0.92 }} className="chip" style={{ background: '#1f3b57', color: '#fff', padding: '8px 12px', boxShadow: 'var(--shadow)' }} onClick={step}>
              ⏩ {v.daysLeft > 1 ? 'შემდეგი დღე' : 'ხელფასის დღე!'}
            </motion.button>
          ) : (
            <button className="chip" style={{ background: '#fff', boxShadow: 'var(--shadow)' }} onClick={() => useStore.getState().resetDemo()}>↺ დემოს თავიდან</button>
          )}
        </div>
      </div>

      {/* forecast card */}
      <div className="pad" style={{ marginTop: -44, position: 'relative', zIndex: 2 }}>
        <motion.div className="card" layout style={{ padding: 18 }}>
          {v.hardship && (
            <div style={{ background: '#eef2f7', borderRadius: 14, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
              🤝 <b>გაჭირვების რეჟიმი.</b> სერია გაყინულია, არაფერი იკარგება. ჯიხო გაჩვენებს, რომელი გადასახადი რა რიგით დაფაროს და როგორ ვისაუბროთ ბანკთან.
            </div>
          )}
          <div className="between">
            <div className="muted small" style={{ fontWeight: 700 }}>{demo.finished ? 'ჩახვედი ხელფასამდე' : 'ხელფასის დღეს დაგრჩება'}</div>
            <div className="small muted">{demo.finished ? p.paydayLabel : `${v.daysLeft} დღე ხელფასამდე`}</div>
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <motion.div key={v.landing.p50} initial={{ opacity: 0.4, y: 6 }} animate={{ opacity: 1, y: 0 }} className="big">
              {demo.finished ? gel(Math.round(v.balance)) : `~${fmt(r10(v.landing.p50))} ₾`}
            </motion.div>
            {!demo.finished && <div className="muted small">{rangeText(r10(v.landing.p10), r10(v.landing.p90))}</div>}
          </div>
          {!demo.finished && (
            <>
              <div style={{ marginTop: 10 }}><WeatherChip w={v.weather} p={v.landing.pBelow} /></div>
              <RangeBar p10={v.landing.p10} p50={v.landing.p50} p90={v.landing.p90} cushion={e.cushion} />
              <div className="between tiny muted" style={{ marginTop: 4 }}>
                <span>სანდოობა {'●'.repeat(p.confidence)}{'○'.repeat(5 - p.confidence)} · {p.historyMonths} თვის ისტორია</span>
                <span>{daysOfSpendText(v.landing.p50, e.avgDaily)}</span>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* mini cards */}
      {!demo.finished && (
        <div className="pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="tiny muted" style={{ fontWeight: 700 }}>დღეს თავისუფლად</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>~{gel(v.safeToday)}</div>
            <div className="tiny muted">ჩვეულებრივ ხარჯს ზემოთ</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="tiny muted" style={{ fontWeight: 700 }}>შემდეგი გადასახადი</div>
            {v.nextBill ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{v.nextBill.name}</div>
                <div className="tiny muted">{gel(v.nextBill.amount)} · {v.nextBill.inDays === 0 ? 'დღეს' : v.nextBill.inDays === 1 ? 'ხვალ' : v.nextBill.date}</div>
              </>
            ) : (
              <div className="small" style={{ fontWeight: 700, marginTop: 4 }}>ხელფასამდე აღარაფერი ✓</div>
            )}
          </div>
        </div>
      )}

      {/* banks */}
      <div className="pad" style={{ marginTop: 12 }}>
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="small" style={{ fontWeight: 800 }}>ხელმისაწვდომი: {gel(Math.round(v.balance))}</span>
          <span className="tag">ამონაწერიდან · {p.balances.length + (p.savings ? 1 : 0)} ბანკი</span>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {p.balances.map(b => <BankChip key={b.bank} label={BANK_META[b.bank].label} amount={b.amount} color={BANK_META[b.bank].color} />)}
          {p.savings && <BankChip label={`${BANK_META[p.savings.bank].label} · რეზერვი`} amount={p.savings.amount} color={BANK_META[p.savings.bank].color} muted />}
          {p.overdraft && <span className="chip" style={{ background: '#fdecea', color: '#b4413b' }}>ოვერდრაფტი {gel(p.overdraft.used)} / {gel(p.overdraft.limit)}</span>}
        </div>
        {v.extra > 0 && <div className="tiny muted" style={{ marginTop: 6 }}>შენ მიერ ამ ციკლში ჩაწერილი შესყიდვები: {gel(v.extra)}</div>}
      </div>

      {/* actions */}
      <div className="pad" style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        {!demo.finished && (
          <motion.button whileTap={{ scale: 0.97 }} className="pill-btn btn-sun" onClick={() => setBuyOpen(true)}>🛍️ რამის ყიდვა გინდა? შეამოწმე</motion.button>
        )}
        <motion.button whileTap={{ scale: 0.97 }} className="pill-btn btn-white" onClick={() => setTab('chat')}>
          <Jikho size={30} mood="talking" stage={stage} bob={false} /> განვადება ან სესხი? ჰკითხე ჯიხოს
        </motion.button>
      </div>

      {/* quest */}
      {!gameOff && (
        <div className="pad" style={{ margin: '14px 0 24px' }}>
          <button className="card" style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', background: game.morningDone ? '#f1f8f2' : 'linear-gradient(120deg,#fff7e0,#ffffff)' }} onClick={() => setTab('day')}>
            <div style={{ fontSize: 28 }}>{game.morningDone ? '✅' : '☀️'}</div>
            <div style={{ flex: 1 }}>
              <div className="h3">{game.morningDone ? 'დილის გაკვეთილი შესრულდა' : 'დილის ამინდი · 3 კითხვა'}</div>
              <div className="small muted">{game.morningDone ? 'საღამოს 40 წამი — დღის დახურვა' : '2 წუთი · შენივე რიცხვებით · სერია ანათებს'}</div>
            </div>
            <div className="muted">›</div>
          </button>
        </div>
      )}
      <Disclaimer />
      <div style={{ height: 16 }} />

      <PurchaseSheet open={buyOpen} onClose={() => { setBuyOpen(false); setPreview(null) }} onPreview={setPreview} />
      <PersonaSheet open={personaOpen} onClose={() => setPersonaOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Ceremony />
    </div>
  )
}

function PurchaseSheet({ open, onClose, onPreview }: { open: boolean; onClose: () => void; onPreview: (w: WeatherKind | null) => void }) {
  const v = useToday()
  const { e, p } = v
  const reward = useStore(s => s.reward)
  const buy = useStore(s => s.buy)
  const toast = useStore(s => s.toast)
  const stage = evolutionStage(useStore(s => s.games[p.id]))
  const [amount, setAmount] = useState('100')
  const [result, setResult] = useState<null | { amount: number; p10: number; p50: number; p90: number; pBelow: number; weather: WeatherKind; inTen: number; afterPayday: number }>(null)
  const n = Number(amount) || 0

  const check = () => {
    if (!n) return
    const canonical = v.day === 0 && v.extra === 0
    const r = canonical ? e.purchaseCheck(n) : { ...e.forecastAtDay(v.day, e.demoPathIndex(), v.extra + n).landing, amount: n, afterPayday: Math.round(v.landing.p50 + p.salary - e.fixedTotal - e.monthlyVarMedian - n) }
    setResult(r)
    onPreview(r.weather)
  }
  const close = () => { setResult(null); onClose() }
  const decide = (bought: boolean) => {
    reward('check')
    if (bought) buy(n)
    else setTimeout(() => toast('⏳', 'ხელფასის დღეს გაჩვენებ, როგორ ჩახვედი'), 900)
    close()
  }
  const press = (k: string) => setAmount(a => (k === '⌫' ? a.slice(0, -1) : (a === '0' ? k : a + k).slice(0, 5)))

  return (
    <Sheet open={open} onClose={close}>
      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="h2" style={{ textAlign: 'center' }}>რამდენის დახარჯვას აპირებ?</div>
            <div style={{ textAlign: 'center', fontSize: 48, fontWeight: 800, margin: '10px 0' }}>{fmt(n)} <span style={{ fontSize: 28 }}>₾</span></div>
            <div className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              {[20, 50, 100, 300].map(x => <button key={x} className="chip" style={{ background: n === x ? '#1f3b57' : '#f2ede4', color: n === x ? '#fff' : undefined }} onClick={() => setAmount(String(x))}>{x} ₾</button>)}
            </div>
            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k ? <button key={i} onClick={() => press(k)}>{k}</button> : <span key={i} />)}
            </div>
            <button className="pill-btn btn-primary" style={{ marginTop: 14 }} onClick={check}>შეამოწმე ამინდი</button>
          </motion.div>
        ) : (
          <motion.div key="out" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="row" style={{ justifyContent: 'center', gap: 14, fontSize: 40, margin: '4px 0 6px' }}>
              <span>{WEMOJI[v.weather]}</span>
              <motion.span initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }} style={{ fontSize: 24, color: 'var(--ink-3)' }}>→</motion.span>
              <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: 'spring' }}>{WEMOJI[result.weather]}</motion.span>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>{WEATHER_LABEL[v.weather]} → {WEATHER_LABEL[result.weather]}</div>
            <div className="card" style={{ marginTop: 12, fontSize: 15, lineHeight: 1.55 }}>
              თუ დღეს <b>{gel(result.amount)}</b> დახარჯავ, ხელფასის დღეს სავარაუდოდ <b>~{fmt(r5(result.p50))} ₾</b> დაგრჩება ({signed(r5(result.p10))}…{signed(r5(result.p90))}) — {daysOfSpendText(result.p50, e.avgDaily)}. 10 მსგავსი თვიდან <b>{result.inTen}-ში</b> {fmt(e.cushion)}-ლარიან ზღვარს ქვემოთ ჩახვიდოდი. ხელფასი {v.daysLeft} დღეშია.
              <RangeBar p10={result.p10} p50={result.p50} p90={result.p90} cushion={e.cushion} compare={{ p10: v.landing.p10, p50: v.landing.p50, p90: v.landing.p90 }} />
              <div className="tiny muted" style={{ marginTop: 2 }}>წყვეტილი ზოლი — შესყიდვის გარეშე</div>
            </div>
            <div className="chip" style={{ marginTop: 10, whiteSpace: 'normal', background: result.afterPayday >= e.cushion ? '#e8f6ec' : '#fff4dc' }}>
              {result.afterPayday >= e.cushion ? `ხელფასის შემდეგ იგივე ${gel(result.amount)} ზღვარს ზემოთ გტოვებს (~${fmt(r10(result.afterPayday))} ₾ მარაგით)` : `ხელფასის შემდეგაც მჭიდრო იქნება (~${fmt(r10(result.afterPayday))} ₾)`}
            </div>
            <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <Jikho size={64} mood={moodFor(result.weather)} stage={stage} accessories={result.weather === 'storm' || result.weather === 'rain' ? ['umbrella'] : []} />
              <div className="card" style={{ flex: 1, padding: 12, fontSize: 13, borderTopLeftRadius: 6 }}>{jikhoLine(result.weather)} ორივე არჩევანი ხიდზე ერთ ფიცარს მატებს 🪵</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button className="pill-btn btn-ghost" onClick={() => decide(false)}>⏳ დაველოდები</button>
              <button className="pill-btn btn-primary" onClick={() => decide(true)}>🛍️ ვყიდულობ</button>
            </div>
            <Disclaimer />
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  )
}

function PersonaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cur = useStore(s => s.personaId)
  const setPersona = useStore(s => s.setPersona)
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="h2" style={{ marginBottom: 4 }}>ვისი თვე ვნახოთ?</div>
      <div className="small muted" style={{ marginBottom: 12 }}>სინთეტიკური პერსონები — რეალური ადამიანების მონაცემები არ გამოიყენება.</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {PERSONAS.map(pp => (
          <button key={pp.id} className="card" style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', outline: cur === pp.id ? '3px solid var(--sun)' : 'none' }} onClick={() => { setPersona(pp.id); onClose() }}>
            <span style={{ width: 44, height: 44, borderRadius: 22, background: '#1f3b57', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18 }}>{pp.name[0]}</span>
            <div style={{ flex: 1 }}>
              <div className="h3">{pp.name}, {pp.age} · {pp.job}</div>
              <div className="small muted">{pp.blurb}</div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export const RED_LINES = [
  'ხარჯვა, სესხი, ტრანზაქციების რაოდენობა და აპის გახსნა არასდროს გაძლევს პროგრესს',
  'შემთხვევითობა ფულზე არასდროს ებმება; ყიდვით არაფერი იხსნება',
  'ჯიხო შენს ქმედებას ასახავს და არა ბალანსს; არასდროს კვდება, დანაზოგი არ ქრება',
  '„დაველოდები" და „ვყიდულობ" თანაბარ პროგრესს იძლევა',
  'ერთი გამჭვირვალე სერია, აღდგენით და დღესასწაულებზე ავტო-გაყინვით',
  'შეტყობინებები მხოლოდ თანხმობით, დღეში მაქსიმუმ ორი',
  'გაჭირვების რეჟიმი ყველა წნეხს ანაცვლებს',
  'თამაშის გამორთვა სრულ ინსტრუმენტს ტოვებს',
  'ბანკის ფლოუში თამაში და ჯილდო არ არსებობს',
  'სოციალურში მხოლოდ გაუმჯობესება, არასდროს ბალანსი',
]

function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const gameOff = useStore(s => s.gameOff)
  const setGameOff = useStore(s => s.setGameOff)
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="h2">პარამეტრები</div>
      <div className="card between" style={{ marginTop: 12 }}>
        <div><div className="h3">თამაშის გამორთვა</div><div className="small muted">პროგნოზი, შემოწმება და გაკვეთილები რჩება</div></div>
        <button onClick={() => setGameOff(!gameOff)} style={{ width: 52, height: 30, borderRadius: 15, background: gameOff ? '#1f3b57' : '#d9d0c2', position: 'relative' }}>
          <motion.span animate={{ x: gameOff ? 22 : 0 }} style={{ position: 'absolute', top: 3, left: 3, width: 24, height: 24, borderRadius: 12, background: '#fff' }} />
        </button>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="h3" style={{ marginBottom: 8 }}>🛡️ სამართლიანი თამაშის 10 წესი</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>{RED_LINES.map(l => <li key={l}>{l}</li>)}</ol>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <button className="pill-btn btn-ghost" onClick={() => { useStore.getState().resetDemo(); onClose() }}>↺ ამ პერსონის დემო</button>
        <button className="pill-btn btn-ghost" onClick={() => { useStore.getState().resetAll(); onClose() }}>↺ ყველაფერი</button>
      </div>
      <div className="disclaimer" style={{ marginTop: 10 }}>მუშა პროტოტიპი სინთეტიკურ მონაცემებზე · ბანკთან კავშირი ჯერ არ არის · ძრავა v0, seed 20261102</div>
    </Sheet>
  )
}

function Ceremony() {
  const v = useToday()
  const { p } = v
  const demo = useStore(s => s.demos[p.id])
  const game = useStore(s => s.games[p.id])
  const close = useStore(s => s.closeCeremony)
  const reward = useStore(s => s.reward)
  const choose = useStore(s => s.chooseCosmetic)
  const [pledged, setPledged] = useState(false)
  const c = demo.ceremony
  const landmark = LANDMARKS[(game.cycles - 1) % LANDMARKS.length]
  return (
    <PhonePortal>
    <AnimatePresence>
      {c && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 30, background: c.safe ? 'linear-gradient(180deg,#ffe9a8,#fff8e6 55%)' : 'linear-gradient(180deg,#dfe8f1,#f6f8fb 55%)', overflowY: 'auto', padding: '30px 18px 24px' }}>
          {c.safe && <Confetti n={28} />}
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <motion.div initial={{ scale: 0.3, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 10 }}>
              <Jikho size={150} mood={c.safe ? 'celebrate' : 'calm'} stage={evolutionStage(game)} accessories={game.equipped} />
            </motion.div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{c.safe ? 'ჩავედით! 🎉' : 'ჩავედით ხელფასამდე'}</div>
            <div className="muted" style={{ marginTop: 4 }}>{p.paydayLabel} · ხელფასის დილით</div>
            <div className="big" style={{ marginTop: 12 }}>{gel(c.landing)}</div>
            <div className="small" style={{ marginTop: 6, fontWeight: 700, color: c.safe ? 'var(--good)' : 'var(--ink-2)' }}>
              {c.safe ? `ზღვარს ${gel(c.landing - c.cushion)}-ით ზემოთ — უსაფრთხო ჩასვლა` : `ამჯერად ზღვარს (${gel(c.cushion)}) ქვემოთ. არაფერი იკარგება.`}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
            {c.safe && (
              <motion.div className="card row" initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }} style={{ gap: 16 }}>
                <div style={{ width: 92, height: 160, borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(180deg,#8fd0ff,#e4f5ff 70%,#9fd39c 70%)', flexShrink: 0 }}>
                  <svg viewBox="-4 70 84 156" width="92" height="160"><TowerPlace stones={game.stones} /></svg>
                </div>
                <div>
                  <div className="h3">კოშკს ახალი ქვა დაემატა</div>
                  <div style={{ fontSize: 34, fontWeight: 800, margin: '4px 0' }}>{game.stones}<span className="muted" style={{ fontSize: 18 }}>/12</span></div>
                  <div className="small muted">უსაფრთხო ჩასვლა. ქვა არასდროს იკარგება · 12 = სახურავი და დროშა</div>
                </div>
              </motion.div>
            )}
            <motion.div className="card row" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.8 }}>
              <div style={{ fontSize: 34, width: 56, textAlign: 'center' }}>{landmark.icon}</div>
              <div><div className="h3">რუკაზე ახალი ადგილი: {landmark.name}</div><div className="small muted">მგზავრობა დასრულდა · {game.cycles}/12 ამ წელს</div></div>
            </motion.div>
            {!c.safe && (
              <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                <div className="h3">რა არ ვიცოდით</div>
                <div className="small" style={{ marginTop: 4 }}>{v.extra > 0 ? `ამ ციკლში ${gel(v.extra)}-ის შესყიდვა ჩაიწერა — ძრავამ ეს დილის პროგნოზში ვერ დაინახა.` : 'მოულოდნელი ხარჯი, რომელიც ისტორიაში არ ჩანდა.'} შემდეგ ციკლზე დიაპაზონს ვაფართოებთ და სანდოობას ვამცირებთ. სერია და სოფელი ხელუხლებელია.</div>
              </motion.div>
            )}
            <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
              <div className="h3">💰 ხელფასი ჩამოვიდა: +{gel(p.salary)}</div>
              {p.savings && !pledged && (
                <>
                  <div className="small muted" style={{ margin: '4px 0 10px' }}>ახლავე გადავდო ქვევრში „{p.savings.name}"?</div>
                  <div className="row">
                    {[100, 50].map(a => <button key={a} className="chip" style={{ background: '#1f3b57', color: '#fff', padding: '8px 14px' }} onClick={() => { reward('save', a); setPledged(true) }}>{a} ₾</button>)}
                    <button className="chip" onClick={() => setPledged(true)}>ამ თვეში არა</button>
                  </div>
                </>
              )}
              {pledged && <div className="small" style={{ marginTop: 6 }}>✓ შენი გადაწყვეტილება ჩაიწერა</div>}
            </motion.div>
            {game.pendingChoice && (
              <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
                <div className="h3">🎁 აირჩიე საჩუქარი ჯიხოსთვის (1 სამიდან)</div>
                <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
                  {game.pendingChoice.map(a => (
                    <button key={a} onClick={() => choose(a)} style={{ textAlign: 'center', flex: 1 }}>
                      <Jikho size={70} stage={evolutionStage(game)} accessories={[a]} bob={false} />
                      <div className="tiny" style={{ fontWeight: 700 }}>{COSMETIC_POOL.find(x => x.id === a)?.name}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
          <button className="pill-btn btn-primary" style={{ marginTop: 16 }} onClick={close}>ახალი გზა შემდეგ ხელფასამდე →</button>
        </motion.div>
      )}
    </AnimatePresence>
    </PhonePortal>
  )
}

export function Tower({ stones, size = 56 }: { stones: number; size?: number }) {
  const n = Math.min(12, stones)
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 40 56">
      <rect x="6" y="52" width="28" height="3" rx="1.5" fill="#bba98d" />
      {Array.from({ length: n }).map((_, i) => (
        <motion.rect key={i} x={9 + (i % 2) * 0.6} y={48 - i * 3.6} width="22" height="3.2" rx="1" fill={i % 2 ? '#cfc3ae' : '#b9aa90'} initial={i === n - 1 ? { y: -20, opacity: 0 } : false} animate={{ y: 48 - i * 3.6, opacity: 1 }} transition={{ type: 'spring', damping: 9, delay: 0.7 }} />
      ))}
      {n >= 12 && <path d="M7 6 L20 -2 L33 6 Z" fill="#7a5a3a" />}
    </svg>
  )
}
