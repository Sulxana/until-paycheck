import { useEffect, useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, Tab, evolutionStage } from './state/store'
import { getEngine } from './engine/engine'
import { PERSONAS } from './engine/personas'
import { Home } from './screens/Home'
import { Jikho } from './components/Jikho'
import { Toasts } from './components/ui'

const Analytics = lazy(() => import('./screens/Analytics').then(m => ({ default: m.Analytics })))
const Chat = lazy(() => import('./screens/Chat').then(m => ({ default: m.Chat })))
const Village = lazy(() => import('./screens/Village').then(m => ({ default: m.Village })))
const Day = lazy(() => import('./screens/Day').then(m => ({ default: m.Day })))

const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: 'road', label: 'გზა', ico: '🛤️' },
  { id: 'analytics', label: 'ანალიზი', ico: '📈' },
  { id: 'chat', label: 'ჯიხო', ico: '' },
  { id: 'village', label: 'სოფელი', ico: '🏘️' },
  { id: 'day', label: 'დღე', ico: '☀️' },
]

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
        <h1>ხელფასამდე</h1>
        <div className="sub">შენი ფულის ამინდის პროგნოზი</div>
        <p>მუშა პროტოტიპი სინთეტიკურ მონაცემებზე. ძრავა ბრაუზერში ითვლის — იგივე seed, იგივე რიცხვები, რაც ჩვენს ცხრილში.</p>
        <p><b>სცადე:</b> „რამის ყიდვა გინდა?" → 100 ₾ · ჯიხოსთან „1200 ლარის ტელეფონი განვადებით" · „⏩ შემდეგი დღე" ხელფასამდე.</p>
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
                    <span className="ico" style={{ filter: tab === t.id ? 'none' : 'grayscale(0.7)', opacity: tab === t.id ? 1 : 0.7 }}>{t.ico}</span>
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
