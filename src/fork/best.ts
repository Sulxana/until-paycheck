// personal records for the runner, kept in this browser only (storage may be blocked: then nothing is remembered)
import type { Ending } from './sim'

const BEST_KEY = 'fork-best-v2'
const OLD_KEY = 'fork-best-v1'
const TUT_KEY = 'fork-tut-v1'

/** one month (seed): the last attempt and the best ☀ landing */
export interface SeedRec { last: number; lastKind: Ending; best: number | null }
export interface Best { runs: number; suns: number; seeds: Record<string, SeedRec> }

export function loadBest(): Best {
  try {
    const v = JSON.parse(localStorage.getItem(BEST_KEY) || 'null')
    if (v && typeof v.runs === 'number') return { runs: v.runs, suns: v.suns ?? 0, seeds: v.seeds && typeof v.seeds === 'object' ? v.seeds : {} }
    const o = JSON.parse(localStorage.getItem(OLD_KEY) || 'null')
    if (o && typeof o.runs === 'number') return { runs: o.runs, suns: o.suns ?? 0, seeds: {} }
  } catch { /* storage blocked */ }
  return { runs: 0, suns: 0, seeds: {} }
}

/** stores a finished run; returns the record of this month before it */
export function recordRun(seed: number, kind: Ending, landing: number): { prev: SeedRec | null; best: Best } {
  const b = loadBest()
  const key = String(seed)
  const prev = b.seeds[key] ?? null
  b.runs++
  if (kind === 'sun') b.suns++
  const bestLanding = kind === 'sun' ? Math.max(prev?.best ?? -Infinity, landing) : prev?.best ?? null
  b.seeds[key] = { last: landing, lastKind: kind, best: bestLanding }
  try { localStorage.setItem(BEST_KEY, JSON.stringify(b)) } catch { /* ignore */ }
  return { prev, best: b }
}

/** the first-run help (slow motion at the first joy and the first scam) */
export function tutorialDone(): boolean { try { return localStorage.getItem(TUT_KEY) === '1' } catch { return false } }
export function markTutorialDone() { try { localStorage.setItem(TUT_KEY, '1') } catch { /* ignore */ } }
