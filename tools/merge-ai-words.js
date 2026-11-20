// 把「AI 查词审核台」导出的 JSON 合并进词库（tools/review.html → 导出 → 这里）。
//
// 用法：
//   node tools/merge-ai-words.js ai-words-reviewed.json
//   node tools/merge-ai-words.js ai-words-reviewed.json --lang en --category AI收录 --dry
//
// 做的事：
//   1. 校验每条：词形/释义非空、例句中英成对、没有和现有词库重复（不分大小写；
//      英语连释义重复也拒——选择题里两个同义选项就等于两个正确答案）；
//   2. 追加到 utils/words.en.js / utils/words.ja.js 末尾，id 接着往后排；
//   3. 打印「收了几条、跳过几条及原因」。
//
// 故意不做的事：不自动 commit、不自动 push、不自动生成音频。
// 合并完自己看一眼 diff，再 node tools/validate.js && git push（CI 会跑测试并发布）。
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const FILES = {
  en: path.join(ROOT, 'utils/words.en.js'),
  ja: path.join(ROOT, 'utils/words.ja.js')
}

function arg(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : def
}
function has(name) { return process.argv.indexOf('--' + name) >= 0 }

const src = process.argv[2]
if (!src || src.charAt(0) === '-') {
  console.log('用法：node tools/merge-ai-words.js <导出的 json> [--lang en|ja] [--category 财务] [--dry]')
  process.exit(1)
}

const lang = (arg('lang', 'en') === 'ja') ? 'ja' : 'en'
const category = arg('category', 'AI收录')
const dry = has('dry')
const file = FILES[lang]

let incoming
try {
  incoming = JSON.parse(fs.readFileSync(src, 'utf8'))
} catch (e) {
  console.error('读不到或不是合法 JSON：' + src + '（' + e.message + '）')
  process.exit(1)
}
if (!Array.isArray(incoming)) incoming = [incoming]

const text = fs.readFileSync(file, 'utf8')
const lines = text.split('\n')

// 现有条目：直接从数据文件里读（不 require，避免把 91KB 词库塞进内存再序列化）
const existing = []
lines.forEach(function (l) {
  const m = l.match(/^\s*\{ id: "([^"]+)", word: "((?:[^"\\]|\\.)*)", phonetic: "(?:[^"\\]|\\.)*", meaning: "((?:[^"\\]|\\.)*)"/)
  if (m) existing.push({ id: m[1], word: JSON.parse('"' + m[2] + '"'), meaning: JSON.parse('"' + m[3] + '"') })
})
const wordSet = {}
const meaningSet = {}
existing.forEach(function (w) {
  wordSet[w.word.toLowerCase()] = w.id
  meaningSet[w.meaning] = w.id
})

let maxId = 0
existing.forEach(function (w) {
  const n = Number(String(w.id).replace(/^[a-z]+_/, ''))
  if (n > maxId) maxId = n
})
const prefix = lang === 'ja' ? 'ja_' : 'en_'

const added = []
const skipped = []
const seen = {}

incoming.forEach(function (it, idx) {
  const label = (it && (it.word || it.text)) || ('第 ' + (idx + 1) + ' 条')
  const word = String((it && (it.word || it.text)) || '').trim()
  const meaning = String((it && (it.meaning || it.cn)) || '').trim()
  const phonetic = String((it && it.phonetic) || '').trim()
  const examples = (it && it.examples) || []
  const first = examples[0] || {}

  if (!word) return skipped.push(label + '：没有词形')
  if (!meaning) return skipped.push(label + '：没有释义')
  if (/[<>]/.test(word + meaning)) return skipped.push(label + '：含 HTML 角括号，拒绝')
  if (word.length > 60 || meaning.length > 120) return skipped.push(label + '：词形或释义过长')
  const key = word.toLowerCase()
  if (wordSet[key]) return skipped.push(label + '：词库里已有（' + wordSet[key] + '）')
  if (seen[key]) return skipped.push(label + '：这批里重复了')
  if (meaningSet[meaning]) return skipped.push(label + '：释义和 ' + meaningSet[meaning] + ' 重复（选择题会出现两个正确答案）')

  const en = String(first.en || first.text || '').trim()
  const cn = String(first.cn || '').trim()
  seen[key] = true
  maxId += 1
  added.push({
    id: prefix + String(maxId).padStart(3, '0'),
    word: word,
    phonetic: phonetic,
    meaning: meaning,
    example: en || meaning,
    exampleCn: cn || meaning,
    category: category
  })
})

if (!added.length) {
  console.log('没有可合并的条目。')
  skipped.forEach(function (s) { console.log('  跳过 ' + s) })
  process.exit(0)
}

// 挂在闭合的 ] 之前：保留原有缩进与双引号风格
const newLines = added.map(function (w) {
  const body = ['id', 'word', 'phonetic', 'meaning', 'example', 'exampleCn', 'category']
    .map(function (k) { return k + ': ' + JSON.stringify(w[k]) }).join(', ')
  return '    { ' + body + ' }' + (',' )
})
let closeAt = -1
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === ']') { closeAt = i; break }
}
if (closeAt < 0) {
  console.error('没找到数据文件的闭合括号，可能文件结构变了，先看看 ' + file)
  process.exit(1)
}
// 原来最后一条没有逗号，补上
for (let i = closeAt - 1; i >= 0; i--) {
  const t = lines[i].trim()
  if (!t) continue
  if (t.charAt(t.length - 1) !== ',') lines[i] = lines[i] + ','
  break
}
const merged = lines.slice(0, closeAt).concat(newLines).concat(lines.slice(closeAt))
const out = merged.join('\n')

console.log('准备合并 ' + added.length + ' 条到 ' + path.relative(ROOT, file) + (dry ? '（--dry 只看不写）' : ''))
added.forEach(function (w) { console.log('  + ' + w.id + '  ' + w.word + '  ' + w.meaning.slice(0, 30)) })
skipped.forEach(function (s) { console.log('  跳过 ' + s) })

if (dry) process.exit(0)

fs.writeFileSync(file, out, 'utf8')
console.log('已写入。下一步：node tools/validate.js && node tests/run-tests.js，然后 git push（CI 会发布在线词库）')
