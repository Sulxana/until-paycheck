// Hand-drawn line icons for the tab bar, one stroke style, tinted by the active state.
interface P { on?: boolean; size?: number }
const stroke = (on?: boolean) => (on ? '#1f3b57' : '#9aa8b6')
const fill = (on?: boolean) => (on ? '#ffc94a' : 'none')

export function IconRoad({ on, size = 26 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke={stroke(on)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 22 C 9 22, 7 15, 13 15 S 17 8, 23 8" />
      <circle cx="3.5" cy="22" r="1.6" fill={stroke(on)} stroke="none" />
      <path d="M20 4 v5" />
      <path d="M20 4 l4 1.4 -4 1.4" fill={fill(on)} />
    </svg>
  )
}
export function IconChart({ on, size = 26 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke={stroke(on)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4 v18 h18" />
      <path d="M7 17 l4 -5 l4 3 l6 -8" />
      <path d="M7 19 l4 -3 l4 1 l6 -5 v7 H7 z" fill={on ? 'rgba(90,169,230,0.35)' : 'none'} stroke="none" />
      <circle cx="21" cy="7" r="1.8" fill={fill(on)} />
    </svg>
  )
}
export function IconVillage({ on, size = 26 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke={stroke(on)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22 V9 h5 v13" fill={on ? 'rgba(201,139,91,0.35)' : 'none'} />
      <path d="M3.5 9 L6.5 5 L9.5 9" />
      <path d="M11 22 v-7 l5 -4 l5 4 v7" fill={fill(on)} />
      <path d="M15 22 v-3.5 h2 V22" />
      <path d="M2 22 h22" />
    </svg>
  )
}
export function IconDay({ on, size = 26 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke={stroke(on)} strokeWidth="2" strokeLinecap="round">
      <circle cx="13" cy="13" r="4.6" fill={fill(on)} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <path key={a} d="M13 3.2 v2.4" transform={`rotate(${a} 13 13)`} />
      ))}
    </svg>
  )
}
