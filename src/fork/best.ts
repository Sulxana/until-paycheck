// personal best for the runner, kept in this browser only (storage may be blocked: then nothing is remembered)
const BEST_KEY = 'fork-best-v1'
export interface Best { runs: number; suns: number; best: number | null }
export function loadBest(): Best {
  try {
    const v = JSON.parse(localStorage.getItem(BEST_KEY) || 'null')
    if (v && typeof v.runs === 'number') return { runs: v.runs, suns: v.suns ?? 0, best: typeof v.best === 'number' ? v.best : null }
  } catch { /* storage blocked */ }
  return { runs: 0, suns: 0, best: null }
}
export function saveBest(b: Best) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)) } catch { /* ignore */ } }
