// 重新导出在线词库 JSON：node deploy/export-data.js
// 改完 utils/words.js / utils/sentences.js 后跑一次，把生成的 deploy/data.json 上传到 OSS 即可。
const fs = require('fs')
const path = require('path')

const words = require('../utils/words')
const sentences = require('../utils/sentences')

const payload = {
  version: '', // 下面用「内容指纹」填：内容没变就不变，用户不会白拉 134KB
  // 不写 generatedAt：内容相同时整个文件逐字节不变，git 里就不会有「只有时间戳变了」的假改动
  words: {
    en: words.WORDS.en,
    ja: words.WORDS.ja,
    vi: words.WORDS.vi,
    ko: words.WORDS.ko
  },
  sentences: {
    en: sentences.SENTENCES.en,
    ja: sentences.SENTENCES.ja,
    vi: sentences.SENTENCES.vi,
    ko: sentences.SENTENCES.ko
  },
  dialogues: {
    en: sentences.DIALOGUES.en,
    ja: sentences.DIALOGUES.ja,
    vi: sentences.DIALOGUES.vi,
    ko: sentences.DIALOGUES.ko
  }
}

// 版本号 = 内容指纹：只有真的改了词库/句子才会变
// （以前用时间戳，每次部署版本都变，所有用户都要重下 134KB —— 哪怕一个字都没改）
;(function stampVersion() {
  const crypto = require('crypto')
  const body = JSON.stringify({
    words: payload.words,
    sentences: payload.sentences,
    dialogues: payload.dialogues
  })
  payload.version = 'c' + crypto.createHash('sha1').update(body).digest('hex').slice(0, 13)
})()

const json = JSON.stringify(payload)
const out = path.join(__dirname, 'data.json')
fs.writeFileSync(out, json)
console.log('✅ 已导出:', out)

// Cloudflare Pages 的发布目录不再留一份副本（两份 181KB 的 JSON 各自进 git，
// 迟早出现「仓库里一致、线上是旧的」）。发布时才复制：见 deploy/cf/deploy.sh 与 CI。
console.log('   version:', payload.version)
Object.keys(payload.words).forEach(function (lang) {
  console.log('   [' + lang + '] 词:', (payload.words[lang] || []).length,
    '| 句:', (payload.sentences[lang] || []).length,
    '| 对话:', (payload.dialogues[lang] || []).length)
})
console.log('   把 data.json 上传到你的 OSS / 跑 bash deploy/cf/deploy.sh 发到 Cloudflare，小程序下次启动自动更新。')
