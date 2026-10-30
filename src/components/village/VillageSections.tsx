import { ReactNode, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Game, LANDMARKS, COSMETIC_POOL, evolutionStage } from '../../state/store'
import { Jikho, STAGE_NAMES } from '../Jikho'
import { Sheet, Progress } from '../ui'
import {
  PlaceId, PLACE_BOX, TowerPlace, SchoolPlace, CellarPlace, StationPlace, BridgePlace, Stream,
  TOWER_MAX, BRIDGE_MAX, STATION_MAX, BOOKS_PER_TOPIC, INSTRUMENTS, jarPct,
} from './Places'
import { PLACE_ICON } from './VillageScene'

/* ───────────────────────── stage progress ───────────────────────── */

/** „მგზავრი" → „მგზავრამდე" */
const until = (name: string) => name.slice(0, -1) + 'ამდე'

export function stageProgress(g: Game): { text: string; value: number; max: number } {
  const s = evolutionStage(g)
  if (s === 0) {
    const need = Math.max(0, 3 - g.stones)
    return { text: `${until(STAGE_NAMES[1])}: კიდევ ${need} ქვა ან ერთი დალუქული ქვევრი`, value: g.stones, max: 3 }
  }
  if (s === 1) {
    const needS = Math.max(0, 6 - g.stones)
    const needT = Math.max(0, 3 - g.topics)
    const parts = [needS ? `${needS} ქვა` : '', needT ? `${needT} თემა` : ''].filter(Boolean)
    return { text: `${until(STAGE_NAMES[2])}: კიდევ ${parts.join(' და ')}`, value: Math.min(g.stones, 6) + Math.min(g.topics, 3), max: 9 }
  }
  if (s === 2) {
    return { text: `${until(STAGE_NAMES[3])}: კიდევ ${Math.max(0, 12 - g.stones)} ქვა`, value: g.stones, max: 12 }
  }
  return { text: 'უმაღლესი საფეხური — ჯიხო სოფლის უხუცესია ✓', value: 1, max: 1 }
}

/** short lines Jikho says when tapped */
export function jikhoTips(g: Game, hardship: boolean): string[] {
  const tips: string[] = []
  if (hardship) tips.push('ახლა დასვენების დროა. სოფელი გაყინულია — არაფერი ინგრევა.')
  tips.push(stageProgress(g).text + '.')
  const n = Math.min(TOWER_MAX, g.stones)
  tips.push(n < TOWER_MAX ? `კოშკს ${TOWER_MAX - n} ქვა აკლია. ყოველი უსაფრთხო ხელფასი — ერთი ქვა.` : 'კოშკი დავასრულეთ! სახურავიც ადგას 🎉')
  tips.push(`კიდევ ${BOOKS_PER_TOPIC - (g.books % BOOKS_PER_TOPIC)} დილის გაკვეთილი და სკოლაში ახალი ფანჯარა აინთება.`)
  tips.push('შესყიდვამდე შემოწმება ხიდს ფიცარს მატებს — ყიდვაც და ლოდინიც თანაბრად ითვლება.')
  return tips
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
      {next && <div className="small" style={{ marginTop: 9, color: 'var(--ink-2)' }}>🎯 {next}</div>}
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
  tower: 'ყოველი ხელფასი, რომელსაც ზღვარს ზემოთ ჩახვალ, კოშკს ერთ ქვას ამატებს. ქვა არასდროს იკარგება.',
  school: 'ყოველი დასრულებული დილის გაკვეთილი სკოლას ერთ წიგნს მატებს. ყოველ 6 წიგნზე თემა ითვისება და ახალი ოთახი ინთება.',
  cellar: 'ქვევრი მხოლოდ რეალური, დადასტურებული გადარიცხვით ივსება დანაზოგში. პროგრესი შემოსავლის წილით ითვლება და ზღვარი აქვს — დიდი თანხა წინ არ გაგიყვანს.',
  station: 'სადგური იზრდება, როცა გადასახადს ადასტურებ, მაღაზიას მონიშნავ ან ნაღდ ხარჯს ჩაწერ. ასე პროგნოზის დიაპაზონი ვიწროვდება.',
  bridge: 'ყოველი შემოწმება შესყიდვამდე ხიდს ერთ ფიცარს მატებს — სულერთია, იყიდი თუ დაელოდები. დღეში მაქსიმუმ 3 ფიცარი.',
}

function PlaceBody({ id, game }: { id: PlaceId; game: Game }): ReactNode {
  if (id === 'tower') {
    const n = Math.min(TOWER_MAX, game.stones)
    return (
      <Meter label={`${n}/${TOWER_MAX} ქვა`} right="უსაფრთხო ჩასვლები" value={n} max={TOWER_MAX} color="#a39478"
        next={n < TOWER_MAX ? `კიდევ ${TOWER_MAX - n} ქვა — და კოშკს სახურავი დაედგმება.` : 'კოშკი დასრულდა — სახურავი ადგას! 🎉'} />
    )
  }
  if (id === 'school') {
    const inRoom = game.books % BOOKS_PER_TOPIC
    return (
      <>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <span className="chip" style={{ background: '#fff', boxShadow: 'var(--shadow-sm)' }}>📚 {game.books} წიგნი</span>
          <span className="chip" style={{ background: '#fff', boxShadow: 'var(--shadow-sm)' }}>💡 {game.topics} ათვისებული თემა</span>
        </div>
        <Meter label={`${inRoom}/${BOOKS_PER_TOPIC} წიგნი`} right="შემდეგ ოთახამდე" value={inRoom} max={BOOKS_PER_TOPIC} color="#2a9d8f"
          next={`კიდევ ${BOOKS_PER_TOPIC - inRoom} დილის გაკვეთილი — და ახალი ფანჯარა აინთება.`} />
      </>
    )
  }
  if (id === 'cellar') {
    if (!game.qvevri.length) {
      return <div className="card small" style={{ marginTop: 10, lineHeight: 1.5 }}>🏺 ჯერ ქვევრი არ გაქვს. დაისახე დანაზოგის მიზანი ჯიხოსთან — და მარანში პირველი ქვევრი გაჩნდება.</div>
    }
    return (
      <>
        {game.qvevri.map((q, i) => {
          const pct = Math.round(jarPct(q) * 100)
          const nextMark = [25, 50, 75, 100].find(m => m > pct) ?? 100
          return (
            <Meter key={i} label={`🏺 ${q.name}`} right={q.sealedAt ? '🎗️ დალუქულია' : `${pct}%`} value={pct} max={100} color="#e9a23b"
              next={q.sealedAt ? `დაილუქა: ${q.sealedAt}. ახალი მიზანი — ახალი ქვევრი.` : `შემდეგი ნიშნული: ${nextMark}%. 100%-ზე ქვევრი ილუქება.`} />
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
        <Meter label={`დონე ${lv}/${STATION_MAX}`} right={lv < STATION_MAX ? `შემდეგამდე: ${xpLeft} დადასტურება` : 'სრულად აღჭურვილი'} value={lv} max={STATION_MAX} color="var(--sky)"
          next={lv < STATION_MAX ? `შემდეგი ხელსაწყო: ${INSTRUMENTS[lv]}.` : 'თეფში დამონტაჟდა — სადგური სრულადაა აღჭურვილი ✓'} />
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
    <>
      <Meter label={`${n}/${BRIDGE_MAX} ფიცარი`} right={`დღეს: ${Math.min(3, game.checksToday)}/3`} value={n} max={BRIDGE_MAX} color="#c08552"
        next={n < BRIDGE_MAX ? `კიდევ ${BRIDGE_MAX - n} ფიცარი — და ხიდი მეორე ნაპირს მიაღწევს.` : 'ხიდი გადებულია და ფარნები ანთია ✓'} />
    </>
  )
}

export function PlaceSheet({ place, game, onClose }: { place: PlaceId | null; game: Game; onClose: () => void }) {
  // keep the last place rendered while the sheet animates out
  const [shown, setShown] = useState<PlaceId>('tower')
  useEffect(() => { if (place) setShown(place) }, [place])
  const id = place ?? shown
  return (
    <Sheet open={!!place} onClose={onClose}>
      <Hero key={id} id={id} game={game} />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="row" style={{ marginTop: 14, gap: 8 }}>
          <span style={{ fontSize: 24 }}>{PLACE_ICON[id]}</span>
          <div className="h2">{TITLES[id]}</div>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, marginTop: 6, color: 'var(--ink-2)' }}>
          <b style={{ color: 'var(--ink)' }}>რა ზრდის: </b>{GROWS[id]}
        </div>
        <PlaceBody id={id} game={game} />
        <div className="tiny muted" style={{ textAlign: 'center', marginTop: 12 }}>ზრდის მხოლოდ ქცევა — არა ხარჯი, სესხი ან ბალანსის ზომა.</div>
        <button className="pill-btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>კარგი</button>
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
              {unlocked ? l.name : next ? 'შემდეგი' : '???'}
            </div>
            {winter && <div style={{ fontSize: 9.5, lineHeight: 1.15, color: '#5f86ad', fontWeight: 700 }}>ზამთრის გადასასვლელი</div>}
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
