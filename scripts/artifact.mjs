// Turns dist-single/index.html into a page body for claude.ai Artifacts (the host adds doctype/html/head/body).
import { readFileSync, writeFileSync } from 'node:fs'
const src = readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8')
const head = src.match(/<head>([\s\S]*?)<\/head>/i)[1]
const body = src.match(/<body>([\s\S]*?)<\/body>/i)[1]
const title = '<title>ხელფასამდე</title>'
const keepHead = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<title>[\s\S]*?<\/title>/i, '')
const out = `${title}\n<meta name="theme-color" content="#1f3b57">\n${keepHead}\n${body}\n`
writeFileSync(new URL('../dist-single/artifact.html', import.meta.url), out)
console.log('artifact.html', out.length)
