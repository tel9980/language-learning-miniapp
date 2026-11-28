// 儿童模式取词实测（由 tests/run-tests.js 的 Q7 用子进程调用）
// 为什么要单开一个进程：页面模块是 Page({...}) 的形式，require 时就定型了，
// 同一个进程里没法重新加载同一页；而「切模式后每个入口是否立刻换范围」这件事
// 只有真的把三个页面各跑一遍才能验。
// 输出：最后一行是 JSON，前面是各 utils 的日志（被父进程忽略）。
const path = require('path')
const ROOT = path.join(__dirname, '..')

const store = {}
global.Behavior = function (o) { return o || {} }
let lastPage = null
global.Page = function (o) { lastPage = o; return o }
global.App = function () {}
global.getCurrentPages = function () { return [{ route: 'pages/learn/learn' }] }
global.wx = new Proxy({
  getStorageSync: k => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v },
  removeStorageSync: k => { delete store[k] },
  getStorageInfoSync: () => ({ keys: Object.keys(store), currentSize: 1, limitSize: 10240 }),
  showToast: () => {}, showModal: () => {}, showActionSheet: () => {},
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, platform: 'devtools' }),
  createInnerAudioContext: () => ({
    play() {}, stop() {}, destroy() {}, pause() {}, seek() {},
    onPlay() {}, onEnded() {}, onError() {}, onCanplay() {}, onTimeUpdate() {},
    onStop() {}, onWaiting() {}, onSeeked() {}
  }),
  createSelectorQuery: () => ({
    select() { return this }, fields() { return this }, exec() {},
    boundingClientRect() { return this }, in() { return this }
  }),
  createCanvasContext: () => new Proxy({}, { get: () => () => {} }),
  getNetworkType: o => o.success && o.success({ networkType: 'wifi' }),
  getSetting: o => o.success && o.success({ authSetting: {} }),
  setKeepScreenOn: () => {},
  request: () => {}, downloadFile: () => {},
  navigateTo: () => {}, switchTab: () => {}, reLaunch: () => {},
  navigateBack: () => {}, showShareMenu: () => {}, onNetworkStatusChange: () => {}
}, { get: (t, k) => (k in t ? t[k] : function () {}) })

function hydrate(def) {
  const inst = Object.create(def)
  inst.data = JSON.parse(JSON.stringify(def.data || {}))
  ;(def.behaviors || []).forEach(function (b) {
    Object.assign(inst.data, JSON.parse(JSON.stringify(b.data || {})))
    Object.assign(inst, b.methods || {})
  })
  inst.setData = function (o, cb) { Object.assign(inst.data, o); if (cb) cb.call(inst) }
  return inst
}
function loadPage(rel) {
  require(path.join(ROOT, rel))
  return hydrate(lastPage)
}

const storage = require(path.join(ROOT, 'utils/storage'))
storage.init()
const profile = require(path.join(ROOT, 'utils/profile'))
const kidMode = require(path.join(ROOT, 'utils/kid-mode'))
const byId = {}
require(path.join(ROOT, 'utils/words')).getWords('en').forEach(function (w) { byId[w.id] = w })
function catOf(x) {
  const w = byId[x.id]
  if (w) return w.category
  const raw = x.word
  return (raw && raw.category) || x.category || ''
}

// 先当大人用一遍，再切儿童模式——模拟真实场景：档案已切，页面新进
profile.setMode(profile.current(), 'kid')

const dict = loadPage('pages/dictation/dictation.js')
dict.onLoad()
dict.onShow()
const dq = dict.data.queue || []

const learn = loadPage('pages/learn/learn.js')
learn.onShow()

const quiz = loadPage('pages/quiz/quiz.js')
quiz.onShow()
const qq = quiz.data.queue || []

const res = {
  dict: dq.length,
  dictBad: dq.filter(x => kidMode.hideCategory(catOf(x))).length,
  learnTotal: learn.data.totalWords,
  learnHasExam: learn.data.catNames.some(n => /四级/.test(n)),
  quiz: qq.length,
  quizBad: qq.filter(x => kidMode.hideCategory(catOf(x))).length
}

// 口语页「单词」模式的池子 + 错词本：同样是取词入口，也要跟着模式走
const session = require(path.join(ROOT, 'utils/speak-session'))
function wordBad(list) {
  return (list || []).filter(function (x) { return kidMode.hideCategory(catOf(x)) }).length
}
const poolKid = session.buildQueue({ lang: 'en', track: 'word', isKid: true })
const poolStd = session.buildQueue({ lang: 'en', track: 'word', isKid: false })
res.speakKidBad = wordBad(poolKid)
res.speakStdBad = wordBad(poolStd)
res.speakKidTotal = poolKid.length
res.speakStdTotal = poolStd.length

// 造一条「大人做错的四级词」，看它会不会漏进孩子的错词本
const pk = require(path.join(ROOT, 'utils/progress-keys'))
const examWord = require(path.join(ROOT, 'utils/words')).getWords('en')
  .filter(w => w.category === '四级')[0]
const gi = pk.shardIndexOf(examWord.id)
const shard = {}
shard[examWord.id] = { level: 1, reps: 1, lapses: 2, ef: 2.5, dueAt: Date.now() - 1000 }
// 同一个分片里已有的记录要保留，否则会把别人的进度冲掉
const existRaw = wx.getStorageSync(profile.nsKey(pk.shardKeyAt(gi)))
if (existRaw) Object.assign(shard, JSON.parse(existRaw))
wx.setStorageSync(profile.nsKey(pk.shardKeyAt(gi)), JSON.stringify(shard))
storage.invalidate()

const wrong = loadPage('pages/wrong/wrong.js')
wrong.onShow()
res.wrongHasExam = (wrong.data.items || []).some(x => x.id === examWord.id)

// 切回标准模式：同一批页面实例应当自己恢复（_sig / _quizKid 会识别出模式变了）
profile.setMode(profile.current(), 'normal')
learn.onShow()
res.stdTotal = learn.data.totalWords

process.stdout.write('\n' + JSON.stringify(res) + '\n')
