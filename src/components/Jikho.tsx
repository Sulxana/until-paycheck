import { CSSProperties } from 'react'

export type JikhoMood = 'happy' | 'calm' | 'worried' | 'resting' | 'celebrate' | 'thinking' | 'talking'
export type Accessory = 'umbrella' | 'nabadi' | 'scarf' | 'svanHat' | 'lantern' | 'backpack' | 'flowers' | 'bell'

interface Props {
  size?: number
  mood?: JikhoMood
  stage?: 0 | 1 | 2 | 3 // ციკანი, მგზავრი, მეგზური, უხუცესი
  walking?: boolean
  accessories?: Accessory[]
  facing?: 'right' | 'left'
  style?: CSSProperties
  bob?: boolean
}

const FUR = '#a3714a'
const FUR_DARK = '#7d5434'
const FUR_LIGHT = '#e9cfa8'
const HORN = '#5f4126'
const HORN_RIDGE = '#8a6a48'
const HOOF = '#3d2a1a'

export function Jikho({ size = 120, mood = 'happy', stage = 1, walking = false, accessories = [], facing = 'right', style, bob = true }: Props) {
  const sitting = mood === 'resting'
  const hornScale = [0.55, 0.8, 1, 1.15][stage]
  const bodyScale = [0.88, 0.95, 1, 1.02][stage]
  const jump = mood === 'celebrate'
  const has = (a: Accessory) => accessories.includes(a)
  const legAnim = (i: number): CSSProperties => (walking && !sitting ? { animation: `${i % 2 ? 'step' : 'step2'} 0.5s ease-in-out infinite`, transformBox: 'fill-box', transformOrigin: 'top center' } : {})

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: 'visible', ...style }} aria-label="ჯიხო">
      <g transform={facing === 'left' ? 'translate(120,0) scale(-1,1)' : undefined}>
        <g style={bob ? { animation: jump ? 'bob 0.45s ease-in-out infinite' : 'bob 2.6s ease-in-out infinite' } : undefined}>
          {/* shadow */}
          <ellipse cx="62" cy="108" rx={sitting ? 34 : 30} ry="4.5" fill="rgba(0,0,0,0.13)" />
          <g transform={`translate(62 76) scale(${bodyScale}) translate(-62 -76)`}>
            {/* tail */}
            <path d="M33 64 q-7 -4 -6 4 q2 5 8 2" fill={FUR_DARK} />
            {/* back legs */}
            {!sitting && (
              <>
                <g style={legAnim(0)}><rect x="40" y="80" width="8" height="22" rx="4" fill={FUR_DARK} /><rect x="40" y="97" width="8" height="6" rx="2.5" fill={HOOF} /></g>
                <g style={legAnim(1)}><rect x="50" y="81" width="8" height="21" rx="4" fill={FUR} /><rect x="50" y="97" width="8" height="6" rx="2.5" fill={HOOF} /></g>
              </>
            )}
            {/* front legs */}
            {!sitting && (
              <>
                <g style={legAnim(1)}><rect x="70" y="81" width="8" height="21" rx="4" fill={FUR_DARK} /><rect x="70" y="97" width="8" height="6" rx="2.5" fill={HOOF} /></g>
                <g style={legAnim(0)}><rect x="80" y="80" width="8" height="22" rx="4" fill={FUR} /><rect x="80" y="97" width="8" height="6" rx="2.5" fill={HOOF} /></g>
              </>
            )}
            {sitting && (
              <>
                <ellipse cx="48" cy="98" rx="11" ry="5" fill={FUR_DARK} />
                <ellipse cx="80" cy="99" rx="11" ry="5" fill={FUR_DARK} />
                <rect x="86" y="96" width="9" height="5" rx="2.5" fill={HOOF} />
              </>
            )}
            {/* body */}
            <ellipse cx="62" cy={sitting ? 84 : 72} rx="31" ry="19" fill={FUR} />
            <ellipse cx="66" cy={sitting ? 90 : 79} rx="20" ry="9" fill={FUR_LIGHT} opacity="0.9" />
            {/* back stripe */}
            <path d={sitting ? 'M38 76 q24 -12 48 -2' : 'M38 64 q24 -12 48 -2'} stroke={FUR_DARK} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />

            {/* backpack */}
            {(has('backpack') || stage >= 1) && !has('nabadi') && (
              <g transform={sitting ? 'translate(0 12)' : undefined}>
                <rect x="40" y="50" width="20" height="18" rx="5" fill="#d9573b" />
                <rect x="43" y="47" width="14" height="6" rx="3" fill="#b8432a" />
                <rect x="44" y="57" width="12" height="7" rx="2" fill="#f08a6d" />
              </g>
            )}
            {/* nabadi (felt cloak) */}
            {has('nabadi') && (
              <path d={sitting ? 'M30 74 q32 -22 62 -2 l4 22 q-34 10 -70 0 z' : 'M30 62 q32 -22 62 -2 l4 22 q-34 10 -70 0 z'} fill="#2a2a33" />
            )}
          </g>

          {/* head group */}
          <g transform={sitting ? 'translate(0 10)' : undefined}>
            {/* horns: tur horns sweep back and down */}
            <g transform={`translate(80 34) scale(${hornScale}) translate(-80 -34)`}>
              <path d="M74 34 C66 14, 44 10, 40 26 C38 34, 46 38, 50 32" stroke={HORN} strokeWidth="8" fill="none" strokeLinecap="round" />
              <path d="M86 32 C82 12, 60 6, 54 20 C51 28, 58 33, 62 28" stroke={HORN} strokeWidth="8" fill="none" strokeLinecap="round" />
              <path d="M66 17 l3 5 M58 15 l2 5 M50 17 l3 4 M76 13 l1 5 M68 10 l2 5" stroke={HORN_RIDGE} strokeWidth="1.6" strokeLinecap="round" />
            </g>
            {/* ears */}
            <ellipse cx="70" cy="40" rx="7" ry="3.6" transform="rotate(-25 70 40)" fill={FUR_DARK} />
            <ellipse cx="101" cy="40" rx="7" ry="3.6" transform="rotate(25 101 40)" fill={FUR_DARK} />
            {/* head */}
            <ellipse cx="86" cy="47" rx="19.5" ry="17.5" fill={FUR} />
            <ellipse cx="88" cy="57" rx="11" ry="8" fill={FUR_LIGHT} />
            {/* beard */}
            {stage >= 2 && <path d={stage === 3 ? 'M82 63 q6 16 12 0 z' : 'M84 63 q4 8 8 0 z'} fill={FUR_DARK} />}
            {/* cheeks */}
            <circle cx="76" cy="54" r="3.2" fill="#f29b8b" opacity="0.55" />
            <circle cx="99" cy="54" r="3.2" fill="#f29b8b" opacity="0.55" />
            {/* eyes */}
            {mood === 'resting' ? (
              <g stroke="#2b1d12" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M77 47 q4 3 8 0" /><path d="M89 47 q4 3 8 0" />
              </g>
            ) : (
              <g style={{ animation: 'blink 4.5s infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
                <ellipse cx="80" cy={mood === 'thinking' ? 44 : 46} rx="4.2" ry="4.8" fill="#2b1d12" />
                <ellipse cx="93" cy={mood === 'thinking' ? 44 : 46} rx="4.2" ry="4.8" fill="#2b1d12" />
                <circle cx="81.5" cy={mood === 'thinking' ? 42 : 44} r="1.5" fill="#fff" />
                <circle cx="94.5" cy={mood === 'thinking' ? 42 : 44} r="1.5" fill="#fff" />
              </g>
            )}
            {/* brows */}
            {mood === 'worried' && (
              <g stroke="#4a3220" strokeWidth="1.8" strokeLinecap="round"><path d="M76 39 l7 2" /><path d="M97 39 l-7 2" /></g>
            )}
            {/* nose & mouth */}
            <ellipse cx="88" cy="56" rx="2.6" ry="1.8" fill="#3a2516" />
            {mood === 'worried' ? (
              <ellipse cx="88" cy="61.5" rx="2" ry="1.6" fill="#3a2516" />
            ) : mood === 'talking' ? (
              <ellipse cx="88" cy="61" rx="3" ry="2.2" fill="#3a2516" style={{ animation: 'glow 0.35s infinite' }} />
            ) : mood === 'thinking' ? (
              <path d="M85 61 h6" stroke="#3a2516" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d={mood === 'celebrate' ? 'M83 59.5 q5 6 10 0 z' : 'M84.5 60 q3.5 3 7 0'} stroke="#3a2516" strokeWidth="1.8" fill={mood === 'celebrate' ? '#3a2516' : 'none'} strokeLinecap="round" />
            )}

            {/* svan hat */}
            {has('svanHat') && (
              <g>
                <ellipse cx="86" cy="33" rx="13" ry="4" fill="#5b4a3b" />
                <path d="M74 33 q12 -14 24 0 z" fill="#7b6655" />
                <path d="M78 30 h16 M80 27 h12" stroke="#4a3b2e" strokeWidth="1" />
              </g>
            )}
            {/* flowers crown */}
            {has('flowers') && (
              <g>
                {[74, 81, 88, 95].map((x, i) => <circle key={x} cx={x} cy={33 - (i % 2) * 2} r="3" fill={['#ff7aa2', '#ffd166', '#8ed1fc', '#ff9f68'][i]} />)}
              </g>
            )}
            {/* scarf */}
            {has('scarf') && (
              <g>
                <path d="M72 62 q14 8 28 0 l-1 5 q-13 7 -26 0 z" fill="#e63946" />
                <path d="M78 66 l-4 12 l5 -1 l3 -9 z" fill="#c92a37" />
              </g>
            )}
            {/* umbrella hat */}
            {has('umbrella') && (
              <g transform="translate(86 26) scale(1.45) translate(-86 -26)">
                <path d="M86 26 v8" stroke="#555" strokeWidth="1.5" />
                <path d="M68 26 q18 -18 36 0 q-4.5 -3 -9 0 q-4.5 -3 -9 0 q-4.5 -3 -9 0 q-4.5 -3 -9 0 z" fill="#4f7cff" />
                <path d="M86 9 v-2" stroke="#4f7cff" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}
            {/* bell */}
            {has('bell') && (
              <g><path d="M84 66 h8" stroke="#8a5a2b" strokeWidth="2" /><path d="M85 67 q3 -2 6 0 l1 6 h-8 z" fill="#f2b632" /></g>
            )}
          </g>
          {/* lantern hanging from horn */}
          {has('lantern') && (
            <g transform={sitting ? 'translate(0 10)' : undefined}>
              <path d="M44 28 v10" stroke="#5b4a3b" strokeWidth="1.4" />
              <rect x="39" y="38" width="10" height="13" rx="2.5" fill="#3d3326" />
              <rect x="41" y="40" width="6" height="9" rx="1.5" fill="#ffd166" style={{ animation: 'glow 1.8s infinite' }} />
              <circle cx="44" cy="44" r="10" fill="#ffd166" opacity="0.18" />
            </g>
          )}
          {/* staff for guide/elder */}
          {stage >= 2 && !sitting && (
            <path d="M104 50 L110 104" stroke="#7a5230" strokeWidth="3.4" strokeLinecap="round" />
          )}
          {/* celebration sparkles */}
          {jump && (
            <g fill="#ffc94a">
              <path d="M20 30 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" style={{ animation: 'glow 0.8s infinite' }} />
              <path d="M108 18 l1.5 4.5 l4.5 1.5 l-4.5 1.5 l-1.5 4.5 l-1.5 -4.5 l-4.5 -1.5 l4.5 -1.5 z" style={{ animation: 'glow 0.6s infinite' }} />
              <circle cx="28" cy="58" r="2" style={{ animation: 'glow 0.7s infinite' }} />
            </g>
          )}
          {mood === 'thinking' && (
            <g fill="#8193a5">
              <circle cx="106" cy="30" r="2.2" style={{ animation: 'typing 1.2s infinite' }} />
              <circle cx="112" cy="24" r="2.8" style={{ animation: 'typing 1.2s 0.2s infinite' }} />
              <circle cx="119" cy="16" r="3.4" style={{ animation: 'typing 1.2s 0.4s infinite' }} />
            </g>
          )}
          {mood === 'resting' && (
            <g fill="#8193a5" fontSize="10" fontWeight="800" fontFamily="sans-serif">
              <text x="104" y="30" style={{ animation: 'glow 2s infinite' }}>z</text>
              <text x="111" y="20" fontSize="13" style={{ animation: 'glow 2s 0.5s infinite' }}>z</text>
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}

export const STAGE_NAMES = ['ციკანი', 'მგზავრი', 'მეგზური', 'უხუცესი'] as const
