import { useEffect, useRef } from 'react'

/** requestAnimationFrame loop with delta time (seconds, capped so a stalled tab never jumps ahead); runs only while `running` */
export function useGameLoop(running: boolean, step: (dt: number) => void) {
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = -1
    const tick = (t: number) => {
      if (last >= 0) stepRef.current(Math.min(0.05, (t - last) / 1000))
      last = t
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])
}

/** pause when the tab is hidden */
export function useHidden(onHide: () => void) {
  const cb = useRef(onHide)
  cb.current = onHide
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'hidden') cb.current() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])
}
