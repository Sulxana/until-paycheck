import { ReactNode, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Game, LANDMARKS, COSMETIC_POOL, evolutionStage, useStore, type Tab } from '../../state/store'
import { Jikho, STAGE_NAMES } from '../Jikho'
import { Sheet, Progress, InfoTip } from '../ui'
import {
  PlaceId, PLACE_BOX, TowerPlace, SchoolPlace, CellarPlace, StationPlace, BridgePlace, Stream,
  TOWER_MAX, BRIDGE_MAX, STATION_MAX, BOOKS_PER_TOPIC, INSTRUMENTS, jarPct,
} from './Places'

/* ───────────────────────── Jikho tips ───────────────────────── */

/** short lines Jikho says when tapped (the stage lives here now, not in a card) */
export function jikhoTips(g: Game, hardship: boolean): string[] {
  const s = evolutionStage(g)
  const stage = s < 3 ? `მე ახლა ${STAGE_NAMES[s]} ვარ. შემდეგი — ${STAGE_NAMES[s + 1]}.` : 'მე სოფლის უხუცესი ვარ ✓'
  // support mode: calm lines only, no countdowns
  if (hardship) return ['ახლა დასვენების დროა. არაფერი იკარგება.', stage]
  const n = Math.min(TOWER_MAX, g.stones)
  return [
    stage,
    n < TOWER_MAX ? `კოშკს ${TOWER_MAX - n} ქვა აკლია!` : 'კოშკი დავასრულეთ! სახურავიც ადგას.',
    `კიდევ ${BOOKS_PER_TOPIC - (g.books % BOOKS_PER_TOPIC)} დილა — და სკოლაში ფანჯარა აინთება.`,
    'შემოწმება ხიდს ფიცარს მატებს — იყიდი თუ არა, სულ ერთია.',
  ]
}

/* ───────────────────────── place sheet ───────────────────────── */

function PlaceDrawing({ id, game }: { id: PlaceId; game: Game }) {
  switch (id) {
    case 'tower': return <TowerPlace stones={game.stones} />
    case 'school': return <SchoolPlace books={game.books} topics={game.topics} />
    case 'cellar': return <CellarPlace qvevri={game.qvevri} />
    case 'station': return <StationPlace level={game.station} />
    case 'bridge': return <><Stream /><BridgePlace planks={game.planks} /></>
  }
}

const SPARKS = [[-70, -40], [70, -46], [-88, 10], [92, 6], [-40, -62], [44, -64]]

function Hero({ id, game }: { id: PlaceId; game: Game }) {
  const [x, y, w, h] = PLACE_BOX[id]
  const H = 132
  return (
    <div style={{ position: 'relative' }}>
      <motion.div
        initial={{ scale: 0.55, opacity: 0, rotate: -5 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 10, stiffness: 210, delay: 0.08 }}
        style={{ height: 150, borderRadius: 22, overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#a8dcff 0%,#e8f7ff 74%,#a3d69f 74%,#82c382 100%)', boxShadow: 'var(--shadow-sm)' }}
      >
        <svg viewBox={`${x} ${y} ${w} ${h}`} height={H} width={(H * w) / h} style={{ maxWidth: '100%', overflow: 'visible' }} aria-hidden>
          <PlaceDrawing id={id} game={game} />
        </svg>
      </motion.div>
      {SPARKS.map(([dx, dy], i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
          animate={{ opacity: [0, 1, 0], x: dx, y: dy, scale: [0.3, 1.1, 0.6] }}
          transition={{ duration: 0.9, delay: 0.25 + i * 0.03, ease: 'easeOut' }}
          style={{ position: 'absolute', left: '50%', top: '50%', fontSize: 14, color: '#ffb020', pointerEvents: 'none' }}
        >
          ✦
        </motion.span>
      ))}
    </div>
  )
}

function Meter({ label, right, value, max, color, next }: { label: string; right?: string; value: number; max: number; color?: string; next?: string }) {
  return (
    <div className="card" style={{ marginTop: 10, padding: 14 }}>
      <div className="between small" style={{ fontWeight: 800, marginBottom: 7 }}>
        <span>{label}</span>
        {right && <span className="muted" style={{ fontWeight: 700 }}>{right}</span>}
      </div>
      <Progress value={value} max={max} color={color} />
      {next && <div className="small" style={{ marginTop: 9, color: 'var(--ink-2)' }}>{next}</div>}
    </div>
  )
}

const TITLES: Record<PlaceId, string> = {
  tower: 'სვანური კოშკი',
  school: 'სოფლის სკოლა',
  cellar: 'მარანი და ქვევრები',
  station: 'ამინდის სადგური',
  bridge: 'ხიდი ნაკადულზე',
}

const GROWS: Record<PlaceId, string> = {
  tower: 'თუ ხელფასის დღეს უსაფრთხო ზღვარზე მეტი დაგრჩა, კოშკს ერთი ქვა ემატება. ქვა არ იკარგება.',
  school: 'დილის 3 კითხვა = 1 წიგნი. 6 წიგნი = სკოლაში ახალი ფანჯარა.',
  // the jar fills by filled / target (jarPct): the user's own goal, not the size of the amount
  cellar: 'ქვევრი ივსება, როცა დანაზოგში ფულს რეალურად გადადებ. პროგრესი შენი მიზნის პროცენტით ითვლება, ამიტომ დიდი თანხა უპირატესობას არ გაძლევს.',
  station: 'სადგური იზრდება, როცა გადასახადს დაადასტურებ, მაღაზიას მონიშნავ ან ნაღდ ხარჯს ჩაწერ — პროგნოზი ზუსტდება.',
  bridge: 'შესყიდვამდე შემოწმება = 1 ფიცარი — იყიდი თუ არა, სულ ერთია. დღეში მაქსიმუმ 3.',
}

/** one useful next step per place; none of them rewards spending */
const ACTION: Record<PlaceId, { label: string; tab: Tab }> = {
  tower: { label: 'პროგნოზის ნახვა', tab: 'road' },
  school: { label: 'დილის 3 კითხვა', tab: 'day' },
  cellar: { label: 'მიზანი ჯიხოსთან', tab: 'chat' },
  station: { label: 'გადასახადების დადასტურება', tab: 'analytics' },
  bridge: { label: 'შესყიდვის შემოწმება', tab: 'road' },
}

function PlaceBody({ id, game, calm }: { id: PlaceId; game: Game; calm: boolean }): ReactNode {
  // calm = support mode: show where things stand, never "N more to go"
  if (id === 'tower') {
    const n = Math.min(TOWER_MAX, game.stones)
    return (
      <Meter label={`${n}/${TOWER_MAX} ქვა`} value={n} max={TOWER_MAX} color="#a39478"
        next={n >= TOWER_MAX ? 'კოშკი დასრულდა — სახურავი ადგას!' : calm ? undefined : `კიდევ ${TOWER_MAX - n} — და კოშკს სახურავი დაედგმება.`} />
    )
  }
  if (id === 'school') {
    const inRoom = game.books % BOOKS_PER_TOPIC
    return (
      <Meter label={`${inRoom}/${BOOKS_PER_TOPIC} წიგნი`} value={inRoom} max={BOOKS_PER_TOPIC} color="#2a9d8f"
        next={calm ? undefined : `კიდევ ${BOOKS_PER_TOPIC - inRoom} დილა — და ფანჯარა აინთება.`} />
    )
  }
  if (id === 'cellar') {
    if (!game.qvevri.length) {
      return <div className="card small" style={{ marginTop: 10, lineHeight: 1.5 }}>ჯერ ქვევრი არ გაქვს. ჯიხოსთან დანაზოგის მიზანი დაისახე — და პირველი ქვევრი გაჩნდება.</div>
    }
    return (
      <>
        {game.qvevri.map((q, i) => {
          const pct = Math.round(jarPct(q) * 100)
          return (
            <Meter key={i} label={q.name} right={q.sealedAt ? 'დალუქულია' : `${pct}%`} value={pct} max={100} color="#e9a23b"
              next={q.sealedAt ? `დაილუქა: ${q.sealedAt}. ახალი მიზანი — ახალი ქვევრი.` : calm ? undefined : '100%-ზე ქვევრი დაილუქება.'} />
          )
        })}
      </>
    )
  }
  if (id === 'station') {
    const lv = Math.min(STATION_MAX, game.station)
    const xpLeft = Math.max(1, 3 - game.stationXp)
    return (
      <>
        <Meter label={`${lv}/${STATION_MAX} ხელსაწყო`} right={lv >= STATION_MAX ? 'სრულადაა აღჭურვილი ✓' : calm ? undefined : `კიდევ ${xpLeft} დადასტურება`} value={lv} max={STATION_MAX} color="var(--sky)" />
        <div className="card" style={{ marginTop: 10, padding: '10px 14px' }}>
          {INSTRUMENTS.map((name, i) => (
            <div key={name} className="between small" style={{ padding: '5px 0', borderTop: i ? '1px solid var(--line)' : undefined, color: i < lv ? 'var(--ink)' : 'var(--ink-3)', fontWeight: i < lv ? 700 : 600 }}>
              <span>{name}</span>
              <span>{i < lv ? '✓' : '🔒'}</span>
            </div>
          ))}
        </div>
      </>
    )
  }
  const n = Math.min(BRIDGE_MAX, game.planks)
  return (
    <Meter label={`${n}/${BRIDGE_MAX} ფიცარი`} right={calm ? undefined : `დღეს ${Math.min(3, game.checksToday)}/3`} value={n} max={BRIDGE_MAX} color="#c08552"
      next={n >= BRIDGE_MAX ? 'ხიდი გადებულია და ფარნები ანთია ✓' : calm ? undefined : `კიდევ ${BRIDGE_MAX - n} — და ხიდი მეორე ნაპირს მიაღწევს.`} />
  )
}

export function PlaceSheet({ place, game, calm = false, onClose }: { place: PlaceId | null; game: Game; calm?: boolean; onClose: () => void }) {
  const setTab = useStore(s => s.setTab)
  const setAnalyticsSeg = useStore(s => s.setAnalyticsSeg)
  // keep the last place rendered while the sheet animates out
  const [shown, setShown] = useState<PlaceId>('tower')
  useEffect(() => { if (place) setShown(place) }, [place])
  const id = place ?? shown
  const act = ACTION[id]
  const go = () => {
    onClose()
    if (act.tab === 'analytics') setAnalyticsSeg('payday')
    setTab(act.tab)
  }
  return (
    <Sheet open={!!place} onClose={onClose}>
      <Hero key={id} id={id} game={game} />
      <motion.div data-info-root initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} style={{ position: 'relative' }}>
        <div className="between" style={{ marginTop: 14 }}>
          <div className="h2">{TITLES[id]}</div>
          <div className="row" style={{ gap: 4, alignItems: 'center' }}>
            <InfoTip showLabel label="რა ზრდის?">{GROWS[id]}</InfoTip>
            <button onClick={onClose} aria-label="დახურვა" className="muted" style={{ fontSize: 18, fontWeight: 700, padding: '2px 6px' }}>✕</button>
          </div>
        </div>
        <PlaceBody id={id} game={game} calm={calm} />
        <button className="pill-btn btn-ghost" style={{ marginTop: 14 }} onClick={go}>{act.label} ›</button>
      </motion.div>
    </Sheet>
  )
}

/* ───────────────────────── year map ───────────────────────── */

const MEDAL_COLORS = ['#ffd166', '#f4a261', '#e76f51', '#8ecae6', '#cdb4db', '#b5e48c', '#90be6d', '#48cae4', '#ffafcc', '#a3b18a', '#80ed99', '#bde0fe']
const ROW_H = 98

export function YearMap({ cycles }: { cycles: number }) {
  const open = Math.min(12, Math.max(0, cycles))
  // snake path: row 0 → , row 1 ← , row 2 →
  const pos = LANDMARKS.map((_, i) => {
    const r = Math.floor(i / 4)
    const c = r % 2 === 0 ? i % 4 : 3 - (i % 4)
    return { x: 12.5 + c * 25, y: r * ROW_H + 30 }
  })
  return (
    <div style={{ position: 'relative', height: ROW_H * 3 - 6 }}>
      <svg viewBox={`0 0 100 ${ROW_H * 3}`} preserveAspectRatio="none" width="100%" height={ROW_H * 3} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        {pos.slice(0, -1).map((a, i) => {
          const b = pos[i + 1]
          const walked = i + 1 < open
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={walked ? '#ffb020' : '#d9d0c2'} strokeWidth={walked ? 3 : 2} strokeDasharray={walked ? undefined : '4 5'} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )
        })}
      </svg>
      {LANDMARKS.map((l, i) => {
        const unlocked = i < open
        const next = i === open
        const winter = i === 11
        return (
          <motion.div
            key={l.name}
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', damping: 13, delay: i * 0.04 }}
            style={{ position: 'absolute', left: `${pos[i].x}%`, top: pos[i].y - 28, width: '25%', marginLeft: '-12.5%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 28, display: 'grid', placeItems: 'center', fontSize: unlocked ? 26 : 20, fontWeight: 800,
              background: unlocked ? `radial-gradient(circle at 35% 30%, #fff 0%, ${MEDAL_COLORS[i]} 70%)` : winter ? '#eef3f8' : '#ebe5da',
              color: 'var(--ink-3)',
              border: unlocked ? '3px solid #fff' : next ? '2.5px dashed var(--sun-2)' : winter ? '2px dashed #9fb4c7' : '2px solid #e0d8ca',
              boxShadow: unlocked ? '0 6px 14px rgba(31,59,87,0.18)' : 'none',
            }}>
              {unlocked ? l.icon : winter ? '❄' : '?'}
            </div>
            <div className="tiny" style={{ fontWeight: 800, marginTop: 4, color: unlocked ? 'var(--ink)' : 'var(--ink-3)' }}>
              {unlocked ? l.name : next ? 'შემდეგი' : ''}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ───────────────────────── wardrobe ───────────────────────── */

export function Wardrobe({ game, stage, onToggle }: { game: Game; stage: 0 | 1 | 2 | 3; onToggle: (a: (typeof COSMETIC_POOL)[number]['id']) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {COSMETIC_POOL.map(c => {
        const owned = game.cosmetics.includes(c.id)
        const on = game.equipped.includes(c.id)
        if (!owned) {
          return (
            <div key={c.id} style={{ borderRadius: 16, background: '#f2ede4', padding: '6px 4px 8px', textAlign: 'center', position: 'relative' }} aria-label={`${c.name} — დახურულია`}>
              <div style={{ filter: 'brightness(0)', opacity: 0.16, display: 'flex', justifyContent: 'center' }}>
                <Jikho size={56} stage={stage} accessories={[c.id]} bob={false} />
              </div>
              <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 12 }}>🔒</span>
              <div className="tiny muted" style={{ fontWeight: 700, lineHeight: 1.2 }}>{c.name}</div>
            </div>
          )
        }
        return (
          <motion.button
            key={c.id}
            whileTap={{ scale: 0.92 }}
            onClick={() => onToggle(c.id)}
            aria-pressed={on}
            style={{
              borderRadius: 16, background: on ? '#fff7e0' : '#fff', padding: '6px 4px 8px', textAlign: 'center', position: 'relative',
              boxShadow: on ? '0 0 0 2.5px var(--sun-2), var(--shadow-sm)' : 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Jikho size={56} stage={stage} accessories={[c.id]} bob={false} mood={on ? 'happy' : 'calm'} />
            </div>
            {on && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 9 }} style={{ position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: 9, background: 'var(--sun-2)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center' }}>✓</motion.span>
            )}
            <div className="tiny" style={{ fontWeight: 800, lineHeight: 1.2 }}>{c.name}</div>
          </motion.button>
        )
      })}
    </div>
  )
}
