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
ok(jaSent.length >= 100, 'Japanese sentences >= 100')
ok(jaDlg.length >= 8, 'Japanese dialogues >= 8')
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

// 音素级提示：智聆的 words[].phone_info[] 每个音素都有独立准确度，
// 以前只用 tag，现在把「到底哪个音没读对」也带出来（页面显示「think（读错 · θ 34 分）」）。
eq(sc.LOW_PHONE, 60, '音素及格线 60 分')
const wwPhone = sc.wrongWordsOf({ words: [
  {
    word: 'think', tag: 3, pron_accuracy: 45,
    phone_info: [
      { phone: 'θ', pron_accuracy: 34 }, { phone: 'ɪ', pron_accuracy: 88 },
      { phone: 'ŋ', pron_accuracy: 52 }, { phone: 'k', pron_accuracy: 40 }
    ]
  },
  // 整词没读准、但 tag=0（识别器认为词对得上）也要算需要练
  { word: 'cat', tag: 0, pron_accuracy: 42, phone_info: [{ phone: 'æ', pron_accuracy: 30 }] },
  // 整词分高就别来凑热闹
  { word: 'fine', tag: 0, pron_accuracy: 92, phone_info: [{ phone: 'aɪ', pron_accuracy: 20 }] }
] })
eq(wwPhone.length, 2, '整词分低（tag=0）也算需要练的词')
eq(wwPhone[0].phones.map(function (p) { return p.phone }).join(','), 'θ,k,ŋ', '音素按分数升序，只留不及格的，最多 3 个')
eq(wwPhone[0].phones[0].accuracy, 34, '音素分原样带出')
eq(wwPhone[1].tagText, '音不准', 'tag=0 但分低的词也有说明文案')
eq(wwPhone[1].phones[0].phone, 'æ', '低分词也带音素')
eq(sc.wrongWordsOf({ words: [{ word: 'weak', tag: 3, pron_accuracy: 40 }] })[0].phones.length, 0,
  '没有 phone_info 时不报错，phones 为空数组')

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
eq(EN_WORDS.length, 480, 'english word count = 480')
eq(JA_WORDS.length, 110, 'japanese word count = 110')
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
eq(words.getWords('en').length, 480, 'getWords ignores unknown lang fallback')

// ---- audio：日语必须带 le=jap，否则有道只返回 1920 字节静音占位文件 ----
const audio = require('../utils/audio')
ok(audio.ttsUrl('ありがとう', false, 'ja_JP').indexOf('le=jap') > 0, 'kana text asks for japanese voice')
ok(audio.ttsUrl('家', false, 'ja_JP').indexOf('le=jap') > 0, 'kanji-only japanese word asks for japanese voice')
ok(audio.ttsUrl('hello', false, 'en_US').indexOf('le=') < 0, 'english word never asks for japanese voice')
ok(audio.ttsUrl('hello', false, 'ja_JP').indexOf('le=') < 0, 'UI language alone must not turn english into japanese voice')
ok(audio.ttsUrl('How are you', true, 'en_US').indexOf('type=1') > 0, 'slow mode uses type=1')
ok(audio.baiduUrl('How are you doing today', false, 'en_US').indexOf('lan=en') > 0, 'baidu url carries lan=en')
ok(audio.baiduUrl('ありがとう', false, 'ja_JP').indexOf('lan=jap') > 0, 'baidu url carries lan=jap')

// ---- 离线音频：每个素材都必须有对应 mp3 ----
// 日语没有可用的免费在线合成源（有道只支持词、百度 403、同声传译只支持中英文）；
// 英语虽然有在线源，但学英语最常练、断网时也该能听。所以这些 mp3 是素材的
// 组成部分：新增素材却忘了重跑合成，真机上就是「点了没声音」。这里把契约钉死。
const fs = require('fs')
const pathMod = require('path')
const localAudio = require('../utils/local-audio')

// 日语在 packageJa 分包里（1.8MB，主包放不下）：分包没加载好之前不能给路径，
// 否则播放必然失败、还会白弹一次错误提示。
eq(localAudio.pathFor('js015'), '', 'no path for subpackaged audio before the subpackage loads')
eq(localAudio.isReady('ja'), false, 'Japanese audio region starts as not-ready')
localAudio.ensureLoaded('ja')   // 测试环境没有 wx.loadSubpackage → 同步标为可用
eq(localAudio.isReady('ja'), true, 'ensureLoaded marks the region ready when loadSubpackage is unavailable')
eq(localAudio.pathFor('js015'), '/packageJa/ja/js015.mp3', 'Japanese audio lives in the subpackage')
eq(localAudio.isReady('en'), false, 'English audio region also starts as not-ready')
localAudio.ensureLoaded('en')
eq(localAudio.isReady('en'), true, 'ensureLoaded marks the english region ready too')
eq(localAudio.pathFor('s001'), '/packageEn/en/s001.mp3', 'English audio lives in its own subpackage')
eq(localAudio.langOf('js015'), 'ja', 'langOf maps a Japanese id to its region')
eq(localAudio.langOf('s001'), 'en', 'langOf maps an English id to its region')
eq(localAudio.langOf('nope'), '', 'langOf returns empty for unknown ids')
eq(localAudio.pathFor('nope'), '', 'unknown id has no audio')

// 跟读队列里的 id 带前缀（句子 st_ / 对话台词 dl_），而 mp3 文件名用原始 id。
// 两种都得认，否则对话台词永远命中不了离线音频、只能走在线链。
eq(localAudio.idCandidates('dl_d003_1').join(','), 'dl_d003_1,d003_1', 'id candidates strip the queue prefix')
eq(localAudio.pathFor('st_s001'), '/packageEn/en/s001.mp3', 'prefixed sentence id finds the same mp3')
eq(localAudio.pathFor('dl_d003_1'), '/packageEn/en/d003_1.mp3', 'prefixed dialogue line id finds the same mp3')
eq(localAudio.langOf('dl_d003_1'), 'en', 'langOf understands prefixed ids')

const audioIds = []
jaSent.forEach(function (x) { audioIds.push(x.id) })
jaDlg.forEach(function (d) { d.lines.forEach(function (l) { audioIds.push(l.id) }) })
words.getWords('ja').forEach(function (w) {
  audioIds.push(w.id)
  if (w.example) audioIds.push(w.id + '_ex')
})
const noAudio = audioIds.filter(function (id) { return !localAudio.has(id) })
eq(noAudio.length, 0, 'every Japanese item has bundled audio (missing: ' + noAudio.slice(0, 5).join(',') + ')')

// mp3 特征：ID3 标签或帧同步 0xFFE
function badMp3(ids) {
  return ids.filter(function (id) {
    const f = pathMod.join(__dirname, '..', localAudio.pathFor(id))
    if (!fs.existsSync(f)) return true
    const head = fs.readFileSync(f).slice(0, 3)
    return !(head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0))
  })
}
function kbOf(ids) {
  return ids.reduce(function (sum, id) {
    return sum + fs.statSync(pathMod.join(__dirname, '..', localAudio.pathFor(id))).size
  }, 0) / 1024
}
const badAudio = badMp3(audioIds)
eq(badAudio.length, 0, 'bundled audio files are real mp3 (bad: ' + badAudio.slice(0, 5).join(',') + ')')
const audioKb = kbOf(audioIds)
ok(audioKb < 1900, 'Japanese audio stays under 1.9MB (actual ' + audioKb.toFixed(0) + 'KB, 分包上限 2MB)')
ok(localAudio.countOf('ja') === audioIds.length,
  'local-audio index covers exactly the current Japanese items (' + localAudio.countOf('ja') + ' vs ' + audioIds.length + ')')

// 英语：只预生成句子与对话台词（单词在线发音一直稳，880 个文件塞不进任何一个分包）
const enAudioIds = []
sentences.getSentences('en').forEach(function (x) { enAudioIds.push(x.id) })
sentences.getDialogues('en').forEach(function (d) { d.lines.forEach(function (l) { enAudioIds.push(l.id) }) })
const enMissing = enAudioIds.filter(function (id) { return !localAudio.has(id) })
eq(enMissing.length, 0, 'every English sentence has bundled audio (missing: ' + enMissing.slice(0, 5).join(',') + ')')
eq(badMp3(enAudioIds).length, 0, 'English audio files are real mp3')
const enKb = kbOf(enAudioIds)
ok(enKb < 1200, 'English audio stays under 1.2MB (actual ' + enKb.toFixed(0) + 'KB, 分包上限 2MB)')

// 代码包内的 mp3 真机播不了 —— 实录报错：
//   [InnerAudio] operateAudio fail: errMsg="operateAudio:fail:access denied, appId=wx..."
// 所以必须先复制到 USER_DATA_PATH 再播。这段锁死「复制一次、之后复用」的契约。
let playedSrc = null
global.wx.createInnerAudioContext = function () {
  const c = { onEnded() {}, onError(fn) { c._onErr = fn }, stop() {}, destroy() {}, play() {} }
  Object.defineProperty(c, 'src', { set(v) { playedSrc = v }, get() { return playedSrc } })
  global.__lastCtx = c        // 让测试能主动模拟「播放失败」
  return c
}
const _pkgFs = {}
global.wx.env = { USER_DATA_PATH: 'wxfile://usr' }
global.wx.getFileSystemManager = function () {
  return {
    readFileSync(p) {
      if (p in _pkgFs) return _pkgFs[p]
      if (/\.mp3$/.test(p)) return 'MP3:' + p          // 模拟代码包内的文件
      throw new Error('no such file: ' + p)
    },
    writeFileSync(p, data) { _pkgFs[p] = String(data) },
    accessSync(p) { if (!(p in _pkgFs)) throw new Error('no such file') },
    mkdirSync() {},
    statSync(p) {
      if (!(p in _pkgFs)) throw new Error('no such file')
      return { size: _pkgFs[p].length, lastModifiedTime: 1 }
    },
    readdirSync() {
      const pre = 'wxfile://usr/pkg-audio/'
      return Object.keys(_pkgFs).filter(function (k) { return k.indexOf(pre) === 0 })
        .map(function (k) { return k.slice(pre.length) })
    },
    unlinkSync(p) { delete _pkgFs[p] }
  }
}
playedSrc = null
const ctlBundled = au.speak('すみません、駅はどこですか。', false, { id: 'js015' })
eq(playedSrc, 'https://yb.qy663.de5.net/audio/js015.mp3', '随包音频先流播 CDN（真机读代码包里的文件不可靠）')
eq(ctlBundled.bundled, true, '控制器能看出这是随包音频（失败时还有两级退路）')
ctlBundled.stop()
playedSrc = null
au.speak('すみません、駅はどこですか。', false, { id: 'js015' })
eq(playedSrc, 'https://yb.qy663.de5.net/audio/js015.mp3', '再听一次仍走 CDN，不依赖包内文件与本地副本')
playedSrc = null
au.speak('hello', false, {})
ok(/^https:\/\//.test(playedSrc || ''), 'speak still goes online for items without bundled audio')
// 对话台词在队列里的 id 是 dl_d003_1，音频文件是 d003_1.mp3 —— 必须能对上，
// 否则「情景对话」整段都只能走在线链（真机上就是听不出声）。
playedSrc = null
au.speak('Hi, I do not think we have met.', false, { id: 'dl_d003_1' })
eq(playedSrc, 'https://yb.qy663.de5.net/audio-en/d003_1.mp3', '对话台词命中随包音频（队列 id 带 dl_ 前缀，CDN 同样用原始 id）')

// pkg-audio：路径扁平化 / 复制后再复制不重复写 / 读不到包内文件时返回空串
const pkgAudio = require('../utils/pkg-audio')
eq(pkgAudio.nameOf('/packageJa/ja/js015.mp3'), 'packageJa_ja_js015.mp3', '包内路径压成扁平文件名')
eq(pkgAudio.ensure('/packageJa/ja/js015.mp3'), 'wxfile://usr/pkg-audio/packageJa_ja_js015.mp3', 'ensure 返回可播路径')
eq(pkgAudio.ensure('/packageEn/en/nope.mp3'), 'wxfile://usr/pkg-audio/packageEn_en_nope.mp3', '任意包内路径都能复制')
const _fsNoMp3 = global.wx.getFileSystemManager
global.wx.getFileSystemManager = function () {
  return { readFileSync() { throw new Error('denied') }, statSync() { throw new Error('none') }, mkdirSync() {}, writeFileSync() {}, readdirSync() { return [] }, unlinkSync() {} }
}
eq(pkgAudio.ensure('/packageJa/ja/blocked.mp3'), '', '读不到包内文件时返回空串（调用方退回在线链）')
global.wx.getFileSystemManager = _fsNoMp3

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

// 主源下载失败：先直接流播同一个源（downloadFile 有白名单限制，直连没有），
// 直连也失败才换下一个源。这条断言就是为了防「白名单没配全 -> 直接静音」这类回归。
_dlCalls.length = 0
let playErrCb = null
global.wx.downloadFile = function (o) {
  _dlCalls.push(o.url)
  if (o.url.indexOf('baidu') >= 0) { o.fail({ errMsg: 'downloadFile:fail' }); return }
  _memFs['wxfile://tmp_tts2.mp3'] = 'x'.repeat(500 * 1024)
  o.success({ statusCode: 200, tempFilePath: 'wxfile://tmp_tts2.mp3' })
}
playedSrc = null
au.speak('This sentence was never cached before', false, {})
eq(_dlCalls.length, 1, '主源下载失败后不重复下载，改为直连同一源')
ok(String(playedSrc).indexOf('baidu') >= 0, '直连播的是主源的 URL（不依赖 downloadFile 白名单）')

// 直连也失败 -> 换下一个源，这次的下载成功
_dlCalls.length = 0
global.wx.downloadFile = function (o) {
  _dlCalls.push(o.url)
  _memFs['wxfile://tmp_tts2.mp3'] = 'x'.repeat(500 * 1024)
  o.success({ statusCode: 200, tempFilePath: 'wxfile://tmp_tts2.mp3' })
}
// 直连也失败 -> 换下一个源（这条链路由下面的 D 段看门狗用例逐源验证，这里只锁「不会静音」）

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
  return runExtraTests()
}).then(() => {
  console.log(`\n单元测试结果：${pass} 通过 / ${fail} 失败`)
  if (fail) {
    failures.forEach(f => console.log('  ✗ ' + f))
    process.exit(1)
  } else {
    console.log('✅ ALL TESTS PASSED')
  }
})

// ---- 追加用例：文件配额账本 / 录音与缓存互相让位 / 弱网看门狗 / wxml 绑定 ----
async function runExtraTests() {
  const budget = require('../utils/file-budget')

  // A. 两个模块共用一份文件配额，额度必须加起来放得下
  ok(budget.RECORDINGS_BYTES + budget.TTS_BYTES <= budget.USABLE_BYTES,
    '录音 + 发音缓存额度之和不超过可用配额')
  ok(budget.USABLE_BYTES < budget.TOTAL_BYTES, '给临时文件留了余量，不把 10MB 用满')
  eq(recordings.MAX_BYTES, budget.RECORDINGS_BYTES, '录音上限取自共享账本')
  eq(ttsCache.MAX_BYTES, budget.TTS_BYTES, '发音缓存上限取自共享账本')

  // 重建内存文件系统（前面的用例已经把它还原了）
  const memFs = {}
  const origFs = global.wx.getFileSystemManager
  const origEnv = global.wx.env
  const origDownload = global.wx.downloadFile
  const origSave = global.wx.saveFile
  global.wx.env = { USER_DATA_PATH: 'wxfile://usr' }
  global.wx.getFileSystemManager = function () {
    return {
      accessSync(p) { if (!(p in memFs)) throw new Error('no such file') },
      mkdirSync() {},
      copyFileSync(from, to) { memFs[to] = memFs[from] || 'x' },
      statSync(p) { if (!(p in memFs)) throw new Error('no such file'); return { size: memFs[p].length } },
      unlinkSync(p) { delete memFs[p] }
    }
  }
  function fillCache(n, bytesEach) {
    for (let i = 0; i < n; i++) {
      memFs['wxfile://c' + i + '.mp3'] = 'x'.repeat(bytesEach)
      ttsCache.store('https://example.com/c' + i + '.mp3', 'wxfile://c' + i + '.mp3')
    }
  }

  // B. trim(limit)：录音写不下时会把缓存压到更小的额度（只看默认上限是压不够的）
  ttsCache.clear()
  fillCache(6, 200 * 1024)
  const beforeTrim = ttsCache.totalBytes()
  const dropped = ttsCache.trim(300 * 1024)
  ok(dropped > 0, 'trim 能按自定义额度淘汰')
  ok(ttsCache.totalBytes() <= 300 * 1024,
    'trim(limit) 压到指定额度以内（' + Math.round(beforeTrim / 1024) + 'KB → ' + Math.round(ttsCache.totalBytes() / 1024) + 'KB）')

  // C. 录音写不下、自己也没得可删时，去压发音缓存再重试一次
  ttsCache.clear()
  fillCache(6, 200 * 1024)
  const beforeReclaim = ttsCache.totalBytes()
  recordings.clear()
  let saveAttempts = 0
  global.wx.saveFile = function (o) {
    saveAttempts++
    if (saveAttempts === 1) { o.fail({ errMsg: 'saveFile:fail:exceed max size' }); return }
    o.success({ savedFilePath: 'wxfile://store_reclaim' })
  }
  const reclaimed = await recordings.save('wxfile://tmp_reclaim.mp3', {})
  ok(!!reclaimed, '腾出缓存空间后录音存下来了')
  eq(saveAttempts, 2, '压完缓存只重试一次')
  ok(ttsCache.totalBytes() < beforeReclaim,
    '缓存被压小了（' + Math.round(beforeReclaim / 1024) + 'KB → ' + Math.round(ttsCache.totalBytes() / 1024) + 'KB）')

  // D. 弱网看门狗：下载迟迟不回调时，到点自动换源，而不是干等 60 秒
  const origSetTimeout = global.setTimeout
  const origClearTimeout = global.clearTimeout
  const timers = []
  global.setTimeout = function (fn, ms) { timers.push({ fn: fn, ms: ms, cancelled: false }); return timers.length }
  global.clearTimeout = function (id) { const t = timers[id - 1]; if (t) t.cancelled = true }
  const dlCalls = []
  global.wx.downloadFile = function (o) { dlCalls.push(o.url) }   // 永不回调，模拟弱网卡住
  const loadingLog = []
  let errored = 0
  playedSrc = null
  au.speak('A sentence that never finishes downloading at all', false, {
    onLoading(on) { loadingLog.push(on) },
    onError() { errored++ }
  })
  eq(loadingLog[0], true, '开始下载就进入加载态（页面能显示「正在加载发音」）')
  eq(timers.length, 1, '下载时挂了看门狗')
  eq(timers[0].ms, au.DOWNLOAD_TIMEOUT, '看门狗时长 = DOWNLOAD_TIMEOUT')
  eq(dlCalls.length, 1, '只发了一次下载请求')
  // 超时后先直接流播同一个源（InnerAudioContext 不吃 downloadFile 白名单），
  // 直连也失败才换下一个源——三个源都试完才真正报错。
  timers[0].fn()
  ok(String(playedSrc).indexOf('baidu') >= 0, '超时后先直连主源')
  eq(loadingLog[loadingLog.length - 1], false, '直连时退出加载态（播放器自己在缓冲）')
  global.__lastCtx._onErr({ errMsg: 'play fail' })
  eq(dlCalls.length, 2, '主源直连也失败，换下一个源继续试')
  eq(loadingLog[loadingLog.length - 1], true, '新源开始下载，重新进入加载态')
  timers[1].fn()
  global.__lastCtx._onErr({ errMsg: 'play fail' })
  eq(dlCalls.length, 3, '第二个源也失败，试第三个')
  timers[2].fn()
  global.__lastCtx._onErr({ errMsg: 'play fail' })
  eq(errored, 1, '三个源都失败后才会报错一次')
  eq(loadingLog[loadingLog.length - 1], false, '最终退出加载态（不会一直转圈）')

  // 停止播放要清掉看门狗，否则迟到的回调会把已经停掉的播放又拉起来
  timers.length = 0
  playedSrc = null
  const ctrl = au.speak('Another sentence that hangs forever and ever', false, {})
  const timerCountBeforeStop = timers.length
  ctrl.destroy()
  eq(timers[timerCountBeforeStop - 1].cancelled, true, 'destroy 会取消还没到点的看门狗')

  global.setTimeout = origSetTimeout
  global.clearTimeout = origClearTimeout
  global.wx.downloadFile = origDownload
  global.wx.saveFile = origSave
  global.wx.getFileSystemManager = origFs
  global.wx.env = origEnv
  ttsCache.clear()

  // E. 静态检查：wxml 里 bind/catch 的函数在页面 js 里必须真的存在
  //    （历史 bug：加了按钮忘了写方法；theme behavior 提供的两个方法要放行）
  const fs = require('fs')
  const path = require('path')
  const ROOT = path.join(__dirname, '..')
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
  const pages = app.pages.concat(
    (app.subpackages || []).flatMap(function (sp) {
      return sp.pages.map(function (p) { return sp.root + '/' + p })
    })
  )
  const fromBehavior = ['syncTheme', 'onThemeChange']
  const missing = []
  pages.forEach(function (p) {
    const wxml = fs.readFileSync(path.join(ROOT, p + '.wxml'), 'utf8')
    const js = fs.readFileSync(path.join(ROOT, p + '.js'), 'utf8')
    const re = /\b(?:bind|catch):?[a-z]+="([A-Za-z_$][\w$]*)"/g
    const seen = {}
    let m
    while ((m = re.exec(wxml))) {
      const fn = m[1]
      if (seen[fn]) continue
      seen[fn] = true
      if (fromBehavior.indexOf(fn) >= 0) continue
      if (!new RegExp('(^|[^\\w$])' + fn + '\\s*[(:]', 'm').test(js)) missing.push(p + ' → ' + fn)
    }
  })
  eq(missing.length, 0, '所有 wxml 绑定的处理函数都存在' + (missing.length ? '：' + missing.join(' / ') : ''))
  ok(pages.length >= 16, '扫到了全部页面（含分包页，共 ' + pages.length + ' 个）')

  // F. 测验组题：优先「今天到期的词」，新词垫底；题目要带 id 与 learned 标记
  //    （历史问题：buildQuiz() 从全库随机抽 10 个，学过的和没见过的混在一起，
  //      答完既不写复习计划、也不进错词本）
  const quizUtil = require('../utils/quiz')
  const NOW = 1700000000000
  const pool = [
    { id: 'a', word: 'alpha', meaning: 'n. 甲', example: 'Alpha.', exampleCn: '甲。' },
    { id: 'b', word: 'beta', meaning: 'n. 乙', example: 'Beta.', exampleCn: '乙。' },
    { id: 'c', word: 'car', meaning: 'n. 车', example: 'Car.', exampleCn: '车。' },
    { id: 'd', word: 'dog', meaning: 'n. 狗', example: 'Dog.', exampleCn: '狗。' }
  ]
  const progMap = { a: { dueAt: NOW - 1000 }, b: { dueAt: NOW + 86400000 } }
  const noShuffle = function () { return 0.99 }   // 不洗牌 + 必出拼写题
  const picked = quizUtil.pickWords(pool, progMap, NOW, 10, noShuffle)
  eq(picked.length, 4, '到期词不够时用其余词补满')
  eq(picked[0].id, 'a', '今天到期的词排最前')
  eq(picked[1].id, 'b', '学过但没到期的排第二')
  ok(picked.slice(2).every(function (w) { return w.id === 'c' || w.id === 'd' }), '没学过的新词垫底')
  eq(quizUtil.pickWords(pool, progMap, NOW, 2, noShuffle).length, 2, 'n 能截断题量')
  eq(quizUtil.pickWords(pool, {}, NOW, 3, noShuffle).length, 3, '一个词都没学过时也能出题')

  const items = quizUtil.buildItems(picked, pool, progMap, noShuffle)
  eq(items.length, 4, '每个词出一道题')
  ok(items.every(function (i) { return i.id && i.answer && i.example }), '题目带 id / 答案 / 例句')
  eq(items[0].learned, true, '学过的词标记 learned（答完要写复习计划）')
  eq(items[2].learned, false, '新词不标记 learned（不替「学新词」记账）')

  const choices = quizUtil.buildItems(picked, pool, progMap, function () { return 0 })
  ok(choices.every(function (i) { return i.type === 'choice' }), '取随机数偏小时出选择题')
  ok(choices.every(function (i) { return i.options.length === 4 }), '选择题固定 4 个选项')
  ok(choices.every(function (i) { return i.options.indexOf(i.answer) >= 0 }), '选项里必有正确答案')
  ok(choices.every(function (i) { return new Set(i.options).size === 4 }), '选项不重复')
  const dupPool = pool.concat([{ id: 'e', word: 'auto', meaning: 'n. 车', example: 'Auto.', exampleCn: '汽车。' }])
  const dupItems = quizUtil.buildItems([pool[2]], dupPool, progMap, function () { return 0 })
  eq(dupItems[0].options.filter(function (o) { return o === 'n. 车' }).length, 1, '释义相同的词不当干扰项')

  // G. 逐词高亮的起点：必须由「音频真正开始播放」触发，不能点下去就跑
  //    （原来点一下就 start()，网络源第一次要下载，字幕先跑完、声音后到）
  const karaoke2 = require('../utils/karaoke')
  const toks2 = ['I', 'am', 'fine']
  let started = 0
  const hl = karaoke2.createHighlighter({
    tokens: toks2, durationMs: 3000,
    onWord(i) { if (i >= 0) started += 1 }
  })
  hl.retime(2000)                       // 启动前拿到真实时长：只记时间表，不该点亮任何词
  eq(started, 0, '未 start 时 retime 不点亮任何词')
  hl.start()
  eq(started, 1, 'start 立刻点亮第一个词')
  hl.destroy()

  // audio: 播放器要能报「开始出声」，没有 onPlay 的老环境退化为立即回调
  const au2 = require('../utils/audio')
  let playCb = null
  const origCreate2 = global.wx.createInnerAudioContext
  global.wx.createInnerAudioContext = function () {
    const c = { onEnded() {}, onError() {}, stop() {}, destroy() {}, play() {}, onPlay(fn) { playCb = fn } }
    Object.defineProperty(c, 'src', { set(v) { this._src = v }, get() { return this._src } })
    return c
  }
  let startedByPlay = 0
  au2.speak('hello world again', false, { onPlay() { startedByPlay += 1 } })
  eq(startedByPlay, 0, '音频没开始播放前不回调 onPlay')
  ok(typeof playCb === 'function', '播放器挂了 onPlay 监听')
  playCb()
  eq(startedByPlay, 1, '音频开始播放时回调 onPlay')

  startedByPlay = 0
  global.wx.createInnerAudioContext = function () {
    // 老基础库没有 onPlay：应立即回调，行为与改造前一致
    const c = { onEnded() {}, onError() {}, stop() {}, destroy() {}, play() {} }
    Object.defineProperty(c, 'src', { set(v) { this._src = v }, get() { return this._src } })
    return c
  }
  au2.speak('hello world again', false, { onPlay() { startedByPlay += 1 } })
  eq(startedByPlay, 1, '没有 onPlay 事件时立即回调（不会永久不亮）')
  global.wx.createInnerAudioContext = origCreate2

  // H. 在线词库多源降级：主源挂了自动换备源，全挂静默降级用旧数据
  const od = require('../utils/online-data')
  const origReq = global.wx.request
  let reqLog = []
  let replies = []
  global.wx.request = function (o) {
    reqLog.push(o.url)
    const r = replies.shift() || { kind: 'fail' }
    if (r.kind === 'ok') o.success({ statusCode: 200, data: r.data })
    else if (r.kind === 'http') o.success({ statusCode: r.code, data: null })
    else o.fail({ errMsg: 'request:fail' })
  }

  // 仓库里默认可能是「已启用」（填了备案域名），先记下来再从「未配置」状态测
  const shippedSources = od.DATA_URLS.slice()
  ok(shippedSources.every(function (u) { return /^https:\/\/.+\.json$/.test(u) }),
    '仓库里配置的地址都是 https 的 .json')
  od.DATA_URLS.splice(0, od.DATA_URLS.length)

  eq(od.configured(), false, '清空后视为未配置')
  eq(od.sources().length, 0, '清空后没有可用的源')
  let o1 = null
  od.checkUpdate(function (r) { o1 = r }, { force: true })
  eq(o1 && o1.reason, 'not-configured', '未配置时回调 not-configured')
  eq(reqLog.length, 0, '未配置时一个请求都不发')

  // DATA_URLS 是同一个数组对象，直接 push 即可模拟「填了地址」
  od.DATA_URLS.push('https://primary.example.com/data.json', 'https://backup.example.com/data.json')
  ok(od.configured(), '填了地址就算已配置')
  eq(od.sources().length, 2, '两个源都被识别')
  eq(od.DATA_URL, 'https://primary.example.com/data.json', 'DATA_URL 兼容旧用法，指向主源')

  reqLog = []
  replies = [{ kind: 'ok', data: { version: 'v1', words: { en: [{ id: 'x' }] } } }]
  let o2 = null
  od.checkUpdate(function (r) { o2 = r }, { force: true })
  eq(o2 && o2.updated, true, '主源正常时更新成功')
  eq(o2.source, 'https://primary.example.com/data.json', '报告来源是主源')
  eq(reqLog.length, 1, '主源成功就不再请求备源')
  eq(od.getOverride() && od.getOverride().version, 'v1', '数据已进内存缓存')

  reqLog = []
  replies = [{ kind: 'fail' }, { kind: 'ok', data: { version: 'v2', words: { en: [{ id: 'y' }] } } }]
  let o3 = null
  od.checkUpdate(function (r) { o3 = r }, { force: true })
  eq(o3 && o3.updated, true, '主源网络失败后备源顶上')
  eq(o3.source, 'https://backup.example.com/data.json', '报告来源是备源')
  eq(reqLog.length, 2, '两个源各请求一次')

  reqLog = []
  replies = [{ kind: 'http', code: 500 }, { kind: 'ok', data: { version: 'v3', words: { en: [{}] } } }]
  let o4 = null
  od.checkUpdate(function (r) { o4 = r }, { force: true })
  eq(o4 && o4.updated, true, '主源返回 500 也换备源')

  reqLog = []
  replies = [{ kind: 'fail' }, { kind: 'fail' }]
  let o5 = null
  od.checkUpdate(function (r) { o5 = r }, { force: true })
  eq(o5 && o5.ok, false, '两个源都挂时报告失败')
  eq(o5.reason, 'network', '失败原因是 network')
  eq(od.getOverride() && od.getOverride().version, 'v3', '全挂时仍保留上次拉到的数据')

  reqLog = []
  replies = [{ kind: 'ok', data: { version: 'v3', words: { en: [{}] } } }]
  let o6 = null
  od.checkUpdate(function (r) { o6 = r }, { force: true })
  eq(o6 && o6.updated, false, '版本号相同不重复写入')
  eq(o6.reason, 'same-version', '同版本标记 same-version')

  // 端到端：拉到的在线数据必须真的替换掉内置词库（否则整条通道等于白搭）
  const onlineWord = { id: 'en_9001', word: 'zebra-online', phonetic: '/ˈziːbrə/', meaning: '在线斑马',
    example: 'A zebra online.', exampleCn: '一只在线斑马。', category: '日常' }
  reqLog = []
  replies = [{ kind: 'ok', data: { version: 'v9', words: { en: [onlineWord], ja: [] } } }]
  let o7 = null
  od.checkUpdate(function (r) { o7 = r }, { force: true })
  eq(o7 && o7.updated, true, '在线版本更新成功')
  eq(words.getWords('en').length, 1, '内置 480 词被在线词库覆盖')
  eq(words.getWords('en')[0].word, 'zebra-online', '取到的就是在线的词')
  eq(words.getWords('ja').length, 110, '没覆盖的语种仍用内置词库')
  ok(words.getExamCategories('en').some(function (c) { return c.name === '日常' }), '在线词的分类也能被分类列表看到')

  // 还原：空数组不构成覆盖（getWords 只在非空时才用覆盖层）
  replies = [{ kind: 'ok', data: { version: 'v10', words: { en: [], ja: [] } } }]
  let o8 = null
  od.checkUpdate(function (r) { o8 = r }, { force: true })
  eq(o8 && o8.updated, true, '空覆盖层版本也能更新')
  eq(words.getWords('en').length, 480, '空覆盖层回落到内置词库')

  // 6 小时节流：别每次启动都为「比一个版本号」白拉 134KB
  const realNow = Date.now
  let fakeNow = realNow()
  Date.now = function () { return fakeNow }
  try {
    // 把缓存恢复成「刚检查过」的状态
    reqLog = []
    replies = [{ kind: 'ok', data: { version: 't1', words: { en: [{ id: 'z1' }] } } }]
    let t1 = null
    od.checkUpdate(function (r) { t1 = r }, { force: true })
    eq(t1 && t1.updated, true, '节流测试：第一次强制检查能联网')
    const afterFirst = reqLog.length

    reqLog = []
    let t2 = null
    od.checkUpdate(function (r) { t2 = r })   // 不带 force
    eq(t2 && t2.reason, 'throttled', '刚检查过再调就节流，不发请求')
    eq(reqLog.length, 0, '节流时一个请求都不发')
    eq(t2 && t2.ok, true, '节流不是失败（静默当作已最新）')

    // 过了 6 小时就该重新联网
    reqLog = []
    fakeNow += od.CHECK_INTERVAL + 1000
    replies = [{ kind: 'ok', data: { version: 't2', words: { en: [{ id: 'z2' }] } } }]
    let t3 = null
    od.checkUpdate(function (r) { t3 = r })
    eq(t3 && t3.updated, true, '超过 6 小时会重新检查并更新')
    eq(reqLog.length, 1, '过点后只请求一次')

    // 同版本时也要刷新「上次检查时间」，否则每次启动都会重新拉
    reqLog = []
    fakeNow += od.CHECK_INTERVAL + 1000
    replies = [{ kind: 'ok', data: { version: 't2', words: { en: [{ id: 'z2' }] } } }]
    let t4 = null
    od.checkUpdate(function (r) { t4 = r })
    eq(t4 && t4.reason, 'same-version', '同版本号标记 same-version')
    reqLog = []
    let t5 = null
    od.checkUpdate(function (r) { t5 = r })
    eq(t5 && t5.reason, 'throttled', '同版本检查后也会重置 6 小时计时')
    eq(reqLog.length, 0, '重置后不再发请求')
    ok(afterFirst >= 1, '节流前确实发生过网络请求')
  } finally {
    Date.now = realNow
  }

  // 线上发布包本身的自洽性：版本号是内容指纹（同一份内容重跑导出必须一样）
  const crypto = require('crypto')
  const shipped = require('../deploy/data.json')
  ok(/^c[0-9a-f]{13}$/.test(shipped.version), 'deploy/data.json 的版本号是内容指纹（c + sha1 前 13 位）')
  const fp = 'c' + crypto.createHash('sha1').update(JSON.stringify({
    words: shipped.words, sentences: shipped.sentences, dialogues: shipped.dialogues
  })).digest('hex').slice(0, 13)
  eq(fp, shipped.version, '指纹与内容一致（改词库才变版本，重复部署不会让用户白拉）')
  eq(shipped.words.en.length, 480, '发布包英语 480 词')
  eq(shipped.words.ja.length, 110, '发布包日语 110 词')
  eq(shipped.sentences.en.length, 120, '发布包英语 120 句')
  eq(shipped.sentences.ja.length, 100, '发布包日语 100 句')
  const cfCopy = require('../deploy/cf/data.json')
  eq(cfCopy.version, shipped.version, '发布目录里的 data.json 与 deploy/data.json 同版本')

  od.DATA_URLS.splice(0, od.DATA_URLS.length)
  Array.prototype.push.apply(od.DATA_URLS, shippedSources)
  global.wx.request = origReq
  eq(od.DATA_URLS.length, shippedSources.length, '测试后还原仓库里的配置')

  // 日语句子在分包里：分包没加载好时不能退在线链（日语整句没有可用在线源，
  // 退过去就是「读不出来」）。必须等分包就绪、再播本地文件。
  delete require.cache[require.resolve('../utils/audio')]
  delete require.cache[require.resolve('../utils/local-audio')]
  const auJa = require('../utils/audio')
  const laJa = require('../utils/local-audio')
  eq(laJa.isReady('ja'), false, '重新加载的模块：日语分包初始未就绪')
  playedSrc = null
  const ctl = auJa.speak('すみません、駅はどこですか。', false, { id: 'st_js015' })
  eq(playedSrc, 'https://yb.qy663.de5.net/audio/js015.mp3', '第一级：流播 CDN（前缀 id 也认）')
  // CDN 也播不出来时（没网/文件丢了）→ 读分包里的文件、复制到用户目录再播
  global.__lastCtx._onErr({ errMsg: 'operateAudio:fail' })
  await new Promise(function (r) { setTimeout(r, 30) })
  eq(playedSrc, 'wxfile://usr/pkg-audio/packageJa_ja_js015.mp3', '第二级：CDN 失败 → 分包副本（真离线）')
  ctl.stop()

  // 分包真加载失败时：同一批 mp3 在 CDN 上也有一份，改成流播，别让用户听到静默。
  eq(laJa.remoteFor('st_js015'), 'https://yb.qy663.de5.net/audio/js015.mp3', '日语素材有 CDN 兜底地址（前缀 id 也认）')
  eq(laJa.remoteFor('s001'), 'https://yb.qy663.de5.net/audio-en/s001.mp3', '英语同样有 CDN 兜底地址（与分包同源发布）')
  delete require.cache[require.resolve('../utils/audio')]
  delete require.cache[require.resolve('../utils/local-audio')]
  const savedLoad = global.wx.loadSubpackage
  global.wx.loadSubpackage = function (o) { setTimeout(function () { if (o.fail) o.fail({ errMsg: 'loadSubpackage:fail' }) }, 0) }
  const auCdn = require('../utils/audio')
  const laCdn = require('../utils/local-audio')
  eq(laCdn.isReady('ja'), false, '分包加载失败后仍未就绪')
  playedSrc = null
  const ctl2 = auCdn.speak('すみません、駅はどこですか。', false, { id: 'st_js015' })
  eq(playedSrc, 'https://yb.qy663.de5.net/audio/js015.mp3', '分包加载失败第一级仍是 CDN')
  global.__lastCtx._onErr({ errMsg: 'operateAudio:fail' })
  await new Promise(function (r) { setTimeout(r, 40) })
  eq(laCdn.isReady('ja'), false, '分包确实没起来')
  ok(/^https:\/\/(dict\.youdao|fanyi\.baidu)/.test(playedSrc || '') || playedSrc === 'https://yb.qy663.de5.net/audio/js015.mp3',
    '第二级也拿不到时退回在线链（不会静默停住）')
  ctl2.stop()
  global.wx.loadSubpackage = savedLoad
}
