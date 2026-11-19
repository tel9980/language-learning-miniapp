// 生成 utils/local-audio.js（离线音频清单）
//
// 为什么要有这一层：离线 mp3 是按素材 id 命名的，代码里「这句有没有离线音频」
// 完全取决于生成时到底产出了哪些文件。手写清单容易和磁盘不一致（素材改了、
// 音频没跟着重生成），所以清单一律由本脚本扫描磁盘生成。
//
// 用法：node tools/gen-local-audio.js
//
// 布局：
//   日语 → packageJa/ja/<id>.mp3   放在分包里（约 1.8MB，主包放不下）
//   英语 → packageEn/en/<id>.mp3  同样放分包（约 950KB，放主包会撑爆主包体积、拖慢冷启动）
const fs = require('fs')
const path = require('path')
const s = require('../utils/sentences')
const w = require('../utils/words')

const ROOT = path.join(__dirname, '..')
const REGION = {
  // 日语在主包放不下、只能在分包里；分包在个别真机上会加载失败，所以同一批 mp3
  // 还会随 Pages 部署到 CDN，加载失败时直接流播（见 utils/local-audio.js 的 remoteFor）
  ja: { base: '/packageJa/ja/', name: 'jaAudio', dir: 'packageJa/ja', remote: 'https://yb.qy663.de5.net/audio/' },
  en: { base: '/packageEn/en/', name: 'enAudio', dir: 'packageEn/en', remote: 'https://yb.qy663.de5.net/audio-en/' }
}

// 每个语种要合成的素材 id（英语不含单词：单词在线发音一直稳，880 个文件放不下）
function itemsOf(lang) {
  const ids = []
  s.getSentences(lang).forEach(x => ids.push(x.id))
  s.getDialogues(lang).forEach(d => d.lines.forEach(l => ids.push(l.id)))
  if (lang === 'ja') {
    w.getWords(lang).forEach(x => {
      ids.push(x.id)
      if (x.example) ids.push(x.id + '_ex')
    })
  }
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
  out[lang] = { base: r.base, name: r.name, remote: r.remote || '', ids: ids }
})

const q = v => "'" + v + "'"
const lines = []
lines.push('// 离线音频清单（自动生成，不要手改）')
lines.push('//')
lines.push('// 生成：node tools/dump-items.js ja /tmp/ja_items.json')
lines.push('//       python3 tools/gen-audio.py --lang ja --items /tmp/ja_items.json --out packageJa/ja')
lines.push('//       node tools/gen-local-audio.js')
lines.push('//')
lines.push('// 为什么不走在线合成：日语整句找不到可靠的免费源——有道 dictvoice 只对单词有效')
lines.push('// （且必须带 le=jap），百度 lan=jap 返回 403，同声传译 textToSpeech 只列中英文。')
lines.push('// 英语虽然有在线源，但学英语最常练，随包发能在断网时照常听。')
lines.push('//')
lines.push('// 分包：日语 1.8MB、英语 0.95MB 都放不进 2MB 的主包，分别放在 packageJa / packageEn 分包里，')
lines.push('// 启动时 wx.loadSubpackage 预载；没加载完时 pathFor 返回空串，调用方退回在线合成。')
lines.push('')
lines.push('const REGION = {')
Object.keys(out).forEach(lang => {
  const r = out[lang]
  lines.push('  ' + lang + ': {')
  lines.push('    base: ' + q(r.base) + ',')
  lines.push('    remote: ' + q(r.remote || '') + ',')
  lines.push('    name: ' + q(r.name) + ',  // 分包名；空串表示在主包里，随时可用')
  lines.push('    count: ' + r.ids.length + ',')
  lines.push('    bytes: ' + (sizes[lang] || 0) + ',')
  lines.push('    ids: {')
  r.ids.forEach(id => lines.push('      ' + q(id) + ': 1' + (id.indexOf("'") < 0 ? ',' : '')))
  lines.push('    }')
  lines.push('  }' + (lang === 'ja' ? ',' : ''))
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
