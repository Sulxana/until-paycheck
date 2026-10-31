import { useEffect, useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, Tab, evolutionStage } from './state/store'
import { getEngine } from './engine/engine'
import { PERSONAS } from './engine/personas'
import { Home } from './screens/Home'
import { Jikho } from './components/Jikho'
import { Toasts } from './components/ui'
import { IconRoad, IconChart, IconVillage, IconDay } from './components/Icons'
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
  { id: 'day', label: 'დღე', Ico: IconDay },
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

  useEffect(() => {
    const t = setTimeout(() => { getEngine(PERSONAS.find(p => p.id === personaId)!); setReady(true) }, 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="stage">
      <aside className="side">
        <Jikho size={84} mood="happy" stage={1} accessories={['scarf']} />
        <h1 style={{ fontSize: 34, marginTop: 6 }}>ხელფასამდე</h1>
        <div className="sub" style={{ fontSize: 15 }}>შენი ფულის ამინდის პროგნოზი</div>
        <p>მუშა პროტოტიპი სინთეტიკურ მონაცემებზე. ძრავა ბრაუზერში ითვლის — იგივე რიცხვები, რაც ჩვენს ცხრილში.</p>
        <ol style={{ paddingLeft: 18, margin: '10px 0', display: 'grid', gap: 6 }}>
          <li><b>გზა:</b> „რამის ყიდვა გინდა?" → 100 ₾</li>
          <li><b>ჯიხო:</b> „1 200 ₾-ის ტელეფონი განვადებით"</li>
          <li>„და თუ აპრილამდე დავიცადო?"</li>
          <li><b>⏩ შემდეგი დღე</b> — ხელფასამდე</li>
        </ol>
        <div className="row" style={{ gap: 14, margin: '18px 0' }}>
          <QR text={qrUrl()} />
          <div className="small">გახსენი<br />ტელეფონზე<br /><span className="muted">სკანირებით</span></div>
        </div>
        <p className="muted small">ინფორმაციაა, არა რჩევა. ბანკთან კავშირი ჯერ არ არის.</p>
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
                <button key={t.id} className={(tab === t.id ? 'on ' : '') + (t.id === 'chat' ? 'center' : '')} onClick={() => setTab(t.id)}>
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
