// 把日语素材导出成 JSON，供 tools/gen-ja-audio.py 合成音频
const fs = require('fs')
const s = require('../utils/sentences')
const w = require('../utils/words')
const out = { sentences: [], dialogues: [], words: [] }
s.getSentences('ja').forEach(x => out.sentences.push({ id: x.id, text: x.text }))
s.getDialogues('ja').forEach(d => d.lines.forEach(l => out.dialogues.push({ id: l.id, text: l.text })))
w.getWords('ja').forEach(x => {
  out.words.push({ id: x.id, text: x.word })
  // 例句也提前合成：单词卡上的「例句」按钮同样没有在线合成源可用
  if (x.example) out.words.push({ id: x.id + '_ex', text: x.example })
})
const target = process.argv[2] || '/tmp/ja_items.json'
fs.writeFileSync(target, JSON.stringify(out, null, 1))
console.log('导出', out.sentences.length, '句 /', out.dialogues.length, '台词 /', out.words.length, '词 →', target)
