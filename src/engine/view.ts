import { useMemo } from 'react'
import { Engine, getEngine, Dist, weatherOf, WeatherKind } from './engine'
import { PERSONAS, Persona } from './personas'
import { useStore } from '../state/store'

export const fmt = (n: number, d = 0) => {
  const s = Math.abs(n).toFixed(d).replace('.', ',')
  const [i, f] = s.split(',')
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (n < 0 ? '−' : '') + g + (f ? ',' + f : '')
}
export const gel = (n: number, d = 0) => `${fmt(n, d)} ₾`
/** "30–190 ₾", or "−30…+20 ₾" when the range crosses zero */
export const rangeText = (lo: number, hi: number) =>
  lo < 0 ? `${fmt(lo)}…${hi > 0 ? '+' : ''}${fmt(hi)} ₾` : `${fmt(lo)}–${fmt(hi)} ₾`

export function usePersona(): Persona {
  const id = useStore(s => s.personaId)
  return PERSONAS.find(p => p.id === id)!
}
export function useEngine(): Engine {
  const p = usePersona()
  return getEngine(p)
}

export interface TodayView {
  e: Engine; p: Persona; day: number; nDays: number; daysLeft: number; balance: number; landing: Dist; weather: WeatherKind
  safeToday: number; nextBill: { name: string; amount: number; date: string; inDays: number } | null; extra: number; hardship: boolean
}

export function useToday(): TodayView {
  const p = usePersona()
  const e = getEngine(p)
  const demo = useStore(s => s.demos[p.id])
  return useMemo(() => {
    const nDays = p.dayPattern.length
    const idx = e.demoPathIndex()
    const f = e.forecastAtDay(demo.day, idx, demo.extra)
    const daysLeft = nDays - demo.day
    const safeToday = daysLeft > 0 ? Math.max(0, Math.round((f.landing.p50 - e.cushion) / daysLeft)) : 0
    const upcoming = p.due.filter(d => d.dayIndex >= demo.day).sort((a, b) => a.dayIndex - b.dayIndex)[0]
    const nextBill = upcoming ? { name: upcoming.name, amount: upcoming.amount ?? Math.round((upcoming.range![0] + upcoming.range![1]) / 2), date: upcoming.date, inDays: upcoming.dayIndex - demo.day } : null
    const hardship = p.id === 'tamar'
    return { e, p, day: demo.day, nDays, daysLeft, balance: f.balance, landing: f.landing, weather: f.landing.weather, safeToday, nextBill, extra: demo.extra, hardship }
  }, [p, e, demo.day, demo.extra])
}

export { weatherOf }
