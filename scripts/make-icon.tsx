/**
 * Renders Jikho (the same component the app uses) into the site logo:
 *   public/favicon.svg  and an inline data-URI favicon in index.html (so the single-file build has it too).
 * Run: npx tsx scripts/make-icon.tsx
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { Jikho } from '../src/components/Jikho'

const raw = renderToStaticMarkup(createElement(Jikho, { size: 120, mood: 'happy', stage: 1, bob: false, accessories: ['scarf'] }))
// keep only the drawing (drop the outer <svg ...> wrapper and inline styles that reference app keyframes)
const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/ style="[^"]*animation[^"]*"/g, '')

const CROP = process.env.CROP ?? '50 4 68 68' // head, horns and scarf: readable even at 16 px
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<defs><clipPath id="r"><rect x="2" y="2" width="116" height="116" rx="30"/></clipPath></defs>
<rect x="2" y="2" width="116" height="116" rx="30" fill="#ffe9a8"/>
<g clip-path="url(#r)"><svg x="0" y="0" width="120" height="120" viewBox="${CROP}">${inner}</svg></g>
</svg>`

mkdirSync('public', { recursive: true })
writeFileSync('public/favicon.svg', svg)

const dataUri = 'data:image/svg+xml,' + encodeURIComponent(svg)
let html = readFileSync('index.html', 'utf8')
html = html.replace(/\s*<link rel="icon"[^>]*>/, '')
html = html.replace('<title>', `<link rel="icon" type="image/svg+xml" href="${dataUri}" />\n    <title>`)
writeFileSync('index.html', html)
console.log('favicon.svg', svg.length, 'bytes; index.html updated')
