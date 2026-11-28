// 页面冒烟测试：把 17 个页面的 onLoad / onShow 真跑一遍。
//
// 为什么需要它：847 条单测里绝大多数是「读源码 + 正则断言」，能证明「代码里有这串字」，
// 但证明不了「这段代码跑得起来」。上一批（b78fd89）就出过一次事故——
// pages/today/today.js 用了 kidMode.allowedWords()，却漏了 require，
// 三处静态断言全部通过、CI 全绿，而用户点「今日待练」是白屏。
//
// 这个脚本用打桩的 wx 环境（未知 API 一律返回 noop）逐页 require + onLoad + onShow，
// 0.5 秒跑完 17 页，能把「少一行 require / 拼错方法名 / 拼错 data 字段」整类问题拦住。
//
// 单独运行：node tests/smoke-pages.js
// 跑测试时也会被 run-tests.js 调用（见 runSmoke()）。

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const PAGES_DIR = path.join(ROOT, 'pages')

const noop = function () {}
const clone = function (v) { return JSON.parse(JSON.stringify(v)) }

// 造一份「什么都能调、调了不炸」的 wx 桩。
// 用 Proxy 兜底：页面里任何一个我没想到的 wx.xxx()，都不会因为不存在而抛错。
function makeWx(store) {
  const base = {
    getStorageInfoSync: function () { return { keys: Object.keys(store), currentSize: 1, limitSize: 10240 } },
    getStorageSync: function (k) { return store[k] === undefined ? '' : clone(store[k]) },
    setStorageSync: function (k, v) { store[k] = v },
    removeStorageSync: function (k) { delete store[k] },
    clearStorageSync: function () { Object.keys(store).forEach(function (k) { delete store[k] }) },
    getSystemInfoSync: function () {
      return { platform: 'devtools', pixelRatio: 2, SDKVersion: '3.5.0', windowWidth: 375, windowHeight: 667 }
    },
    getWindowInfo: function () { return { pixelRatio: 2, windowWidth: 375, windowHeight: 667 } },
    getDeviceInfo: function () { return { platform: 'devtools' } },
    getAppBaseInfo: function () { return { SDKVersion: '3.5.0' } },
    getCurrentPages: function () { return [] },
    getRealtimeLogManager: function () { return null },
    nextTick: function (f) { if (typeof f === 'function') f() },
    getNetworkType: function (o) { if (o && o.success) o.success({ networkType: 'wifi' }) },
    getRecorderManager: function () {
      return { start: noop, stop: noop, pause: noop, resume: noop, onStop: noop, onStart: noop, onError: noop, onFrameRecorded: noop }
    },
    getSetting: function (o) { if (o && o.success) o.success({ authSetting: {} }) },
    openSetting: function (o) { if (o && o.success) o.success({ authSetting: {} }) },
    getFileSystemManager: function () {
      return {
        readFile: function (o) { if (o && o.fail) o.fail({ errMsg: 'no file' }) },
        access: function (o) { if (o && o.fail) o.fail({ errMsg: 'no file' }) },
        stat: function (o) { if (o && o.fail) o.fail({ errMsg: 'no file' }) },
        unlink: function (o) { if (o && o.fail) o.fail({ errMsg: 'no file' }) },
        mkdir: function (o) { if (o && o.fail) o.fail({ errMsg: 'no dir' }) },
        writeFile: function (o) { if (o && o.fail) o.fail({ errMsg: 'no dir' }) },
        readdir: function (o) { if (o && o.success) o.success({ files: [] }) }
      }
    },
    saveFile: function (o) { if (o && o.fail) o.fail({ errMsg: 'saveFile:fail' }) },
    getSavedFileList: function (o) { if (o && o.success) o.success({ fileList: [] }) },
    removeSavedFile: function (o) { if (o && o.fail) o.fail({ errMsg: 'rm:fail' }) },
    createInnerAudioContext: function () {
      return {
        play: noop, pause: noop, stop: noop, seek: noop, destroy: noop,
        onPlay: noop, onPause: noop, onStop: noop, onEnded: noop, onError: noop,
        onDuration: noop, onCanplay: noop, onWaiting: noop, onSeeking: noop
      }
    },
    // 统计页用来量 canvas 尺寸；返回一个什么都能链的对象
    createSelectorQuery: function () {
      const q = {
        select: function () { return q },
        selectAll: function () { return q },
        in: function () { return q },
        fields: function () { return q },
        boundingClientRect: function () { return q },
        exec: function (cb) { if (typeof cb === 'function') cb([null]) }
      }
      return q
    },
    createCanvasContext: function () {
      const c = {}
      ;['draw', 'fill', 'fillRect', 'clearRect', 'fillText', 'drawImage', 'setFillStyle',
        'setFontSize', 'setTextAlign', 'save', 'restore', 'beginPath', 'arc', 'closePath',
        'scale', 'translate', 'measureText'].forEach(function (k) {
        c[k] = function () { return { width: 10 } }
      })
      return c
    },
    canvasToTempFilePath: function (o) { if (o && o.success) o.success({ tempFilePath: 'wxfile://canvas.png' }) },
    request: function (o) { if (o && o.fail) o.fail({ errMsg: 'request:fail' }) },
    downloadFile: function (o) { if (o && o.fail) o.fail({ errMsg: 'downloadFile:fail' }) },
    showToast: noop, hideToast: noop, showLoading: noop, hideLoading: noop,
    showModal: noop, showActionSheet: noop,
    navigateTo: noop, navigateBack: noop, redirectTo: noop, switchTab: noop, reLaunch: noop,
    setNavigationBarTitle: noop, setNavigationBarColor: noop,
    setClipboardData: function (o) { if (o && o.success) o.success({}) },
    vibrateShort: noop, setInnerAudioOption: noop,
    login: function (o) { if (o && o.fail) o.fail({ errMsg: 'login:fail' }) },
    env: { USER_DATA_PATH: 'wxfile://usr' }
  }
  return new Proxy(base, {
    get: function (t, k) { return (k in t) ? t[k] : noop }
  })
}

// 从页面实例里把 behaviors.methods 合并进来（theme Behavior 提供 syncTheme 等）
function hydrate(def) {
  const inst = Object.assign({}, def)
  ;(def.behaviors || []).forEach(function (b) {
    const m = (b && b.methods) || {}
    Object.keys(m).forEach(function (k) { if (inst[k] === undefined) inst[k] = m[k] })
    if (!b) return
    Object.keys(b).forEach(function (k) {
      if (k !== 'data' && k !== 'methods' && inst[k] === undefined) inst[k] = b[k]
    })
  })
  // Behavior 里也可能带 data（theme 就带 themeClass/fontScale/darkMode/isKid）
  const dataSeed = {}
  ;(def.behaviors || []).forEach(function (b) {
    Object.keys((b && b.data) || {}).forEach(function (k) { dataSeed[k] = b.data[k] })
  })
  Object.keys(def.data || {}).forEach(function (k) { dataSeed[k] = def.data[k] })
  inst.data = clone(dataSeed)
  inst._dataSeedKeys = Object.keys(dataSeed)
  inst._setDataKeys = []
  inst.setData = function (patch, cb) {
    Object.keys(patch || {}).forEach(function (k) {
      inst._setDataKeys.push(k)
      inst.data[k] = patch[k]
    })
    if (typeof cb === 'function') cb()
  }
  return inst
}

/**
 * 跑全部页面。
 * @param {(cond:boolean,msg:string)=>void} ok 断言函数
 * @returns {{ok:number, pages:number, problems:string[]}}
 */
function run(ok) {
  const saved = {
    wx: global.wx, getApp: global.getApp, App: global.App,
    Behavior: global.Behavior, Component: global.Component, Page: global.Page,
    setTimeout: global.setTimeout, setInterval: global.setInterval
  }
  // 页面里常见 setTimeout(() => this.play(), 300) 这种延迟动作。
  // 真让它 300ms 后触发，跑完 run() 之后 wx 已经还原，回调就会炸在测试框架里。
  // 所以把定时器收集起来，等所有页面都跑完、wx 还装着的时候再统一排空——
  // 这样既不会漏测「延迟动作」，也不会在测试结束后留一个野回调。
  const pending = []
  global.setTimeout = function (fn) { pending.push(fn); return pending.length }
  global.setInterval = function () { return 0 }
  const store = {}
  let captured = null
  const problems = []
  let checked = 0

  global.wx = makeWx(store)
  global.getApp = function () { return { globalData: {} } }
  global.App = function () {}
  // 页面里 behaviors: [theme]，theme 是 Behavior({ data, methods })——原样返回即可
  global.Behavior = function (o) { return o || {} }
  global.Component = function (o) { captured = o; return o }
  global.Page = function (o) { captured = o; return o }

  let dirs = []
  try {
    dirs = fs.readdirSync(PAGES_DIR)
  } catch (e) {
    problems.push('读不到 pages 目录: ' + e.message)
  }

  dirs.forEach(function (name) {
    const rel = 'pages/' + name + '/' + name
    const jsPath = path.join(ROOT, rel + '.js')
    if (!fs.existsSync(jsPath)) return
    checked++

    captured = null
    try {
      require(jsPath)
    } catch (e) {
      problems.push(rel + ' 加载失败: ' + e.message)
      return
    }
    const def = captured
    if (!def) { problems.push(rel + ' 没有调用 Page()'); return }

    const inst = hydrate(def)
    inst.route = rel
    if (ok) ok(true, '页面可加载: ' + rel)

    try {
      if (typeof inst.onLoad === 'function') inst.onLoad({})
      if (typeof inst.onShow === 'function') inst.onShow()
      if (ok) ok(true, 'onLoad/onShow 不抛异常: ' + rel)
    } catch (e) {
      problems.push(rel + ' 运行时报错: ' + e.message)
      if (ok) ok(false, 'onLoad/onShow 不抛异常: ' + rel + ' → ' + e.message)
      return
    }

    // 注意：不检查「setData 的键是否在初始 data 里」——微信允许 setData 新增键，
    // 项目里也有页面这么用（themeClass、isKid 等由 Behavior 注入），强查只会误报。
  })

  // 排空页面排下的延迟动作（最多 300 个，防相互递归套娃）
  let drained = 0
  while (pending.length && drained < 300) {
    const fn = pending.shift()
    drained++
    try {
      if (typeof fn === 'function') fn()
    } catch (e) {
      problems.push('延迟动作报错: ' + e.message)
    }
  }

  // 恢复现场，别污染其它用例
  global.setTimeout = saved.setTimeout
  global.setInterval = saved.setInterval
  global.wx = saved.wx
  global.getApp = saved.getApp
  global.App = saved.App
  global.Behavior = saved.Behavior
  global.Component = saved.Component
  global.Page = saved.Page

  return { pages: checked, problems: problems }
}


// 去掉注释再扫声明：否则被注释掉的 `// const kidMode = require(...)`
// 仍会被「声明」正则匹配到，静态守门就失效了（这正是要防的那种情况）。
function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  let quote = ''
  while (i < n) {
    const c = src[i]
    const next = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') { out += next || ''; i += 2; continue }
      if (c === quote) quote = ''
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue }
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * 静态守门：每个页面用到的 `xxx.` 模块前缀，必须在本文件里 require / 声明过。
 * 这条专门用来防「漏写 require」——正是 b78fd89 那个事故的形态。
 */
function undeclaredModules() {
  // 这些不是模块：全局对象、内置、以及页面内的局部变量名（由声明处收进来）
  const GLOBALS = new Set([
    'wx', 'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
    'Date', 'Promise', 'this', 'module', 'exports', 'require', 'process', 'Set', 'Map',
    'RegExp', 'Error', 'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent',
    'decodeURIComponent', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'
  ])

  const bad = []
  fs.readdirSync(PAGES_DIR).forEach(function (name) {
    const rel = 'pages/' + name + '/' + name + '.js'
    const p = path.join(ROOT, rel)
    if (!fs.existsSync(p)) return
    const src = stripComments(fs.readFileSync(p, 'utf8'))

    const declared = new Set()
    let m
    const reAssign = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g
    while ((m = reAssign.exec(src))) declared.add(m[1])
    const reDestruct = /(?:const|let|var)\s*\{([^}]*)\}\s*=/g
    while ((m = reDestruct.exec(src))) {
      m[1].split(',').forEach(function (s) {
        const n = s.split(':').pop().trim()
        if (n) declared.add(n)
      })
    }
    const reFn = /function\s+([A-Za-z_$][\w$]*)/g
    while ((m = reFn.exec(src))) declared.add(m[1])
    // Page({ ... }) 里的方法简写（两空格缩进的 name(）
    const reMethod = /^\s{2}([A-Za-z_$][\w$]*)\s*\(/gm
    while ((m = reMethod.exec(src))) declared.add(m[1])

    // 箭头函数参数：s => ... / (a, b) => ... / .map(line => ...)
    const reArrow = /(?:\(([^)]*)\)|(\b[A-Za-z_$][\w$]*))\s*=>/g
    let mm
    while ((mm = reArrow.exec(src))) {
      const group = mm[1] || mm[2] || ''
      group.split(',').forEach(function (x) {
        const n = x.trim()
        if (n && /^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n)
      })
    }

    const used = new Set()
    const reUse = /(^|[^.\w$])([a-z][\w$]*)\.[A-Za-z_$][\w$]*\s*\(/g
    while ((m = reUse.exec(src))) used.add(m[2])

    const missing = []
    used.forEach(function (u) {
      if (!GLOBALS.has(u) && !declared.has(u)) missing.push(u)
    })
    if (missing.length) bad.push({ page: rel, missing: missing })
  })
  return bad
}

module.exports = { run: run, undeclaredModules: undeclaredModules }

// 单独执行时打印一份报告
if (require.main === module) {
  const res = run(null)
  const bad = undeclaredModules()
  console.log('冒烟页数：' + res.pages)
  if (res.problems.length) {
    console.log('\n运行问题：')
    res.problems.forEach(function (p) { console.log('  ✗ ' + p) })
  }
  if (bad.length) {
    console.log('\n未声明的模块引用：')
    bad.forEach(function (b) { console.log('  ✗ ' + b.page + ' → ' + b.missing.join(', ')) })
  }
  if (!res.problems.length && !bad.length) console.log('\n✅ 所有页面 onLoad/onShow 无异常，模块引用完整')
  else process.exit(1)
}
