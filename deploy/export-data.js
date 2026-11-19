// 重新导出在线词库 JSON：node deploy/export-data.js
// 改完 utils/words.js / utils/sentences.js 后跑一次，把生成的 deploy/data.json 上传到 OSS 即可。
const fs = require('fs')
const path = require('path')

const words = require('../utils/words')
const sentences = require('../utils/sentences')

const payload = {
  version: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14), // 每次导出自动更新版本号
  generatedAt: new Date().toISOString(),
  words: {
    en: words.WORDS.en,
    ja: words.WORDS.ja
  },
  sentences: {
    en: sentences.SENTENCES.en,
    ja: sentences.SENTENCES.ja
  },
  dialogues: {
    en: sentences.DIALOGUES.en,
    ja: sentences.DIALOGUES.ja
  }
}

const json = JSON.stringify(payload)
const out = path.join(__dirname, 'data.json')
fs.writeFileSync(out, json)
console.log('✅ 已导出:', out)

// Cloudflare Pages 的发布目录也放一份，省得每次手工复制
const cfDir = path.join(__dirname, 'cf')
if (fs.existsSync(cfDir)) {
  fs.writeFileSync(path.join(cfDir, 'data.json'), json)
  console.log('✅ 已同步:', path.join(cfDir, 'data.json'))
}
console.log('   version:', payload.version)
Object.keys(payload.words).forEach(function (lang) {
  console.log('   [' + lang + '] 词:', (payload.words[lang] || []).length,
    '| 句:', (payload.sentences[lang] || []).length,
    '| 对话:', (payload.dialogues[lang] || []).length)
})
console.log('   把 data.json 上传到你的 OSS / 跑 bash deploy/cf/deploy.sh 发到 Cloudflare，小程序下次启动自动更新。')
