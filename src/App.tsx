import { useEffect, useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, Tab, evolutionStage } from './state/store'
import { getEngine } from './engine/engine'
import { PERSONAS } from './engine/personas'
import { Home } from './screens/Home'
import { Jikho } from './components/Jikho'
import { Toasts } from './components/ui'
import { IconRoad, IconChart, IconVillage, IconLearn } from './components/Icons'
import qrcode from 'qrcode-generator'

const Analytics = lazy(() => import('./screens/Analytics').then(m => ({ default: m.Analytics })))
const Chat = lazy(() => import('./screens/Chat').then(m => ({ default: m.Chat })))
const Village = lazy(() => import('./screens/Village').then(m => ({ default: m.Village })))
const Day = lazy(() => import('./screens/Day').then(m => ({ default: m.Day })))

const TABS: { id: Tab; label: string; Ico: ((p: { on?: boolean }) => JSX.Element) | null }[] = [
  { id: 'road', label: 'გზა', Ico: IconRoad },
  { id: 'analytics', label: 'ანალიზი', Ico: IconChart },
  { id: 'chat', label: 'ჯიხო', Ico: null },
  { id: 'village', label: 'სოფელი', Ico: IconVillage },
  { id: 'day', label: 'სწავლა', Ico: IconLearn },
]
export const PUBLIC_URL = 'https://until-paycheck.vercel.app/'
/** on a public host (e.g. Vercel) the QR points to the site itself; locally and inside claude.ai it falls back */
function qrUrl() {
  try {
    const { protocol, hostname, origin } = window.location
    const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')
    if (protocol === 'https:' && !local && !hostname.includes('claude')) return origin
  } catch { /* ignore */ }
  return PUBLIC_URL
}

const TRY_STEPS: { title: string; hint: string; tab: Tab; kind: 'buy' | 'ask' | 'next' | 'play'; texts?: string[] }[] = [
  { title: 'ყიდვამდე შეამოწმე', hint: '100 ₾ — როგორ იცვლება ამინდი', tab: 'road', kind: 'buy' },
  { title: 'ტელეფონი განვადებით', hint: 'ჯიხო 1 200 ₾-ს დაითვლის', tab: 'chat', kind: 'ask', texts: ['1 200 ₾-ის ტელეფონი განვადებით'] },
  { title: 'აპრილამდე რომ დაიცადო?', hint: 'ახლა თუ აპრილში — შედარება', tab: 'chat', kind: 'ask', texts: ['1 200 ₾-ის ტელეფონი განვადებით', 'და თუ აპრილამდე დავიცადო?'] },
  { title: 'შემდეგი დღე', hint: 'გაიარე გზა ხელფასამდე', tab: 'road', kind: 'next' },
  { title: 'ითამაშე ეს თვე', hint: 'ხელფასიდან ხელფასამდე, ერთ წუთში', tab: 'road', kind: 'play' },
]

function QR({ text, size = 132 }: { text: string; size?: number }) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  const cells: string[] = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c} ${r}h1v1h-1z`)
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges" style={{ background: '#fff', borderRadius: 12 }}>
      <path d={cells.join('')} fill="#1f3b57" />
    </svg>
  )
}

export function App() {
  const [ready, setReady] = useState(false)
  const tab = useStore(s => s.tab)
  const setTab = useStore(s => s.setTab)
  const personaId = useStore(s => s.personaId)
  const game = useStore(s => s.games[s.personaId])
  const gameOff = useStore(s => s.gameOff)

  // the "try it" steps beside the phone run the demo on the phone itself (the game step hides with the game)
  const steps = TRY_STEPS.filter(st => !(gameOff && st.kind === 'play'))
  const [tried, setTried] = useState<number[]>([])
  const runStep = (i: number) => {
    const st = steps[i]
    const n = Date.now()
    setTab(st.tab)
    useStore.getState().setCue(st.kind === 'ask' ? { kind: 'ask', texts: st.texts, n } : { kind: st.kind, n })
    setTried(t => (t.includes(i) ? t : [...t, i]))
  }

  useEffect(() => {
    const t = setTimeout(() => { getEngine(PERSONAS.find(p => p.id === personaId)!); setReady(true) }, 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="stage">
      <aside className="side">
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <Jikho size={64} mood="happy" stage={1} accessories={['scarf']} bob={false} />
          <div>
            <h1 style={{ fontSize: 30, margin: 0 }}>ხელფასამდე</h1>
            <div className="sub" style={{ margin: 0 }}>შენი ფულის ამინდის პროგნოზი</div>
          </div>
        </div>

        <div className="try">
          <div className="try-head">
            <span>სცადე</span>
            <span className="try-tip">დააჭირე და ტელეფონზე გაიხსნება</span>
          </div>
          {steps.map((st, i) => {
            const isDone = tried.includes(i)
            const isNext = i === steps.findIndex((_, k) => !tried.includes(k))
            return (
              <motion.button key={st.title} whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }} className={'try-step' + (isDone ? ' done' : '') + (isNext ? ' next' : '')} onClick={() => runStep(i)}>
                <span className="try-num">{isDone ? '✓' : i + 1}</span>
                <span className="try-text">
                  <b>{st.title}</b>
                  <span>{st.hint}</span>
                </span>
                <span className="try-go">›</span>
              </motion.button>
            )
          })}
        </div>

        <div className="try-qr">
          <QR text={qrUrl()} size={96} />
          <div>
            <b>გახსენი ტელეფონზე</b>
            <div className="muted small">კამერით დაასკანერე</div>
          </div>
        </div>

      </aside>
      <div className="phone">
        <Toasts />
        {!ready ? (
          <Splash />
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div key={tab + personaId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
                <Suspense fallback={<div style={{ flex: 1 }} />}>
                  {tab === 'road' && <Home />}
                  {tab === 'analytics' && <Analytics />}
                  {tab === 'chat' && <Chat />}
                  {tab === 'village' && <Village />}
                  {tab === 'day' && <Day />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
            <nav className="nav">
              {TABS.filter(t => !(gameOff && t.id === 'village')).map(t => (
                <button key={t.id} className={(tab === t.id ? 'on ' : '') + (t.id === 'chat' ? 'center' : '')} onClick={() => { if (t.id === 'analytics' && tab !== 'analytics') useStore.getState().setAnalyticsSeg('payday'); setTab(t.id) }}>
                  {t.id === 'chat' ? (
                    <span className="bubble"><Jikho size={50} mood={tab === 'chat' ? 'talking' : 'happy'} stage={evolutionStage(game)} bob={false} /></span>
                  ) : (
                    <motion.span className="ico" animate={{ y: tab === t.id ? -2 : 0, scale: tab === t.id ? 1.08 : 1 }}>{t.Ico && <t.Ico on={tab === t.id} />}</motion.span>
                  )}
                  {t.label}
                </button>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  )
}

function Splash() {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#7cc7ff,#e4f5ff)' }}>
      <div style={{ textAlign: 'center' }}>
        <Jikho size={150} mood="thinking" walking />
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1f3b57', marginTop: 8 }}>ხელფასამდე</div>
        <div className="muted">ჯიხო ამინდს ითვლის… 1 000 სცენარი</div>
      </div>
    </div>
  )
}
