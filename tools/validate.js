// 全量校验：JSON 合法性、JS 语法、页面四件套、tabBar、主包/分包体积
//
// 用法：node tools/validate.js
//
// 微信开发者工具会做同样的事，但真机上传前的「主包超 2MB」「分包超 2MB」
// 这两条最好在本地就卡住——这类问题只在最后一步报错，很浪费时间。
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const root = path.join(__dirname, '..')
const bad = []

function walk(d, out) {
  fs.readdirSync(d).forEach(function (f) {
    if (f === 'node_modules' || f === '.git') return
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) walk(p, out)
    else if (/\.(json|js|wxml|wxss)$/.test(f)) out.push(p)
  })
  return out
}

const files = walk(root, [])
const rel = function (f) { return path.relative(root, f).replace(/\\/g, '/') }

// 1 JSON 合法性
const jsons = files.filter(function (f) { return f.endsWith('.json') })
jsons.forEach(function (f) {
  try { JSON.parse(fs.readFileSync(f, 'utf8')) } catch (e) { bad.push('JSON 非法: ' + rel(f) + ' — ' + e.message) }
})

// 2 JS 语法（tools/ 下是脚本，同样要过）
files.filter(function (f) { return f.endsWith('.js') }).forEach(function (f) {
  const r = cp.spawnSync('node', ['--check', f])
  if (r.status !== 0) bad.push('JS 语法: ' + rel(f))
})

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))

// 3 页面四件套（主包 + 每个分包）
function checkPages(pages, prefix, label) {
  pages.forEach(function (p) {
    const base = prefix ? prefix + '/' + p : p
    ;['js', 'json', 'wxml', 'wxss'].forEach(function (ext) {
      if (!fs.existsSync(path.join(root, base + '.' + ext))) bad.push('缺文件: ' + base + '.' + ext)
    })
  })
}
checkPages(app.pages || [], '', '主包')
const subs = app.subpackages || app.subPackages || []
subs.forEach(function (s) {
  if (!s.pages || !s.pages.length) bad.push('分包没有页面（微信要求分包必须有页面）: ' + s.root)
  checkPages(s.pages || [], s.root, s.root)
})

// 4 tabBar
const tab = (app.tabBar && app.tabBar.list ? app.tabBar.list : []).map(function (x) { return x.pagePath })
if (!tab.length) bad.push('tabBar 为空')

// 5 navigateTo 不能指向 tabBar 页面（要用 switchTab）
;(app.pages || []).forEach(function (p) {
  const f = path.join(root, p + '.js')
  if (!fs.existsSync(f)) return
  const src = fs.readFileSync(f, 'utf8')
  tab.forEach(function (t) {
    const re = new RegExp("navigateTo\\(\\{[^}]*url:\\s*['\"]/?" + t.replace(/\//g, '\\/') + "['\"]")
    if (re.test(src)) bad.push('navigateTo 指向 tabBar: ' + p + ' → ' + t)
  })
})

// 6 体积：主包排除 tools/tests/deploy、*.md、以及分包目录
const subRoots = subs.map(function (s) { return s.root.replace(/\/$/, '') + '/' })
function inSub(r) { return subRoots.some(function (s) { return r.indexOf(s) === 0 }) }
// 体积要算上 mp3 等二进制资源，所以单独走全量文件列表（files 只收四类文本）
function allFiles(d, out) {
  fs.readdirSync(d).forEach(function (f) {
    if (f === 'node_modules' || f === '.git') return
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) allFiles(p, out)
    else out.push(p)
  })
  return out
}
const everyFile = allFiles(root, [])
function kb(limitFilter) {
  let size = 0
  everyFile.forEach(function (f) {
    const r = rel(f)
    if (!limitFilter(r)) return
    size += fs.statSync(f).size
  })
  return size / 1024
}
const mainKb = kb(function (r) {
  if (/^(tools|tests|deploy)\//.test(r)) return false
  if (r.endsWith('.md')) return false
  if (inSub(r)) return false
  return true
})
console.log('JSON ' + jsons.length + ' / JS ' + files.filter(function (f) { return f.endsWith('.js') }).length +
  ' / 页面 ' + (app.pages || []).length + ' + 分包页 ' +
  subs.reduce(function (a, s) { return a + (s.pages || []).length }, 0) + ' / tabBar ' + tab.length)
console.log('主包 ' + mainKb.toFixed(0) + 'KB（上限 2048KB）')
if (mainKb > 2048) bad.push('主包超过 2MB: ' + mainKb.toFixed(0) + 'KB')
subs.forEach(function (s) {
  const rootPrefix = s.root.replace(/\/$/, '') + '/'
  const size = kb(function (r) { return r.indexOf(rootPrefix) === 0 })
  console.log('分包 ' + s.root + ' ' + size.toFixed(0) + 'KB（单个上限 2048KB）')
  if (size > 2048) bad.push('分包超过 2MB: ' + s.root + ' = ' + size.toFixed(0) + 'KB')
})

if (bad.length) {
  console.log('❌ 问题:')
  bad.forEach(function (b) { console.log(' - ' + b) })
  process.exit(1)
}
console.log('✅ 全量校验通过')
