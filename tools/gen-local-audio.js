// 生成 utils/local-audio.js（离线音频清单）
//
// 为什么要有这一层：离线 mp3 是按素材 id 命名的，代码里「这句有没有离线音频」
// 完全取决于生成时到底产出了哪些文件。手写清单容易和磁盘不一致（素材改了、
// 音频没跟着重生成），所以清单一律由本脚本扫描磁盘生成。
//
// 用法：node tools/gen-local-audio.js
//
// 布局（注意：mp3 不进代码包，只在仓库的 audio-src/ 下，由 CI 铺到 Cloudflare Pages）：
//   日语 → audio-src/ja/<id>.mp3   → https://yb.qy663.de5.net/audio/<id>.mp3
//   英语 → audio-src/en/<id>.mp3   → https://yb.qy663.de5.net/audio-en/<id>.mp3
//
// 为什么不打进包里：真机上 FileSystemManager 读不到分包内文件（日志「[pkg-audio] 读不到
// 代码包内的音频」），InnerAudioContext 也不允许直接播包内 mp3（operateAudio:fail:access denied）。
// 打进包既播不了、又白占 3.8MB 上传体积和用户下载流量。
const fs = require('fs')
const path = require('path')
const s = require('../utils/sentences')
const w = require('../utils/words')

const ROOT = path.join(__dirname, '..')
const REGION = {
  // 日语在主包放不下、只能在分包里；分包在个别真机上会加载失败，所以同一批 mp3
  // 还会随 Pages 部署到 CDN，加载失败时直接流播（见 utils/local-audio.js 的 remoteFor）
  ja: { dir: 'audio-src/ja', remote: 'https://yb.qy663.de5.net/audio/' },
  en: { dir: 'audio-src/en', remote: 'https://yb.qy663.de5.net/audio-en/' },
  // 越南语没有任何在线合成源，单词、例句、句子、台词全部要预生成
  vi: { dir: 'audio-src/vi', remote: 'https://yb.qy663.de5.net/audio-vi/' },
  // 韩语整句没有在线源（有道 500、百度失败），单词有道能读但也要 le=ko，
  // 所以和越南语一样全部预生成
  ko: { dir: 'audio-src/ko', remote: 'https://yb.qy663.de5.net/audio-ko/' }
}

// 每个语种要合成的素材 id（英语现在也含单词和例句：800 词全部预生成离线音频）
function itemsOf(lang) {
  const ids = []
  s.getSentences(lang).forEach(x => ids.push(x.id))
  s.getDialogues(lang).forEach(d => d.lines.forEach(l => ids.push(l.id)))
  // 所有语种的单词都预生成：免得每次发音都靠网络
  w.getWords(lang).forEach(x => {
    ids.push(x.id)
    if (x.example) ids.push(x.id + '_ex')
  })
  return ids
}

const out = {}
const sizes = {}
let missing = 0
Object.keys(REGION).forEach(lang => {
  const r = REGION[lang]
  const ids = itemsOf(lang).filter(id => {
    const p = path.join(ROOT, r.dir, id + '.mp3')
    if (!fs.existsSync(p)) { missing++; return false }
    sizes[lang] = (sizes[lang] || 0) + fs.statSync(p).size
    return true
  })
  out[lang] = { remote: r.remote || '', ids: ids }
})

const q = v => "'" + v + "'"

// 把 id 列表排成若干行字符串拼接，每行不超过 110 字符，方便 diff 看
function wrapIds(ids) {
  const list = ids.slice().sort()
  const parts = []
  let cur = ''
  list.forEach(id => {
    const next = cur ? cur + ' ' + id : id
    if (next.length > 100 && cur) { parts.push(cur + ' '); cur = id }
    else cur = next
  })
  if (cur) parts.push(cur)
  return parts.map((p, i) => q(p) + (i < parts.length - 1 ? ' +' : '')).join('\n      ')
}

const lines = []
lines.push('// 离线音频清单（自动生成，不要手改）')
lines.push('//')
lines.push('// 生成：node tools/dump-items.js ja /tmp/ja_items.json')
lines.push('//       python3 tools/gen-audio.py --lang ja --items /tmp/ja_items.json --out audio-src/ja')
lines.push('//       node tools/gen-local-audio.js')
lines.push('//')
lines.push('// 为什么不走在线合成：日语整句找不到可靠的免费源——有道 dictvoice 只对单词有效')
lines.push('// （且必须带 le=jap），百度 lan=jap 返回 403，同声传译 textToSpeech 只列中英文。')
lines.push('// 英语虽然有在线源，但学英语最常练，预生成音频能保证首句秒开、不被网络抖动影响。')
lines.push('//')
lines.push('// mp3 不进代码包（真机读不到包内文件），只放仓库 audio-src/，由 CI 铺到 Cloudflare Pages；')
lines.push('// 这里只维护「哪个 id 有音频、CDN 地址是什么」，见 remoteFor()。')
lines.push('')
lines.push('const REGION = {')
const regionKeys = Object.keys(out)
regionKeys.forEach((lang, li) => {
  const r = out[lang]
  lines.push('  ' + lang + ': {')
  lines.push('    remote: ' + q(r.remote || '') + ',')
  lines.push('    count: ' + r.ids.length + ',')
  lines.push('    bytes: ' + (sizes[lang] || 0) + ',')
  // ids 用「空格分隔的整串」而不是 { 'id': 1 } 的映射表：722 个 id 的映射表是
  // 17KB，运行时只需判断「这个 id 在不在里面」，indexOf 足够，还省掉一次对象构建。
  lines.push('    ids: ' + wrapIds(r.ids))
  // 逗号要按「是不是最后一个语种」来加，早先写死 lang === 'ja'，
  // 加了第三个语种就变成 `},  vi: {...}` 这种语法错误
  lines.push('  }' + (li < regionKeys.length - 1 ? ',' : ''))
})
lines.push('}')
lines.push('')
lines.push(fs.readFileSync(path.join(__dirname, 'local-audio-tail.js'), 'utf8').trim())
const dst = path.join(ROOT, 'utils', 'local-audio.js')
fs.writeFileSync(dst, lines.join('\n') + '\n')
console.log('写入 utils/local-audio.js：' +
  Object.keys(out).map(l => l + ' ' + out[l].ids.length + ' 条 / ' +
    Math.round((sizes[l] || 0) / 1024) + 'KB').join('，') +
  (missing ? '（缺音频 ' + missing + ' 条）' : ''))
