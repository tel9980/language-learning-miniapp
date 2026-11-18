// 纯函数单元测试（Node 运行，不依赖微信环境）
// 运行：node tests/run-tests.js
// 覆盖：fsrs 调度 / karaoke 分词与高亮时间 / achievements 徽章与日历 / speech-score 相似度

let pass = 0, fail = 0
const failures = []

function ok(cond, msg) {
  if (cond) { pass++ }
  else { fail++; failures.push(msg) }
}
function eq(a, b, msg) { ok(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`) }

// ---- fsrs ----
const fsrs = require('../utils/fsrs')
eq(fsrs.normalize(5), 2, 'fsrs.normalize(5)=2')
eq(fsrs.normalize(3), 1, 'fsrs.normalize(3)=1')
eq(fsrs.normalize(0), 0, 'fsrs.normalize(0)=0')
let s = fsrs.schedule({}, 5)
eq(s.intervalDays, 1, 'first success interval=1 day')
eq(s.reps, 1, 'first success reps=1')
eq(s.level, 1, 'first success level=1')
s = fsrs.schedule({ reps: 1, level: 1, ef: 2.5 }, 5)
eq(s.intervalDays, 6, 'second success interval=6 days')
const lapse = fsrs.schedule({ reps: 3, level: 4, ef: 2.5 }, 0)
eq(lapse.level, 0, 'lapse resets level to 0')
eq(lapse.intervalDays, 0, 'lapse interval=0 (short)')
eq(lapse.lapses, 1, 'lapse increments lapses')
ok(fsrs.schedule({ ef: 9 }, 5).ef <= 2.5, 'ef clamped to <=2.5')
ok(fsrs.dueAt(0) > Date.now(), 'dueAt(0) is in the future')
ok(fsrs.dueAt(1) - Date.now() >= fsrs.DAY - 1000, 'dueAt(1) ~ 1 day')

// ---- karaoke ----
const karaoke = require('../utils/karaoke')
eq(karaoke.tokenize('Hello   world  !').length, 3, 'tokenize splits on whitespace')
eq(karaoke.tokenize('  ').length, 0, 'tokenize empty string')
const timings = karaoke.wordTimings(['a', 'bbbb'], 2000)
eq(timings.length, 2, 'wordTimings count')
ok(timings[0].end <= timings[1].start, 'timings are sequential')
ok(timings[1].end <= 2000 + 5 || timings[1].end > 0, 'timings produced')
const view = karaoke.toView(['a', 'b'], 1)
ok(view[1].active && !view[0].active, 'toView marks active word')

// ---- achievements ----
const ach = require('../utils/achievements')
const badges = ach.compute({ speakTimes: 1, fluent: 0, streak: 7, mastered: 0, dialogues: 0, recordings: 0 })
eq(badges.length, 8, '8 badges defined')
const first = badges.find(b => b.id === 'first_speak')
ok(first.unlocked, 'first_speak unlocked at 1 speak')
const week = badges.find(b => b.id === 'streak_7')
ok(week.unlocked, 'streak_7 unlocked at 7')
const month = badges.find(b => b.id === 'streak_30')
ok(!month.unlocked, 'streak_30 locked at 7')
const cal = ach.calendar({}, {}, 7)
eq(cal.length, 7, 'calendar returns n days')
ok(!cal[cal.length - 1].active, 'empty calendar days inactive')

// ---- speech-score ----
const sc = require('../utils/speech-score')
eq(sc.normalizeText('Hello, World!'), 'hello world', 'normalizeText strips punctuation/case')
eq(sc.similarity('hello world', 'hello world'), 1, 'identical text similarity=1')
eq(sc.similarity('hello', ''), 0, 'empty text similarity=0')
ok(sc.similarity('hello world', 'hello word') > 0.7, 'near match high similarity')
ok(sc.similarity('cat', 'dog') < 0.5, 'different text low similarity')

// ---- sentences (data sanity, needs no wx) ----
const sentences = require('../utils/sentences')
ok(sentences.getSentences('en').length >= 20, 'English sentences >= 20')
ok(sentences.getDialogues('en').length >= 5, 'English dialogues >= 5')
ok(sentences.getAllItems('en').length > 30, 'all speaking items > 30')
ok(sentences.getLevels().indexOf('B2') >= 0, 'has B2 level')
ok(sentences.getSentences('en', 'A1').every(x => x.level === 'A1'), 'level filter works')

// ---- profile + family (with minimal wx storage mock) ----
const _store = {}
global.wx = {
  getStorageSync: k => (k in _store ? _store[k] : ''),
  setStorageSync: (k, v) => { _store[k] = v },
  removeStorageSync: k => { delete _store[k] },
  removeSavedFile: () => {}
}
const profile = require('../utils/profile')
eq(profile.list().length, 1, 'default profile created')
eq(profile.current(), profile.DEFAULT_ID, 'current is default')
const p2 = profile.add('妈妈', 'elder')
eq(profile.list().length, 2, 'profile added')
eq(profile.get(p2).mode, 'elder', 'added profile keeps mode')
ok(profile.nsKey('lp_stats_v1', p2).indexOf('@' + p2) > 0, 'nsKey namespaced by profile')
ok(profile.nsKey('lp_stats_v1') === 'lp_stats_v1@' + profile.current(), 'nsKey uses current profile')
ok(profile.switchTo(p2), 'switch to profile 2')
eq(profile.current(), p2, 'current switched')
const rf = profile.remove(p2)
ok(rf.ok, 'non-default profile removable')
ok(!profile.remove(profile.DEFAULT_ID).ok, 'default profile not removable')
const family = require('../utils/family')
ok(family.addComment('r_test', '加油'), 'add comment ok')
eq(family.getComments('r_test').length, 1, 'comment stored')
family.removeComment('r_test', family.getComments('r_test')[0].id)
eq(family.getComments('r_test').length, 0, 'comment removed')
ok(Array.isArray(family.leaderboard()), 'leaderboard returns array')

// ---- favorites（生词收藏 + 搜索历史） ----
const favorites = require('../utils/favorites')
eq(favorites.list('en').length, 0, 'favorites initially empty')
ok(favorites.toggle('en', 'en_001'), 'toggle adds favorite')
ok(favorites.isFav('en', 'en_001'), 'isFav true after add')
ok(!favorites.toggle('en', 'en_001'), 'toggle removes favorite')
favorites.pushHistory('en', ' hello ')
favorites.pushHistory('en', 'world')
favorites.pushHistory('en', 'hello')
eq(favorites.history('en')[0], 'hello', 'latest search first')
eq(favorites.history('en').length, 2, 'history deduped')
favorites.clearHistory('en')
eq(favorites.history('en').length, 0, 'history cleared')

// ---- family-backup（全家包导出/导入） ----
const familyBackup = require('../utils/family-backup')
const pack = familyBackup.exportAll()
eq(pack.format, 'yuban-family-backup', 'family pack format')
ok(Array.isArray(pack.profiles) && pack.profiles.length >= 1, 'pack has profiles')
ok(!!pack.data && !!pack.global, 'pack has data + global')
const badImport = familyBackup.importAll({ format: 'wrong' }, 'overwrite')
ok(!badImport.ok, 'reject foreign backup')
const goodImport = familyBackup.importAll(pack, 'merge')
ok(goodImport.ok && goodImport.count >= 1, 'import own pack ok')

// ---- 扩容后的素材 ----
ok(sentences.getSentences('en').length >= 100, 'English sentences >= 100')
const allIds = sentences.getSentences('en').map(function (x) { return x.id })
eq(new Set(allIds).size, allIds.length, 'sentence ids unique')

// ---- nav（tabBar 跳转必须走 switchTab，且能跨 tab 传意图） ----
global.wx = global.wx || {}
let lastSwitch = null, lastNav = null
global.wx.switchTab = function (o) { lastSwitch = o.url }
global.wx.navigateTo = function (o) { lastNav = o.url }
const nav = require('../utils/nav')
ok(nav.isTabPage('/pages/speak/speak'), 'speak is a tab page')
ok(nav.isTabPage('pages/learn/learn'), 'learn is a tab page (no leading slash)')
ok(!nav.isTabPage('/pages/search/search'), 'search is not a tab page')
lastSwitch = null; lastNav = null
nav.go('/pages/learn/learn')
eq(lastSwitch, '/pages/learn/learn', 'tab page goes through switchTab')
eq(lastNav, null, 'tab page does not use navigateTo')
nav.go('/pages/search/search')
eq(lastNav, '/pages/search/search', 'normal page goes through navigateTo')
nav.go('/pages/speak/speak', { focus: 1 })
const intent = nav.takeIntent('pages/speak/speak')
ok(intent && intent.focus === 1, 'intent delivered to target page')
eq(nav.takeIntent('pages/speak/speak'), null, 'intent consumed only once')
eq(nav.takeIntent('pages/learn/learn'), null, 'intent not leaked to other pages')

// ---- speech-score tts（无插件时静默降级） ----
let ttsCbCalled = false
sc.tts('hello', 'en_US', function (r) { ttsCbCalled = true; ok(!r.ok, 'tts degrades when no plugin') })
ok(ttsCbCalled, 'tts callback always called')

// ---- audio 发音源降级链 ----
const au = require('../utils/audio')
eq(au.ttsUrl('hello', false), 'https://dict.youdao.com/dictvoice?audio=hello&type=2', 'ttsUrl normal')
eq(au.ttsUrl('hello', true), 'https://dict.youdao.com/dictvoice?audio=hello&type=1', 'ttsUrl slow')
ok(au.baiduUrl('hello world', false, 'en_US').indexOf('lan=en') > 0, 'baidu lan=en')
ok(au.baiduUrl('hello world', false, 'en_US').indexOf('spd=3') > 0, 'baidu normal speed')
ok(au.baiduUrl('hello world', true, 'en_US').indexOf('spd=2') > 0, 'baidu slow speed')
ok(au.baiduUrl('hello world', false, 'en_US').indexOf('text=hello%20world') > 0, 'baidu encodes text')
ok(au.baiduUrl('x', false, 'ja_JP').indexOf('lan=jap') > 0, 'baidu ja maps to jap')

// ---- speech-score 智聆评测（无插件环境下应全部安全降级） ----
eq(sc.countWords('hello'), 1, 'countWords single word')
eq(sc.countWords('How are you doing today'), 5, 'countWords counts words')
eq(sc.countWords(''), 0, 'countWords empty = 0')
eq(sc.canEvaluate('en'), false, 'no eval plugin in test env')
eq(sc.canEvaluate('ja'), false, 'ja never uses eval plugin')
eq(sc.supportsLang('en'), true, 'en supported by eval plugin')
eq(sc.supportsLang('ja'), false, 'ja unsupported by eval plugin')
eq(sc.isSupported(), false, 'isSupported false without any plugin')
eq(sc.isSupported('en'), false, 'isSupported(lang) false without plugin')
ok(!sc.createEvaluator({ text: 'hello', lang: 'en' }).supported, 'evaluator unsupported without plugin')
eq(sc.scoreOf({ pron_accuracy: 82 }, 'word'), 82, 'word score = accuracy')
eq(sc.scoreOf({ pron_accuracy: 80, pron_completion: 100, pron_fluency: 50 }, 'sentence'), 81,
  'sentence score = acc*0.7 + completion*0.2 + fluency*0.1')
eq(sc.scoreOf({}, 'word'), 0, 'missing fields score 0')
eq(sc.scoreOf({ pron_accuracy: 500 }, 'word'), 100, 'score clamped to 100')
const ww = sc.wrongWordsOf({ words: [
  { word: 'hello', tag: 0, pron_accuracy: 90 },
  { word: 'world', tag: 3, pron_accuracy: 40 },
  { word: 'extra', tag: 1, pron_accuracy: 60 }
] })
eq(ww.length, 2, 'only mismatched words returned')
eq(ww[0].tagText, '读错', 'tag 3 = 读错')
eq(ww[1].tagText, '多读', 'tag 1 = 多读')
eq(sc.wrongWordsOf(null).length, 0, 'null result = no wrong words')

// ---- pager（大列表增量渲染） ----
const pager = require('../utils/pager')
const pg = pager.create(30)
eq(pg.size, 30, 'pager page size')
const big = Array.from({ length: 220 }, (_, i) => ({ id: 'x' + i }))
pg.reset(big.length)
ok(pg.hasMore, 'hasMore true for 220 items')
eq(pg.slice(big).length, 30, 'first page renders 30')
eq(pg.slice(big)[0].id, 'x0', 'first page starts at head')
ok(pg.more(), 'more() advances')
eq(pg.slice(big).length, 60, 'second page renders 60')
while (pg.more()) {}
ok(!pg.hasMore, 'exhausted has no more')
eq(pg.slice(big).length, 220, 'renders all after exhaustion')
ok(!pg.more(), 'more() returns false when exhausted')
const small = pager.create(30)
small.reset(5)
ok(!small.hasMore, 'small list has no more')
eq(small.slice([1, 2, 3, 4, 5]).length, 5, 'small list renders fully')
eq(pager.create(0).size, 30, 'invalid page size falls back to default')

// ---- 性能缓存正确性（读次数下降 + 失效无脏数据） ----
const storage = require('../utils/storage')
// 统计 getStorageSync 调用次数
let _reads = 0
const _origGet = global.wx.getStorageSync
global.wx.getStorageSync = function (k) { _reads++; return _origGet(k) }
storage.invalidate(); profile.invalidate()
storage.init()
_reads = 0
storage.getSettings(); storage.getSettings(); storage.getSettings()
ok(_reads <= 1, 'settings read 3x hits cache (<=1 storage read), got ' + _reads)
_reads = 0
storage.getStats(); storage.getStats()
ok(_reads <= 1, 'stats repeated read cached, got ' + _reads)
// write 后立刻能读到新值
storage.setDailyGoal(42)
eq(storage.getSettings().dailyGoal, 42, 'write refreshes cache')
// 外部直写后 invalidate 能拿到新值
const ns = profile.nsKey('lp_settings_v1')
global.wx.setStorageSync(ns, JSON.stringify(Object.assign({}, storage.getSettings(), { dailyGoal: 7 })))
storage.invalidate()
eq(storage.getSettings().dailyGoal, 7, 'invalidate discovers external write')
global.wx.getStorageSync = _origGet

// ---- 写入失败不能静默（否则用户以为存上了） ----
let modalCount = 0
const _origSet2 = global.wx.setStorageSync
const _origErr = console.error
global.wx.showModal = () => { modalCount++ }
console.error = () => {}   // 这条用例故意制造写入失败，压掉预期内的报错日志
global.wx.setStorageSync = () => { throw new Error('quota exceeded') }
storage.invalidate()
storage.setDailyGoal(11)
storage.setDailyGoal(12)
ok(modalCount === 1, 'write failure warns exactly once, got ' + modalCount)
global.wx.setStorageSync = _origSet2
console.error = _origErr
delete global.wx.showModal

console.log(`\n单元测试结果：${pass} 通过 / ${fail} 失败`)
if (fail) {
  failures.forEach(f => console.log('  ✗ ' + f))
  process.exit(1)
} else {
  console.log('✅ ALL TESTS PASSED')
}
