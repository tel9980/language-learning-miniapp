// 把素材导出成 JSON，供 tools/gen-audio.py 合成离线音频
// 用法：node tools/dump-items.js ja /tmp/ja_items.json
//       node tools/dump-items.js en /tmp/en_items.json
const fs = require('fs')
const s = require('../utils/sentences')
const w = require('../utils/words')

const lang = (process.argv[2] || 'ja').trim()
const target = process.argv[3] || ('/tmp/' + lang + '_items.json')
// 英语单词没必要预生成：有道单词发音一直是好的（整句才不稳），
// 而且 440 词 + 440 例句 = 880 个文件约 6MB，主包根本放不下。
const skipWords = process.argv.indexOf('--no-words') > 0

const out = { sentences: [], dialogues: [], words: [] }
s.getSentences(lang).forEach(x => out.sentences.push({ id: x.id, text: x.text }))
s.getDialogues(lang).forEach(d => d.lines.forEach(l => out.dialogues.push({ id: l.id, text: l.text })))
if (!skipWords) {
  w.getWords(lang).forEach(x => {
    out.words.push({ id: x.id, text: x.word })
    // 例句也提前合成：单词卡上的「例句」按钮同样要有离线音频
    if (x.example) out.words.push({ id: x.id + '_ex', text: x.example })
  })
}fs.writeFileSync(target, JSON.stringify(out, null, 1))
console.log('导出', lang, out.sentences.length, '句 /', out.dialogues.length,
  '台词 /', out.words.length, '词 →', target)
