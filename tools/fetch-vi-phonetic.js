// 用线上 AI（Cloudflare Worker + Gemini）给越南语单词补音标。
//
// 为什么需要它：越南语 6 个声调，音标里要标出声调曲线（如 phở [fɤː˧˩]）才有意义。
// 手写近似 IPA 往往只标了元音、没标声调，而模型给的声调 IPA 明显更规范。
//
// 用法：
//   node tools/fetch-vi-phonetic.js            # 查库里所有越南语单词，结果写 /tmp/vi-phonetic.json
//   node tools/fetch-vi-phonetic.js --apply    # 直接改进 utils/words.vi.js（改前会打 diff 预览）
//
// 注意：
//   1. Worker 有「每 IP 每天 300 次」限流，80 个词一次跑完远没到上限；
//   2. 结果进 KV 缓存 30 天，重跑同一个词不再花额度；
//   3. 只信任「括号里的 IPA」，取不到括号的条目不采纳（宁可保留手写近似，也不写错）。

const https = require('https')
const fs = require('fs')
const path = require('path')

const HOST = 'ai.qy663.de5.net'
const ROOT = path.join(__dirname, '..')

function lookup(word) {
  return new Promise(function (resolve) {
    const q = encodeURIComponent(word)
    const req = https.get({
      host: HOST,
      path: '/lookup?q=' + q + '&lang=vi',
      headers: { 'User-Agent': 'yuban-phonetic-backfill' }
    }, function (res) {
      let buf = ''
      res.on('data', function (c) { buf += c })
      res.on('end', function () {
        try { resolve(JSON.parse(buf)) } catch (e) { resolve({ ok: false, error: 'bad-json' }) }
      })
    })
    req.on('error', function (e) { resolve({ ok: false, error: e.message }) })
    req.setTimeout(30000, function () { req.destroy(); resolve({ ok: false, error: 'timeout' }) })
  })
}

// 从「phở [fɤː˧˩]」这种串里抠出方括号部分；没有括号返回空串
function ipaOf(phonetic) {
  const m = String(phonetic || '').match(/\[([^\]]{1,80})\]/)
  return m ? m[1].trim() : ''
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }

async function main() {
  const words = require(path.join(ROOT, 'utils', 'words.vi.js')).words
  const out = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const r = await lookup(w.word)
    const ipa = r && r.found ? ipaOf(r.phonetic) : ''
    out.push({ id: w.id, word: w.word, old: w.phonetic, phonetic: ipa, meaning: (r && r.meaning) || '' })
    console.log((i + 1) + '/' + words.length, w.id, w.word, '→', ipa || '(取不到，保留原音标)')
    await sleep(250)   // 别把 Worker 和 Gemini 打得太急
  }
  fs.writeFileSync('/tmp/vi-phonetic.json', JSON.stringify(out, null, 2))
  const good = out.filter(function (x) { return x.phonetic }).length
  console.log('\n有 AI 音标 ' + good + ' / ' + out.length + '，已写 /tmp/vi-phonetic.json')

  if (process.argv.indexOf('--apply') < 0) {
    console.log('确认后再跑：node tools/fetch-vi-phonetic.js --apply')
    return
  }

  const file = path.join(ROOT, 'utils', 'words.vi.js')
  let src = fs.readFileSync(file, 'utf8')
  let changed = 0
  out.forEach(function (x) {
    if (!x.phonetic) return
    const target = '[ ' + x.phonetic + ' ]'
    const re = new RegExp('(\\{ id: "' + x.id + '", word: "[^"]*", phonetic: )"[^"]*"')
    if (!re.test(src)) return
    src = src.replace(re, function (m, head) { return head + JSON.stringify(target) })
    changed++
  })
  fs.writeFileSync(file, src)
  console.log('已更新 ' + changed + ' 条音标 → utils/words.vi.js（记得跑 node tests/run-tests.js）')
}

main()
