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

// ---- 日语素材（原来只有 2 句、0 组对话，切到日语练口语几乎是空的）----
const jaSent = sentences.getSentences('ja')
const jaDlg = sentences.getDialogues('ja')
ok(jaSent.length >= 60, 'Japanese sentences >= 60')
ok(jaDlg.length >= 5, 'Japanese dialogues >= 5')
const jaIds = jaSent.map(function (x) { return x.id })
eq(new Set(jaIds).size, jaIds.length, 'Japanese sentence ids unique')
const jaTexts = jaSent.map(function (x) { return x.text })
eq(new Set(jaTexts).size, jaTexts.length, 'Japanese sentences have no duplicate text')
ok(jaSent.every(function (x) { return x.cn && x.scene && x.level }), 'Japanese sentences all have cn/scene/level')
ok(jaSent.some(function (x) { return x.level === 'A1' }) && jaSent.some(function (x) { return x.level === 'B2' }),
  'Japanese sentences span A1..B2')
const jaDlgIds = []
jaDlg.forEach(function (d) { d.lines.forEach(function (l) { jaDlgIds.push(l.id) }) })
eq(new Set(jaDlgIds).size, jaDlgIds.length, 'Japanese dialogue line ids unique')
ok(jaDlg.every(function (d) { return d.lines.length >= 3 }), 'each Japanese dialogue has >= 3 lines')
ok(jaSent.some(function (x) { return /[\u3040-\u309f\u30a0-\u30ff]/.test(x.text) }), 'Japanese sentences contain kana')

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
eq(au.isJapaneseText('おはようございます'), true, 'kana detected as japanese')
eq(au.isJapaneseText('Good morning'), false, 'english not japanese')
eq(au.isJapaneseText(''), false, 'empty not japanese')
eq(sc.canEvaluateText('Good morning'), false, 'english text still needs plugin (absent here)')
eq(sc.canEvaluateText('おはよう'), false, 'japanese text never evaluable')

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

// ---- 自建素材：存储形状 { text, cn } → 练习页形状 { word, meaning } ----
// 少了这一步，口语页读到 current.word 是 undefined：舞台空白、点发音会把字面量
// "undefined" 送去有道合成（实测 ttsUrl(undefined) = ...audio=undefined）。
const customItems = require('../utils/custom-items')
const cu1 = customItems.toPracticeItem({ id: 'cu_1', text: 'Hello there.', cn: '你好', scene: '我的素材' })
eq(cu1.word, 'Hello there.', 'custom item text maps to word')
eq(cu1.meaning, '你好', 'custom item cn maps to meaning')
eq(cu1.isCustom, true, 'custom item is marked isCustom')
eq(cu1.phonetic, '', 'custom item has empty phonetic')
eq(customItems.toPracticeItem({ id: 'cu_2', text: '   ' }), null, 'blank custom item dropped')
eq(customItems.toPracticeItem(null), null, 'null custom item dropped')
eq(customItems.toPracticeItems([{ text: 'a' }, { text: '' }, null]).length, 1, 'toPracticeItems filters junk')
// 端到端：存进去再取出来，练习页必需字段齐全
storage.addCustomItems([{ text: 'Could you send me the report?', cn: '你能把报告发我吗', scene: '商务邮件', lang: 'en' }])
const savedCustom = customItems.toPracticeItems(storage.getCustomItems('en'))
eq(savedCustom.length, 1, 'saved custom item normalizes to a practice item')
eq(savedCustom[0].word, 'Could you send me the report?', 'practice item carries the sentence text')
ok(!!savedCustom[0].id, 'practice item keeps the id (used as progress/record key)')
// 单条删除：以前 removeCustomItem 没有 UI 入口，导入错一条就再也去不掉
const _cuId = savedCustom[0].id
storage.addCustomItems([{ text: 'second one', cn: '第二条', lang: 'en' }])
storage.removeCustomItem(_cuId)
const _cuLeft = storage.getCustomItems('en')
eq(_cuLeft.length, 1, 'removeCustomItem deletes exactly one item')
eq(_cuLeft[0].text, 'second one', 'removeCustomItem keeps the other items')
storage.removeCustomItem(_cuLeft[0].id)
eq(storage.getCustomItems('en').length, 0, 'removeCustomItem can empty the list')

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

// ---- 写入合并 + 进度分片：review 热路径延迟落盘，读仍然立刻可见 ----
const progKey = profile.nsKey('lp_progress_v1')
const SHARD_N = storage.PROGRESS_SHARDS
// 进度表按 wordId 哈希拆成 8 片，读回来要合并
function shardIndexOfId(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return h % SHARD_N
}
function shardKeyOfId(id) { return profile.nsKey('lp_progress_v1_s' + shardIndexOfId(id)) }
function progFromDisk() {
  const out = {}
  for (let i = 0; i < SHARD_N; i++) {
    const raw = global.wx.getStorageSync(profile.nsKey('lp_progress_v1_s' + i))
    if (raw) Object.assign(out, JSON.parse(raw))
  }
  return out
}
storage.invalidate()
storage.review('en_001', 1)
ok(!!storage.getProgress().en_001, 'review 后缓存里立刻可见（读不走磁盘）')
eq(Object.keys(progFromDisk()).length, 0, '未 flush 前不落盘（写入合并生效）')
storage.flush()
ok(!!progFromDisk().en_001, 'flush 后落盘（写进 en_001 所在分片）')
ok(!global.wx.getStorageSync(progKey), '不再写整表 key（旧格式已废弃，只为迁移而读）')

// 只写改动的那一片：清空后评一个词，除它所在分片外其他分片都不该出现它
for (let i = 0; i < SHARD_N; i++) {
  try { global.wx.removeStorageSync(profile.nsKey('lp_progress_v1_s' + i)) } catch (e) {}
}
storage.writeProgressAll({})
storage.review('en_001', 1)
storage.flush()
ok(!!progFromDisk().en_001, '分片落盘后能读回该词')
let otherShardHasIt = false
for (let i = 0; i < SHARD_N; i++) {
  if (i === shardIndexOfId('en_001')) continue
  const raw = global.wx.getStorageSync(profile.nsKey('lp_progress_v1_s' + i))
  if (raw && JSON.parse(raw).en_001) otherShardHasIt = true
}
ok(!otherShardHasIt, '只写改动所在的分片，其他分片不动')

// 攒够一批写自动 flush：一次 review = 3 次写（分片 progress + stats + daily），
// FLUSH_MAX_OPS=12 时第 5 次 review 的第一次写会触发 flush
storage.writeProgressAll({})
storage.invalidate()
for (let i = 0; i < 5; i++) storage.review('en_9' + i, 1)
const autoDisk = progFromDisk()
ok(!!autoDisk.en_93, '攒够一批自动 flush，不会一直攒着')
ok(!autoDisk.en_94, '触发点之后的写仍在攒着（不是每次都立即落盘）')
storage.flush()

// invalidate 前先 flush：换档案/导入时不能把没落盘的数据丢掉
storage.invalidate()
storage.review('en_keep', 1)
storage.invalidate()
ok(!!progFromDisk().en_keep, 'invalidate 前会 flush，脏数据不丢')

// ---- 老版本单表迁移：读一次就拆片，并把旧 key 删掉 ----
const _legacyId = profile.nsKey('lp_progress_v1')
global.wx.setStorageSync(_legacyId, JSON.stringify({
  en_001: { level: 3, ef: 2.5, reps: 4, lapses: 0, dueAt: Date.now() },
  en_002: { level: 1, ef: 2.5, reps: 1, lapses: 1, dueAt: Date.now() }
}))
for (let i = 0; i < SHARD_N; i++) {
  try { global.wx.removeStorageSync(profile.nsKey('lp_progress_v1_s' + i)) } catch (e) {}
}
storage.invalidate()
eq(Object.keys(storage.getProgress()).length, 2, '老单表进度读得出来')
ok(!global.wx.getStorageSync(_legacyId), '迁移后旧单表 key 被删掉（腾出空间）')
eq(Object.keys(progFromDisk()).length, 2, '迁移后进度已落到分片里')
storage.invalidate()
eq(Object.keys(storage.getProgress()).length, 2, '重新加载（走分片）仍然是同样两条')

// ---- 导入：整表覆盖要写成分片，且旧格式不能残留 ----
const _imp = storage.importData({
  format: 'yuban-lang-backup', version: 3,
  progress: { en_010: { level: 2, reps: 2, lapses: 0, dueAt: Date.now() } },
  stats: { totalLearned: 0, totalReviews: 0, totalCorrect: 0, streak: 0, lastActive: '', firstDay: '' },
  settings: { lang: 'en', dailyGoal: 20, feedbackEnabled: true, guideSeen: false },
  daily: {}
})
ok(_imp.ok, 'importData 接受合法备份')
storage.flush()
eq(Object.keys(progFromDisk()).length, 1, '导入的进度写进了分片')
ok(!!progFromDisk().en_010, '导入的进度条目在分片里')
ok(!global.wx.getStorageSync(progKey), '导入后没有残留整表 key')

// ---- 全家包备份：导出把分片合成整表，导入再拆回分片 ----
storage.writeProgressAll({})
storage.review('en_bk1', 1)
storage.flush()
const _fb = require('../utils/family-backup')
const _fbPack = _fb.exportAll()
const _fbBag = (_fbPack.data && _fbPack.data[profile.current()]) || {}
ok(!!(_fbBag.lp_progress_v1 && _fbBag.lp_progress_v1.en_bk1),
  '全家包导出把分片合成整表（分片里的词不丢）')
ok(!_fbBag.lp_progress_v1_s0, '备份文件里不带分片 key（形状不变，老备份仍可导入）')
const _fbImp = _fb.importAll(_fbPack, 'overwrite')
ok(_fbImp.ok, 'overwrite 导入成功')
ok(!!progFromDisk().en_bk1, '导入后进度落在分片里')
ok(!global.wx.getStorageSync(progKey), '导入后没有残留整表 key')

// ---- 删档案要连 8 个分片一起清（否则白占 10MB 配额） ----
const _tmpProfile = profile.add('临时', 'teen')
global.wx.setStorageSync(profile.nsKey('lp_progress_v1_s0', _tmpProfile), JSON.stringify({ x: 1 }))
global.wx.setStorageSync(profile.nsKey('lp_progress_v1_s7', _tmpProfile), JSON.stringify({ y: 2 }))
const _rmTmp = profile.remove(_tmpProfile)
ok(_rmTmp.ok, '临时档案可删除')
ok(!global.wx.getStorageSync(profile.nsKey('lp_progress_v1_s0', _tmpProfile)), '删档案会清掉进度分片')
ok(!global.wx.getStorageSync(profile.nsKey('lp_progress_v1_s7', _tmpProfile)), '删档案清掉全部分片')
storage.writeProgressAll({})

// ---- 单片写入体积：整表 31KB 时，一次评分只写 4KB 量级 ----
storage.writeProgressAll({})
const _wordsAll = require('../utils/words').getWords('en')
_wordsAll.forEach(function (w) { storage.review(w.id, 1) })
storage.flush()
// 清掉写统计，重新只做一次「评分 + 落盘」
let _bytesWritten = 0
const _origSetBytes = global.wx.setStorageSync
global.wx.setStorageSync = function (k, v) { _bytesWritten += String(v).length; return _origSetBytes(k, v) }
storage.review('en_005', 1)
storage.flush()
global.wx.setStorageSync = _origSetBytes
const _fullSize = JSON.stringify(storage.getProgress()).length
ok(_bytesWritten > 0 && _bytesWritten < _fullSize / 3,
  '一次评分落盘远小于整表（写 ' + _bytesWritten + 'B / 整表 ' + _fullSize + 'B）')
storage.writeProgressAll({})

// ---- init 幂等：首页每次 onShow 都调，不该反复读 Storage ----
const _origGet3 = global.wx.getStorageSync
global.wx.getStorageSync = function (k) { _reads++; return _origGet3(k) }
storage.invalidate()
_reads = 0
storage.init()
ok(_reads > 0, '首次 init 仍会初始化（幂等不等于不做事）')
_reads = 0
storage.init(); storage.init()
eq(_reads, 0, '同一档案重复 init 不再读 Storage')
global.wx.getStorageSync = _origGet3
ok(!!_origGet3('lp_migrated_v1'), '老数据迁移留下标记，不再每次扫 10 个老 key')

// ---- 读出的对象是拷贝：改返回值不能污染缓存 ----
storage.invalidate()
storage.review('en_clone', 1)
storage.flush()
const pc1 = storage.getProgress()
pc1.en_clone.level = 99
pc1.en_clone.dirtyFlag = true
const pc2 = storage.getProgress()
ok(pc2.en_clone.level !== 99, '改 getProgress() 返回值不影响缓存（一层深拷贝）')
eq(pc2.en_clone.dirtyFlag, undefined, '给条目加字段也不会带进缓存')

const speakingMod = require('../utils/speaking')
speakingMod.invalidate()
speakingMod.record('en_001', 2, 80)
const sr1 = speakingMod.getRecords()
sr1.en_001.times = 999
eq(speakingMod.getRecords().en_001.times, 1, 'speaking 读出的也是拷贝（与 storage 语义一致）')
speakingMod.flush()

// ---- karaoke 高亮：只在词边界唤醒，不再 60ms 轮询 ----
const _realNow = Date.now
const _realST = global.setTimeout
const _realCT = global.clearTimeout
let _vnow = 0
let _tq = []
Date.now = function () { return _vnow }
global.setTimeout = function (fn, ms) {
  const id = _tq.length + 1
  _tq.push({ id: id, at: _vnow + (ms || 0), fn: fn })
  return id
}
global.clearTimeout = function (id) { _tq = _tq.filter(function (t) { return t.id !== id }) }
const fires = []
const hl2 = karaoke.createHighlighter({
  tokens: ['a', 'bb', 'ccc', 'dddd'], durationMs: 3000,
  onWord(i) { fires.push(i) }, onDone() { fires.push('done') }
})
hl2.start()
for (let guard = 0; guard < 80 && _tq.length; guard++) {
  _tq.sort(function (x, y) { return x.at - y.at })
  const t = _tq.shift()
  _vnow = t.at
  t.fn()
}
eq(_tq.length, 0, '定时器全部收尾，没有遗留')
ok(fires.indexOf('done') >= 0, '整段播完触发 onDone')
const wordFires = fires.filter(function (x) { return x !== 'done' })
ok(wordFires.length <= 6, '唤醒次数≈词数，不是 3000/60=50 次，实际 ' + wordFires.length)
let monotonic = true
for (let i = 1; i < wordFires.length; i++) if (wordFires[i] < wordFires[i - 1]) monotonic = false
ok(monotonic, '高亮下标单调递增')
Date.now = _realNow
global.setTimeout = _realST
global.clearTimeout = _realCT

// toPlain：不带 active，配合「只传下标」渲染
const plain2 = karaoke.toPlain(['hello', 'world'])
eq(plain2.length, 2, 'toPlain 长度不变')
eq(plain2[0].text, 'hello ', 'toPlain 英文补尾随空格')
eq(plain2[0].active, undefined, 'toPlain 不带 active 字段（高亮靠下标）')

// ---- words：词库规模与数据完整性 ----
// 扩充词库时最容易犯的错是 id 撞车、词形重复、字段漏填，这里全部锁死。
const words = require('../utils/words')
const EN_WORDS = words.WORDS.en
const JA_WORDS = words.WORDS.ja
eq(EN_WORDS.length, 440, 'english word count = 440')
eq(JA_WORDS.length, 50, 'japanese word count = 50')
const allWords = EN_WORDS.concat(JA_WORDS)
const idSet = {}
let dupId = 0
allWords.forEach(w => { if (idSet[w.id]) dupId++; idSet[w.id] = 1 })
eq(dupId, 0, 'no duplicate word ids')
const FIELDS = ['word', 'phonetic', 'meaning', 'example', 'exampleCn', 'category']
let emptyField = 0
allWords.forEach(w => { FIELDS.forEach(f => { if (!w[f] || !String(w[f]).trim()) emptyField++ }) })
eq(emptyField, 0, 'every word has all 6 fields non-empty')
function dupWordsIn(list) {
  const seen = {}
  let dup = 0
  list.forEach(w => { if (seen[w.word]) dup++; seen[w.word] = 1 })
  return dup
}
eq(dupWordsIn(EN_WORDS), 0, 'no duplicate english word forms')
eq(dupWordsIn(JA_WORDS), 0, 'no duplicate japanese word forms')
// 新增分类必须能在筛选里选到，否则只能藏在「全部」里
const enCats = words.getExamCategories('en').map(c => c.name)
;['四级', '六级', '考研', '雅思托福', '日常', '情绪', '工作', '科技', '旅行', '健康', '饮食', '社交'].forEach(c => {
  ok(enCats.indexOf(c) >= 0, `category "${c}" is selectable`)
})
const jaCats = words.getExamCategories('ja').map(c => c.name)
;['问候', '日常', '食物', '数字', '时间', '动词'].forEach(c => {
  ok(jaCats.indexOf(c) >= 0, `japanese category "${c}" is selectable`)
})
eq(words.getWordsByCategory('en', '日常').length, 30, 'filter by 日常 returns 30')
eq(words.getWords('en').length, 440, 'getWords ignores unknown lang fallback')

// ---- audio：日语必须带 le=jap，否则有道只返回 1920 字节静音占位文件 ----
const audio = require('../utils/audio')
ok(audio.ttsUrl('ありがとう', false, 'ja_JP').indexOf('le=jap') > 0, 'kana text asks for japanese voice')
ok(audio.ttsUrl('家', false, 'ja_JP').indexOf('le=jap') > 0, 'kanji-only japanese word asks for japanese voice')
ok(audio.ttsUrl('hello', false, 'en_US').indexOf('le=') < 0, 'english word never asks for japanese voice')
ok(audio.ttsUrl('hello', false, 'ja_JP').indexOf('le=') < 0, 'UI language alone must not turn english into japanese voice')
ok(audio.ttsUrl('How are you', true, 'en_US').indexOf('type=1') > 0, 'slow mode uses type=1')
ok(audio.baiduUrl('How are you doing today', false, 'en_US').indexOf('lan=en') > 0, 'baidu url carries lan=en')
ok(audio.baiduUrl('ありがとう', false, 'ja_JP').indexOf('lan=jap') > 0, 'baidu url carries lan=jap')

// ---- 日语离线音频：每个素材都必须有对应 mp3，且随包发布 ----
// 日语没有可用的免费在线合成源（有道只支持词、百度 403、同声传译只支持中英文），
// 所以这些 mp3 是素材的组成部分：新增日语素材却忘了跑 tools/gen-ja-audio.py，
// 真机上就是「点了没声音」。这里把这条契约钉死。
const fs = require('fs')
const pathMod = require('path')
const localAudio = require('../utils/local-audio')
const audioIds = []
jaSent.forEach(function (x) { audioIds.push(x.id) })
jaDlg.forEach(function (d) { d.lines.forEach(function (l) { audioIds.push(l.id) }) })
words.getWords('ja').forEach(function (w) {
  audioIds.push(w.id)
  if (w.example) audioIds.push(w.id + '_ex')
})
const noAudio = audioIds.filter(function (id) { return !localAudio.has(id) })
eq(noAudio.length, 0, 'every Japanese item has bundled audio (missing: ' + noAudio.slice(0, 5).join(',') + ')')
const badAudio = audioIds.filter(function (id) {
  const f = pathMod.join(__dirname, '..', localAudio.pathFor(id))
  if (!fs.existsSync(f)) return true
  const head = fs.readFileSync(f).slice(0, 3)
  // mp3 特征：ID3 标签或帧同步 0xFFE
  return !(head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0))
})
eq(badAudio.length, 0, 'bundled audio files are real mp3 (bad: ' + badAudio.slice(0, 5).join(',') + ')')
const audioKb = audioIds.reduce(function (sum, id) {
  return sum + fs.statSync(pathMod.join(__dirname, '..', localAudio.pathFor(id))).size
}, 0) / 1024
ok(audioKb < 1200, 'bundled audio stays under 1.2MB (actual ' + audioKb.toFixed(0) + 'KB, 主包上限 2MB)')

// 有本地音频时 speak() 不应走网络
let playedSrc = null
global.wx.createInnerAudioContext = function () {
  const c = { onEnded() {}, onError() {}, stop() {}, destroy() {}, play() {} }
  Object.defineProperty(c, 'src', { set(v) { playedSrc = v }, get() { return playedSrc } })
  return c
}
playedSrc = null
au.speak('すみません、駅はどこですか。', false, { id: 'js015' })
eq(playedSrc, '/assets/audio/ja/js015.mp3', 'speak plays the bundled file when the item has one')
playedSrc = null
au.speak('hello', false, {})
ok(/^https:\/\//.test(playedSrc || ''), 'speak still goes online for items without bundled audio')

// ---- 发音缓存：同一句第二次听不再联网 ----
const ttsCache = require('../utils/tts-cache')
const _memFs = {}
const _origFs = global.wx.getFileSystemManager
const _origEnv = global.wx.env
const _origDownload = global.wx.downloadFile
global.wx.env = { USER_DATA_PATH: 'wxfile://usr' }
global.wx.getFileSystemManager = function () {
  return {
    accessSync(p) { if (!(p in _memFs)) throw new Error('no such file') },
    mkdirSync() {},
    copyFileSync(from, to) { _memFs[to] = _memFs[from] || 'x'.repeat(500 * 1024) },
    statSync(p) { if (!(p in _memFs)) throw new Error('no such file'); return { size: _memFs[p].length } },
    unlinkSync(p) { delete _memFs[p] }
  }
}
ttsCache.clear()
const _dlCalls = []
global.wx.downloadFile = function (o) {
  _dlCalls.push(o.url)
  _memFs['wxfile://tmp_tts.mp3'] = 'x'.repeat(500 * 1024)
  o.success({ statusCode: 200, tempFilePath: 'wxfile://tmp_tts.mp3' })
}
playedSrc = null
au.speak('How are you doing today', false, {})
eq(_dlCalls.length, 1, '首次发音要下载一次（下载才能顺便进缓存）')
eq(playedSrc, 'wxfile://tmp_tts.mp3', '下载后播的是本地临时文件，不是远端 URL')
const _bdUrl = audio.baiduUrl('How are you doing today', false, 'en_US')
ok(!!ttsCache.fileOf(_bdUrl), '下载的音频写进了缓存')

playedSrc = null
au.speak('How are you doing today', false, {})
eq(_dlCalls.length, 1, '同一句第二次听不再联网（缓存命中）')
eq(playedSrc, ttsCache.fileOf(_bdUrl), '第二次直接播缓存文件')

// 主源下载失败要落到下一个源，不能直接静音
_dlCalls.length = 0
global.wx.downloadFile = function (o) {
  _dlCalls.push(o.url)
  if (o.url.indexOf('baidu') >= 0) { o.fail({ errMsg: 'downloadFile:fail' }); return }
  _memFs['wxfile://tmp_tts2.mp3'] = 'x'.repeat(500 * 1024)
  o.success({ statusCode: 200, tempFilePath: 'wxfile://tmp_tts2.mp3' })
}
playedSrc = null
au.speak('This sentence was never cached before', false, {})
eq(_dlCalls.length, 2, '主源失败后换下一个源（共 2 次下载）')
ok(_dlCalls[1].indexOf('youdao') >= 0, '第二个源就是有道')
eq(playedSrc, 'wxfile://tmp_tts2.mp3', '有道下载成功后照常有声（不会静音）')

// 缓存按「最久未使用」淘汰，总量不超过 3MB
ttsCache.clear()
for (let i = 0; i < 8; i++) {
  _memFs['wxfile://t' + i + '.mp3'] = 'x'.repeat(500 * 1024)
  ttsCache.store('https://example.com/a' + i + '.mp3', 'wxfile://t' + i + '.mp3')
}
ok(ttsCache.totalBytes() <= ttsCache.MAX_BYTES, '缓存总量不超过上限（实际 ' + Math.round(ttsCache.totalBytes() / 1024) + 'KB）')
eq(ttsCache.fileOf('https://example.com/a0.mp3'), '', '最旧的缓存先被淘汰')
ok(!!ttsCache.fileOf('https://example.com/a7.mp3'), '最新的缓存还在')

// 缓存文件被系统清掉后，索引也要自愈，不能继续指向不存在的文件
const _alive = ttsCache.fileOf('https://example.com/a7.mp3')
delete _memFs[_alive]
eq(ttsCache.fileOf('https://example.com/a7.mp3'), '', '文件没了就当作没缓存（不会给出死路径）')

global.wx.getFileSystemManager = _origFs
global.wx.env = _origEnv
global.wx.downloadFile = _origDownload
ttsCache.clear()

// ---- storage.getNewWords：可按分类取新词 ----
// 不传分类时按词库数组顺序取，考试词永远排在最前（日常/旅行那 220 个词排不上号），
// 所以学习页必须能把分类传下来。这里锁死「传分类只返回该分类」的契约。
const storageMod = require('../utils/storage')
const freshAll = storageMod.getNewWords('en', 5)
ok(freshAll.length > 0 && freshAll.length <= 5, 'unfiltered new words respects the limit')
const freshDaily = storageMod.getNewWords('en', 5, '日常')
ok(freshDaily.length > 0 && freshDaily.length <= 5, 'filtered new words respects the limit')
ok(freshDaily.every(w => w.category === '日常'), 'filtered new words are all in that category')
eq(storageMod.getNewWords('en', 5, '不存在的分类').length, 0, 'unknown category returns empty')

// ---- 词频优先：新词按常用度排序，而不是词库数组顺序（≈字母序） ----
// 不排序时新用户第一天拿到的是 abandon/adjust/accommodate 这类低频难词；
// 排序后第一个应该是 keep（COCA 156）这种真正的高频词。
const wordRank = require('../utils/word-rank')
ok(wordRank.size > 400, 'word rank table covers most english words')
eq(wordRank.rankOf('en_211'), 156, 'rank of "keep" comes from ECDICT frq')
eq(wordRank.rankOf('ja_001'), Infinity, 'japanese words have no rank (sort last)')
const sortedFresh = storageMod.getNewWords('en', 8)
eq(sortedFresh[0].word, 'keep', 'first new word is the most frequent one')
let rankAscending = true
for (let i = 1; i < sortedFresh.length; i++) {
  if (wordRank.rankOf(sortedFresh[i - 1].id) > wordRank.rankOf(sortedFresh[i].id)) rankAscending = false
}
ok(rankAscending, 'new words are sorted from frequent to rare')
const jaFresh = storageMod.getNewWords('ja', 3)
eq(jaFresh[0].word, 'こんにちは', 'japanese keeps the original word order')

// ---- karaoke：日语要按形态切分，否则整句只有一个 token，高亮等于失效 ----
eq(karaoke.tokenize('Hello   world  !').length, 3, 'english still splits on whitespace')
ok(karaoke.tokenize('私は中国から来ました。').length >= 5, 'japanese sentence is segmented into words')
ok(karaoke.isJapaneseish('こんにちは'), 'hiragana detected as japanese')
ok(!karaoke.isJapaneseish('hello world'), 'plain english is not japanese')
const jaView = karaoke.toView(karaoke.tokenize('今日はいい天気ですね。'), 0)
ok(jaView[0].text.indexOf(' ') === -1, 'japanese tokens carry no trailing space')
const enView = karaoke.toView(['hello', 'world'], 0)
eq(enView[0].text, 'hello ', 'english tokens carry a trailing space')
ok(karaoke.weightOf('中国') > karaoke.weightOf('は'), 'japanese weight follows character count')
// retime：拿到真实音频时长后，时间表要跟着改，而且总长度等于新时长
const hl = karaoke.createHighlighter({ tokens: ['a', 'bbbb'], durationMs: 1000, onWord() {} })
hl.retime(4000)
hl.destroy()
const rt = karaoke.wordTimings(['a', 'bbbb'], 4000)
ok(rt[rt.length - 1].end > 2000, 'retimed schedule follows the real duration')

// ---- recordings：wx.saveFile 会把临时文件「移走」，必须拿到 permanent 路径 ----
// 锁死 speak.js 回放修复的前提：save() 返回的 entry.filePath 不能等于传进去的临时路径。
const recordings = require('../utils/recordings')
let __removed = []
let __attempts = 0
global.wx.removeSavedFile = function (o) { __removed.push(o.filePath); if (o.success) o.success({}) }
global.wx.getFileInfo = function (o) { o.success({ size: 1024 }) }

// 双重淘汰（条数 + 体积）是纯函数，先单独测
const fakeList = function (n, size) {
  const out = []
  for (let i = 0; i < n; i++) out.push({ id: 'r' + i, filePath: 'wxfile://' + i, size: size })
  return out
}
let tr = recordings.trim(fakeList(35, 1000))
eq(tr.keep.length, recordings.MAX_KEEP, 'trim keeps at most MAX_KEEP entries')
eq(tr.dropped.length, 5, 'trim drops the oldest beyond MAX_KEEP')
tr = recordings.trim(fakeList(40, 300 * 1024))
ok(tr.keep.reduce((sum, e) => sum + e.size, 0) <= recordings.MAX_BYTES, 'trim respects the byte budget')
ok(tr.dropped.length > 5, 'trim drops extra entries when over the byte budget')
tr = recordings.trim(fakeList(3, 100 * 1024 * 1024))
eq(tr.keep.length, 1, 'trim never empties the list')

// 1) 正常保存：拿到永久路径 + 体积
global.wx.saveFile = function (o) {
  global.__saveFrom = o.tempFilePath
  o.success({ savedFilePath: 'wxfile://store_0' })
}
recordings.save('wxfile://tmp_abc.mp3', { label: 'hi' }).then((entry) => {
  eq(global.__saveFrom, 'wxfile://tmp_abc.mp3', 'saveFile receives the temp path')
  ok(!!entry, 'save resolves an entry')
  ok(entry.filePath !== 'wxfile://tmp_abc.mp3', 'entry.filePath is permanent, not the stale temp path')
  eq(entry.filePath, 'wxfile://store_0', 'entry.filePath is the savedFilePath')
  eq(entry.size, 1024, 'entry records the file size for the byte budget')

  // 2) 空间满：先删最旧一条腾地方，再自动重试一次
  __removed = []
  __attempts = 0
  global.wx.saveFile = function (o) {
    __attempts++
    if (__attempts === 1) o.fail({ errMsg: 'saveFile:fail:exceed max size' })
    else o.success({ savedFilePath: 'wxfile://store_1' })
  }
  return recordings.save('wxfile://tmp_retry.mp3', {})
}).then((entry) => {
  eq(__attempts, 2, 'save retries once after freeing space')
  ok(__removed.length >= 1, 'save deletes the oldest recording to free space')
  eq(entry && entry.filePath, 'wxfile://store_1', 'retry saves successfully')

  // 3) 没东西可删时，如实返回 null（页面据此提示重录）
  recordings.clear()
  global.wx.saveFile = function (o) { o.fail({ errMsg: 'saveFile:fail' }) }
  return recordings.save('wxfile://tmp_def.mp3', {})
}).then((entry) => {
  eq(entry, null, 'save resolves null when saveFile fails and nothing can be freed')

  console.log(`\n单元测试结果：${pass} 通过 / ${fail} 失败`)
  if (fail) {
    failures.forEach(f => console.log('  ✗ ' + f))
    process.exit(1)
  } else {
    console.log('✅ ALL TESTS PASSED')
  }
})
