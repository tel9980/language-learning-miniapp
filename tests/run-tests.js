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

// 来源权重：低权重只缩间隔，不改档位；同一天重复练不晋级
const baseRec = { reps: 2, level: 2, ef: 2.5, intervalDays: 6 }
const fullW = fsrs.schedule(Object.assign({}, baseRec), 5, { weight: 1 })
const lowW = fsrs.schedule(Object.assign({}, baseRec), 5, { weight: 0.7 })
eq(fullW.level, lowW.level, '权重不改变晋级档位')
ok(lowW.intervalDays < fullW.intervalDays, '权重越低间隔越短（自评只算八成）')
eq(fsrs.schedule({ reps: 2, level: 2, ef: 2.5, intervalDays: 6 }, 5).intervalDays, fullW.intervalDays,
  '不传 opts 与 weight=1 等价（单词行为不变）')
const same = fsrs.schedule({ reps: 5, level: 3, ef: 2.3, intervalDays: 12 }, 5, { sameDay: true })
eq(same.level, 3, '同一天重复练不晋级')
eq(same.intervalDays, 14, '同一天重复练只按 1.2 倍前移（12 → 14）')
eq(fsrs.schedule({ reps: 5, level: 3, ef: 2.3, intervalDays: 12 }, 0, { sameDay: true }).level, 0,
  '答错时 sameDay 照样清零')

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
  getStorageInfoSync: () => ({ keys: Object.keys(_store), currentSize: 0, limitSize: 10240 }),
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

// ---- 越南语素材（2026-11：80 词 + 100 句 + 8 组对话）----
const viSent = sentences.getSentences('vi')
const viDlg = sentences.getDialogues('vi')
eq(viSent.length, 100, 'Vietnamese sentences = 100')
eq(viDlg.length, 8, 'Vietnamese dialogues = 8')
const viSentIds = viSent.map(function (x) { return x.id })
eq(new Set(viSentIds).size, viSentIds.length, 'Vietnamese sentence ids unique')
ok(viSent.every(function (x) { return x.text && x.cn && x.scene && x.level }), 'Vietnamese sentences all complete')
ok(viSent.some(function (x) { return x.level === 'A1' }) && viSent.some(function (x) { return x.level === 'A2' }),
  'Vietnamese sentences span A1..A2')
// 扩到 100 句后要真的覆盖到 B1/B2，否则还是只有入门句
ok(viSent.some(function (x) { return x.level === 'B1' }) && viSent.some(function (x) { return x.level === 'B2' }),
  'Vietnamese sentences also cover B1/B2')
const viDlgIds = []
viDlg.forEach(function (d) { d.lines.forEach(function (l) { viDlgIds.push(l.id) }) })
eq(viDlgIds.length, 44, 'Vietnamese dialogue lines = 44')
eq(new Set(viDlgIds).size, viDlgIds.length, 'Vietnamese dialogue line ids unique')
ok(viDlg.every(function (d) { return d.lines.length >= 3 }), 'each Vietnamese dialogue has >= 3 lines')

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
eq(au.isVietnameseText('xin chào'), true, 'vietnamese diacritics detected')
eq(au.isVietnameseText('hello world'), false, 'plain latin is not vietnamese')
eq(au.isVietnameseText('おはよう'), false, 'kana is not vietnamese')
eq(au.isJapaneseText('Good morning'), false, 'english not japanese')
eq(au.isJapaneseText(''), false, 'empty not japanese')
eq(sc.canEvaluateText('Good morning'), false, 'english text still needs plugin (absent here)')
eq(sc.canEvaluateText('おはよう'), false, 'japanese text never evaluable')

// 审核可能要求移除插件（个人主体用不了「IT科技-软件服务提供商」类目插件）。
// 移除后 requirePlugin 会抛错——模块加载与各项判断必须扛得住，不能一进页面就崩。
;(function () {
  const saved = global.requirePlugin
  global.requirePlugin = function () { throw new Error('plugin not declared') }
  try {
    const deps = require.resolve('../utils/speech-score')
    delete require.cache[deps]
    const bare = require('../utils/speech-score')
    eq(bare.canEvaluateText('Good morning'), false, '插件缺失时英文也不评测')
    eq(bare.canEvaluate('en'), false, '插件缺失时按语种判断为不可用')
    eq(bare.canTts(), false, '插件缺失时没有插件 TTS')
    ok(bare.scoreOf(null) === 0 || bare.scoreOf(null) == null, '没有结果时不抛错')
    ok(bare.wrongWordsOf(null).length === 0, '没有结果时错词列表为空')
  } finally {
    global.requirePlugin = saved
    delete require.cache[require.resolve('../utils/speech-score')]
  }
})()

// ---- speech-score 智聆评测（无插件环境下应全部安全降级） ----
eq(sc.countWords('hello'), 1, 'countWords single word')
eq(sc.countWords('How are you doing today'), 5, 'countWords counts words')
eq(sc.countWords(''), 0, 'countWords empty = 0')
eq(sc.canEvaluate('en'), false, 'no eval plugin in test env')
eq(sc.canEvaluate('ja'), false, 'ja never uses eval plugin')
eq(sc.canEvaluate('vi'), false, 'vi never uses eval plugin（智聆只支持中英文）')
eq(sc.canEvaluateText('xin chào'), false, 'vietnamese text is not sent to the eval plugin')
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
const VI_WORDS = words.WORDS.vi
eq(EN_WORDS.length, 800, 'english word count = 800')
eq(JA_WORDS.length, 110, 'japanese word count = 110')
eq(VI_WORDS.length, 80, 'vietnamese word count = 80')
const allWords = EN_WORDS.concat(JA_WORDS, VI_WORDS)
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
eq(dupWordsIn(VI_WORDS), 0, 'no duplicate vietnamese word forms')
// 英语 800 词全部带第二例句/译文/常见搭配（词卡背面展示，不作选择题干扰项）
const enrichFields = ['ex2', 'ex2c', 'col']
let enrichEmpty = 0
EN_WORDS.forEach(w => { enrichFields.forEach(f => { if (!w[f] || !String(w[f]).trim() || String(w[f]).trim().toLowerCase() === 'none') enrichEmpty++ }) })
eq(enrichEmpty, 0, 'every english word has ex2/ex2c/col non-empty')
ok(EN_WORDS.every(w => w.ex2 !== w.example), '第二例句与第一例句不同')
// 越南语音标用近似 IPA（方括号内），必须从方括号开头，否则说明是随手填的
ok(VI_WORDS.every(function (w) { return w.phonetic.indexOf('[') === 0 }), '越南语音标统一用 [IPA] 写法')
const viCats = words.getExamCategories('vi').map(c => c.name)
;['问候', '日常', '食物', '数字', '时间', '动词', '旅行', '饮食', '健康', '工作'].forEach(c => {
  ok(viCats.indexOf(c) >= 0, `vietnamese category "${c}" is selectable`)
})
// 新增分类必须能在筛选里选到，否则只能藏在「全部」里
const enCats = words.getExamCategories('en').map(c => c.name)
;['四级', '六级', '考研', '雅思托福', '日常', '情绪', '工作', '科技', '旅行', '健康', '饮食', '社交'].forEach(c => {
  ok(enCats.indexOf(c) >= 0, `category "${c}" is selectable`)
})
const jaCats = words.getExamCategories('ja').map(c => c.name)
;['问候', '日常', '食物', '数字', '时间', '动词'].forEach(c => {
  ok(jaCats.indexOf(c) >= 0, `japanese category "${c}" is selectable`)
})
eq(words.getWordsByCategory('en', '日常').length, 134, 'filter by 日常 returns 134')
eq(words.getWords('en').length, 800, 'getWords ignores unknown lang fallback')

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

// mp3 不再随代码包发布：真机上 FileSystemManager 读不到包内文件、InnerAudioContext
// 也不允许直接播包内 mp3，所以音频只放仓库 audio-src/ 下，由 CI 铺到 Cloudflare Pages。
// 这里钉死两件事：① 每个 id 都能算出 CDN 地址 ② 地址对应的 mp3 真在磁盘上（否则 CI 传不上去）
eq(localAudio.remoteFor('js015'), 'https://yb.qy663.de5.net/audio/js015.mp3', '日语素材指向 CDN')
eq(localAudio.remoteFor('s001'), 'https://yb.qy663.de5.net/audio-en/s001.mp3', '英语素材指向 CDN 的另一个目录')
eq(localAudio.remoteFor('nope'), '', 'unknown id has no audio')
eq(localAudio.has('js015'), true, 'has() 认得日语素材')
eq(localAudio.langOf('js015'), 'ja', 'langOf maps a Japanese id to its region')
eq(localAudio.langOf('s001'), 'en', 'langOf maps an English id to its region')
eq(localAudio.langOf('nope'), '', 'langOf returns empty for unknown ids')
eq(typeof localAudio.pathFor, 'undefined', 'pathFor 已移除（代码包里没有 mp3 了）')

// 跟读队列里的 id 带前缀（句子 st_ / 对话台词 dl_），而 mp3 文件名用原始 id。
// 两种都得认，否则对话台词永远命中不了音频、只能走在线链。
eq(localAudio.idCandidates('dl_d003_1').join(','), 'dl_d003_1,d003_1', 'id candidates strip the queue prefix')
eq(localAudio.remoteFor('st_s001'), 'https://yb.qy663.de5.net/audio-en/s001.mp3', 'prefixed sentence id finds the same mp3')
eq(localAudio.remoteFor('dl_d003_1'), 'https://yb.qy663.de5.net/audio-en/d003_1.mp3', 'prefixed dialogue line id finds the same mp3')

// 对话听写（pages/dictation 的 dlg 模式）按「dl_ + 台词 id」取音频，
// 每条台词都必须能找到音频，否则真机上那一句必然读不出来。
;['en', 'ja', 'vi'].forEach(function (lg) {
  let lines = 0
  let missing = []
  sentences.getDialogues(lg).forEach(function (d) {
    d.lines.forEach(function (l) {
      lines++
      if (!localAudio.remoteFor('dl_' + l.id)) missing.push(lg + '/' + l.id)
    })
  })
  ok(lines >= 20, '对话台词条数合理（' + lg + ': ' + lines + '）')
  eq(missing.join(','), '', '每条台词都有离线音频（' + lg + '）')
})
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

// 素材 id → 仓库里的音频文件（audio-src/<语种>/<原始id>.mp3）
const AUDIO_DIR = { ja: 'audio-src/ja', en: 'audio-src/en', vi: 'audio-src/vi' }
function audioFile(id) {
  const lang = localAudio.langOf(id)
  if (!lang) return ''
  const cands = localAudio.idCandidates(id)
  for (let i = 0; i < cands.length; i++) {
    if (localAudio.has(cands[i])) return pathMod.join(__dirname, '..', AUDIO_DIR[lang], cands[i] + '.mp3')
  }
  return ''
}

// mp3 特征：ID3 标签或帧同步 0xFFE
function badMp3(ids) {
  return ids.filter(function (id) {
    const f = audioFile(id)
    if (!f || !fs.existsSync(f)) return true
    const head = fs.readFileSync(f).slice(0, 3)
    return !(head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0))
  })
}
function kbOf(ids) {
  return ids.reduce(function (sum, id) {
    return sum + fs.statSync(audioFile(id)).size
  }, 0) / 1024
}
const badAudio = badMp3(audioIds)
eq(badAudio.length, 0, 'bundled audio files are real mp3 (bad: ' + badAudio.slice(0, 5).join(',') + ')')
const audioKb = kbOf(audioIds)
ok(audioKb < 1900, 'Japanese audio stays under 1.9MB (actual ' + audioKb.toFixed(0) + 'KB, 用户下载流量要克制)')
ok(localAudio.countOf('ja') === audioIds.length,
  'local-audio index covers exactly the current Japanese items (' + localAudio.countOf('ja') + ' vs ' + audioIds.length + ')')

// 越南语没有任何在线合成源：句子、台词、单词、例句**每一条**都必须有 mp3，
// 少一条就意味着那个条目在真机上彻底没声音（连兜底都没有）。
eq(localAudio.remoteFor('vs001'), 'https://yb.qy663.de5.net/audio-vi/vs001.mp3', '越南语素材指向 CDN 的 audio-vi 目录')
eq(localAudio.langOf('vd001_1'), 'vi', 'langOf maps a Vietnamese dialogue line to its region')
const viAudioIds = []
viSent.forEach(function (x) { viAudioIds.push(x.id) })
viDlg.forEach(function (d) { d.lines.forEach(function (l) { viAudioIds.push(l.id) }) })
VI_WORDS.forEach(function (w) {
  viAudioIds.push(w.id)
  if (w.example) viAudioIds.push(w.id + '_ex')
})
eq(viAudioIds.length, 304, '越南语音频应有 304 条（100 句 + 44 台词 + 80 词 + 80 例句）')
const viMissing = viAudioIds.filter(function (id) { return !localAudio.has(id) })
eq(viMissing.length, 0, '每个越南语条目都有离线音频（缺: ' + viMissing.slice(0, 5).join(',') + '）')
eq(badMp3(viAudioIds).length, 0, '越南语音频都是真 mp3')
ok(localAudio.countOf('vi') === viAudioIds.length, 'vietnamese audio index count matches (' + localAudio.countOf('vi') + ')')

// 英语：800 词 + 800 例句 + 120 句 + 28 台词全部预生成（单词发音不再依赖有道/百度在线源）
const enAudioIds = []
sentences.getSentences('en').forEach(function (x) { enAudioIds.push(x.id) })
sentences.getDialogues('en').forEach(function (d) { d.lines.forEach(function (l) { enAudioIds.push(l.id) }) })
EN_WORDS.forEach(function (w) {
  enAudioIds.push(w.id)
  if (w.example) enAudioIds.push(w.id + '_ex')
})
eq(enAudioIds.length, 1748, '英语音频应有 1748 条（120 句 + 28 台词 + 800 词 + 800 例句）')
const enMissing = enAudioIds.filter(function (id) { return !localAudio.has(id) })
eq(enMissing.length, 0, 'every English item has bundled audio (missing: ' + enMissing.slice(0, 5).join(',') + ')')
eq(badMp3(enAudioIds).length, 0, 'English audio files are real mp3')
const enKb = kbOf(enAudioIds)
ok(enKb < 14000, 'English audio stays under 14MB (actual ' + enKb.toFixed(0) + 'KB)')
ok(localAudio.countOf('en') === enAudioIds.length,
  'English audio index count matches (' + localAudio.countOf('en') + ' vs ' + enAudioIds.length + ')')

// 代码包内的 mp3 真机播不了 —— 实录报错：
//   [InnerAudio] operateAudio fail: errMsg="operateAudio:fail:access denied, appId=wx..."
// 所以代码包里不放 mp3，预生成音频一律流播 CDN。这里的桩只负责「记录这次播的是哪个地址」。
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

// 代码包里不再留 mp3：这些目录已经不存在，防止有人又把 3.8MB 塞回包里
ok(!fs.existsSync(pathMod.join(__dirname, '..', 'packageJa')), 'packageJa 分包已删除（音频改走 CDN）')
ok(!fs.existsSync(pathMod.join(__dirname, '..', 'packageEn')), 'packageEn 分包已删除（音频改走 CDN）')
ok(!fs.existsSync(pathMod.join(__dirname, '..', 'utils', 'pkg-audio.js')), 'pkg-audio.js 已删除（不再复制包内文件）')

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
ok(wordRank.size >= 700, 'word rank table covers most english words')
eq(wordRank.rankOf('en_211'), 156, 'rank of "keep" comes from ECDICT frq')
eq(wordRank.rankOf('ja_001'), Infinity, 'japanese words have no rank (sort last)')
const sortedFresh = storageMod.getNewWords('en', 8)
// 扩到 800 词后，新加入的高频词 even(COCA 107) 比 keep(156) 更常用，排到了第一位
eq(sortedFresh[0].word, 'even', 'first new word is the most frequent one')
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
}).then(() => runTailTests()).then(() => {
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
  ok(pages.length >= 15, '扫到了全部页面（共 ' + pages.length + ' 个；音频改走 CDN 后已无分包页）')

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
  eq(words.getWords('en').length, 1, '内置 800 词被在线词库覆盖')
  eq(words.getWords('en')[0].word, 'zebra-online', '取到的就是在线的词')
  eq(words.getWords('ja').length, 110, '没覆盖的语种仍用内置词库')
  ok(words.getExamCategories('en').some(function (c) { return c.name === '日常' }), '在线词的分类也能被分类列表看到')

  // 还原：空数组不构成覆盖（getWords 只在非空时才用覆盖层）
  replies = [{ kind: 'ok', data: { version: 'v10', words: { en: [], ja: [] } } }]
  let o8 = null
  od.checkUpdate(function (r) { o8 = r }, { force: true })
  eq(o8 && o8.updated, true, '空覆盖层版本也能更新')
  eq(words.getWords('en').length, 800, '空覆盖层回落到内置词库')

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
  eq(shipped.words.en.length, 800, '发布包英语 800 词')
  eq(shipped.words.ja.length, 110, '发布包日语 110 词')
  eq(shipped.sentences.en.length, 120, '发布包英语 120 句')
  eq(shipped.sentences.ja.length, 100, '发布包日语 100 句')
  // 发布目录不再留一份副本（两份 181KB 各自进 git 迟早不一致）：
  // deploy/data.json 是唯一来源，发布时由 deploy.sh / CI 复制过去
  const fsHere = require('fs')
  ok(!fsHere.existsSync(pathMod.join(__dirname, '..', 'deploy/cf/data.json')) ||
    /deploy\/cf\/data\.json/.test(fsHere.readFileSync(pathMod.join(__dirname, '..', '.gitignore'), 'utf8')),
    'deploy/cf/data.json 不进仓库（发布时才复制）')

  od.DATA_URLS.splice(0, od.DATA_URLS.length)
  Array.prototype.push.apply(od.DATA_URLS, shippedSources)
  global.wx.request = origReq
  eq(od.DATA_URLS.length, shippedSources.length, '测试后还原仓库里的配置')

  // 预生成音频只有一条可用路径：流播 CDN 上的 mp3（真机读不到包内文件，也不允许直接播）。
  delete require.cache[require.resolve('../utils/audio')]
  delete require.cache[require.resolve('../utils/local-audio')]
  const auJa = require('../utils/audio')
  const laJa = require('../utils/local-audio')
  playedSrc = null
  const ctl = auJa.speak('すみません、駅はどこですか。', false, { id: 'st_js015' })
  eq(playedSrc, 'https://yb.qy663.de5.net/audio/js015.mp3', '第一级：流播 CDN（队列 st_ 前缀也认）')
  eq(ctl.bundled, true, '有预生成音频时返回 bundled 控制器')
  global.__lastCtx._onErr({ errMsg: 'operateAudio:fail' })
  await new Promise(function (r) { setTimeout(r, 30) })
  ok(!/pkg-audio|packageJa|packageEn/.test(playedSrc || ''), 'CDN 失败后不再去找包内文件（真机读不到，白等一次）')
  ok(playedSrc === null || /^https:\/\//.test(playedSrc), '日语整句没有在线源时不乱撞请求')
  ctl.stop()

  // 英语有在线源：CDN 播不出来还能退到在线 TTS，不会彻底没声音
  playedSrc = null
  const ctlEn = auJa.speak('Nice to meet you.', false, { id: 'st_s001' })
  eq(playedSrc, 'https://yb.qy663.de5.net/audio-en/s001.mp3', '英语句子同样先走 CDN')
  ctlEn.stop()

  eq(typeof laJa.ensureLoaded, 'undefined', 'ensureLoaded 已移除（不再加载分包）')
  eq(laJa.remoteFor('st_js015'), 'https://yb.qy663.de5.net/audio/js015.mp3', '日语素材有 CDN 地址（前缀 id 也认）')
  eq(laJa.remoteFor('s001'), 'https://yb.qy663.de5.net/audio-en/s001.mp3', '英语素材有 CDN 地址')

  // ---- 冷启动两笔省：一次 getStorageInfoSync 顶 5 次读 + 词频排序结果缓存 ----
  {
    const od = require('../utils/online-data')
    const origGetOverride = od.getOverride
    const origInfo = global.wx.getStorageInfoSync

    // 前面的在线词库用例会给 getWords 留一个覆盖层，这里先摘掉，测内置词库本身
    od.getOverride = function () { return null }
    try {
      let infoCalls = 0
      global.wx.getStorageInfoSync = function () { infoCalls++; return origInfo() }
      storage.invalidate()
      storage.init()
      eq(infoCalls, 1, 'init 只调一次 getStorageInfoSync（顶掉 5 次逐条读）')

      const a1 = storage.getNewWords('en', 5)
      const a2 = storage.getNewWords('en', 5)
      eq(a1.length, 5, 'getNewWords 返回 limit 条')
      eq(a1.map(w => w.id).join(','), a2.map(w => w.id).join(','), '排序结果被复用，两次完全一致')
      ok(a1.every(w => w.id !== 'en_001'), '不再是字母序第一条（高频优先，en_001 是 abandoned 类低频词）')

      // 分类过滤在 O(n) 过滤版里不能丢
      const fin = storage.getNewWords('en', 100, '财务')
      ok(fin.length === 42, '按分类取新词仍能取满 42 条财务词（实际 ' + fin.length + '）')
      ok(fin.every(w => w.category === '财务'), '分类过滤只出该类词')

      // 在线词库换掉整个数组后，排序缓存必须失效（否则按旧顺序出行）
      od.getOverride = function () {
        return { words: { en: [{ id: 'x1', word: 'zzz', phonetic: '', meaning: '测试', example: '', exampleCn: '', category: '日常' }] } }
      }
      const after = storage.getNewWords('en', 5)
      eq(after.length, 1, '词库换成新数组后按新数组出词')
      eq(after[0].id, 'x1', '拿到的是新数组里的词')
    } finally {
      od.getOverride = origGetOverride
      global.wx.getStorageInfoSync = origInfo
    }
  }

  // ---- 句子进 FSRS：句子/台词有自己的调度表，不再混进单词进度 ----
  {
    const sp = require('../utils/sentence-progress')
    sp.invalidate()
    storage.invalidate()

    // 没练过 → 查不到记录
    eq(sp.get('st_s001'), null, '没练过的句子没有调度记录')

    const p1 = sp.review('st_s001', 5, 'speak')
    ok(p1 && p1.level === 1, '第一次顺利 → level 1')
    ok(p1.dueAt > Date.now(), '答对后到期时间在未来')
    eq(p1.lastFrom, 'speak', '记下了来源（口语/测验）')

    // 读出来的是副本：调用方改它不该污染缓存
    const got = sp.get('st_s001')
    got.level = 99
    eq(sp.get('st_s001').level, 1, 'get 返回副本，改它不影响内部记录')

    // 句子记录不能污染单词进度表（原来 rate() 会把 st_ 前缀的 id 写进 progress）
    eq(storage.getProgress()['st_s001'], undefined, '句子 id 不进单词进度表')

    // 答错 → lapses 增加、间隔回退
    // 来源权重：自评比测验低；同一天再练一次不晋级
    eq(sp.SOURCE_WEIGHT.quiz, 1, '测验是满权重')
    eq(sp.SOURCE_WEIGHT.dictation, 1, '听写是满权重')
    ok(sp.SOURCE_WEIGHT['speak-score'] < 1, '机评权重 < 1')
    ok(sp.SOURCE_WEIGHT.speak < sp.SOURCE_WEIGHT['speak-score'], '自评比机评更低')
    const again = sp.review('st_s900', 5, 'speak')
    const again2 = sp.review('st_s900', 5, 'speak')
    eq(again.level, 1, '第一次顺利晋级')
    eq(again2.level, 1, '同一天再评一次不晋级')
    ok(again2.intervalDays >= 1, '同一天再评也有间隔（至少 1 天）')

    const p2 = sp.review('st_s001', 0, 'quiz')
    eq(p2.lapses, 1, '答错累计 lapses')
    eq(p2.lastFrom, 'quiz', '来源跟着更新')

    // 到期判断
    const items = [{ id: 'st_s001' }, { id: 'st_s002' }]
    const dueNow = sp.dueIds(items, Date.now())
    ok(dueNow.indexOf('st_s002') >= 0, '到期判断：没练过的算到期（进今日待练）')
    ok(dueNow.indexOf('st_s001') < 0, '到期判断：刚答过的不到期')
    ok(sp.dueIds(items, p2.dueAt + 1).indexOf('st_s001') >= 0, '到期判断：时间一到就到期')
    const sum = sp.summary(items)
    ok(sum.learned === 1 && sum.total === 2, 'summary 统计学过条数与总数')

    // 落盘：flush 后 Storage 里真的有这一条
    const saved = sp.flush()
    ok(saved === 1, 'flush 写了一次')
    const raw = JSON.parse(global.wx.getStorageSync(profile.nsKey(sp.KEY)))
    ok(raw && raw.st_s001 && raw.st_s001.level >= 0, '句子进度落到自己的 key 里')
    eq(sp.flush(), 0, '没有脏数据时 flush 不写')

    // 换档案/导入前 invalidate 要把缓存清掉，下次读从磁盘重建
    sp.invalidate()
    const reloaded = sp.get('st_s001')
    ok(reloaded && reloaded.lapses === 1, 'invalidate 后从磁盘重新读回记录（不丢数据）')

    // ---- 句子题 ----
    const quizMod = require('../utils/quiz')
    const sentItems = sentences.getAllItems('en')
    ok(sentItems.length > 10, '英语句子素材可用作题目池')

    // 抽题顺序：到期的排最前
    const progStub = {}
    progStub[sentItems[3].id] = { dueAt: Date.now() - 1000 }
    progStub[sentItems[5].id] = { dueAt: Date.now() + 86400000 }
    const picked = quizMod.pickSentences(sentItems, progStub, Date.now(), 3, function () { return 0.5 })
    eq(picked[0].id, sentItems[3].id, '到期句子排在最前')

    const q1 = quizMod.buildSentenceItems([sentItems[0]], sentItems, progStub, function () { return 0.5 })[0]
    eq(q1.type, 'sent', '句子题类型是 sent')
    eq(q1.kind, 'sentence', '句子题带 kind（页面据此写句子调度表）')
    eq(q1.options.length, 4, '句子题 4 个选项')
    ok(q1.options.indexOf(q1.answer) >= 0, '选项里必有正确答案')
    eq(new Set(q1.options).size, 4, '4 个选项文本互不相同')
    eq(q1.learned, false, '没练过的句子标 learned=false（答了不写调度）')
    const q2 = quizMod.buildSentenceItems([sentItems[0]], sentItems, (function () { const o = {}; o[sentItems[0].id] = { dueAt: 1 }; return o })(), function () { return 0.5 })[0]
    eq(q2.learned, true, '练过的句子标 learned=true（答完写回调度表）')
  }

  // ---- 听写：文本归一化与判定 ----
  {
    const d = require('../utils/dictation')
    eq(d.normalizeAnswer('Could you help me, please?'), 'could you help me please', '归一化：小写 + 去标点 + 收空格')
    eq(d.normalizeAnswer('  Hello   World  '), 'hello world', '归一化：首尾与多空格')
    eq(d.normalizeAnswer("Don't worry."), "don't worry", '归一化：保留撇号')
    eq(d.normalizeAnswer(null), '', '归一化：null 当空串')

    ok(d.isAnswerRight('hello world', 'Hello, World!'), '标点大小写不计较')
    ok(d.isAnswerRight('dont worry', "Don't worry"), '漏撇号也算对')
    ok(d.isAnswerRight('Could you help me please', 'Could you help me, please?'), '整句漏逗号算对')
    ok(!d.isAnswerRight('hello', 'hello world'), '少词算错')
    ok(!d.isAnswerRight('', 'hello'), '空输入算错')
    ok(!d.isAnswerRight('hellp', 'hello'), '拼错算错')
  }

  // ---- AI 补查：词库没有的词问 Worker（Key 在 Worker 里，客户端只认识域名）----
  const ai = require('../utils/ai-lookup')
  eq(ai.configured(), true, 'AI 查词已配置（客户端认识 https 地址）')
  ok(/^https:\/\//.test(ai.AI_URLS[0] || ''), 'AI 地址必须走 https（小程序只允许 https 请求）')
  ok(ai.AI_URLS[0].indexOf('gemini') < 0 && ai.AI_URLS[0].indexOf('google') < 0, '客户端不直连 Google（Key 不能进前端）')

  const origAiReq = global.wx.request
  const aiReqs = []
  ai.clearCache()
  global.wx.request = function (o) {
    aiReqs.push(o.url)
    const q = decodeURIComponent((o.url.match(/q=([^&]*)/) || [])[1] || '')
    setTimeout(function () {
      o.success({
        statusCode: 200,
        data: { ok: true, found: true, q: q, lang: 'en', word: q,
          phonetic: '/test/', meaning: 'n. 测试释义', examples: [{ text: 'Test it.', cn: '测一下。' }], tip: '别硬译' }
      })
    }, 0)
  }
  let aiRes = null
  ai.lookup('invoice', 'en', function (r) { aiRes = r })
  await new Promise(function (r) { setTimeout(r, 10) })
  eq(aiRes && aiRes.found, true, 'AI 查到词就返回 found')
  eq(aiRes && aiRes.meaning, 'n. 测试释义', 'AI 释义原样透出给页面')
  eq(aiReqs.length, 1, '第一次查要发请求')
  aiRes = null
  ai.lookup('invoice', 'en', function (r) { aiRes = r })
  await new Promise(function (r) { setTimeout(r, 10) })
  eq(aiRes && aiRes.cached, true, '同一个词第二次走本地缓存')
  eq(aiReqs.length, 1, '缓存命中时一个请求都不发')

  // 网络挂了：给页面一个能说人话的原因，而不是静默
  global.wx.request = function (o) { setTimeout(function () { o.fail({ errMsg: 'request:fail timeout' }) }, 0) }
  let aiFail = null
  ai.lookup('refundable', 'en', function (r) { aiFail = r })
  await new Promise(function (r) { setTimeout(r, 10) })
  eq(aiFail && aiFail.ok, false, '网络失败时 ok=false')
  eq(aiFail && aiFail.reason, 'network', '网络失败有明确 reason')

  // AI 说没这个词：不写缓存（否则拼错的词永远查不到）
  global.wx.request = function (o) {
    setTimeout(function () { o.success({ statusCode: 200, data: { ok: true, found: false, q: 'zzzz' } }) }, 0)
  }
  let aiNo = null
  ai.lookup('zzzz', 'en', function (r) { aiNo = r })
  await new Promise(function (r) { setTimeout(r, 10) })
  eq(aiNo && aiNo.found, false, '查不到就如实返回 found=false')
  ai.clearCache()
  let aiAgain = null
  global.wx.request = function (o) {
    aiReqs.push(o.url)
    setTimeout(function () { o.success({ statusCode: 200, data: { ok: true, found: false, q: 'zzzz' } }) }, 0)
  }
  ai.lookup('zzzz', 'en', function (r) { aiAgain = r })
  await new Promise(function (r) { setTimeout(r, 10) })
  eq(aiAgain && aiAgain.found, false, '否定结果不缓存（会重新问一次）')

  // 缓存上限：只留最近 40 条，别让 AI 缓存吃掉 Storage 的 10MB
  eq(ai.MAX_CACHE, 40, '本地 AI 缓存上限 40 条')
  ai.clearCache()
  global.wx.request = origAiReq

  // ---- AI 听音反馈（utils/ai-eval.js）：日语/越南语没有客观评分时的兜底 ----
  const aiEval = require('../utils/ai-eval')
  eq(aiEval.mimeOf('wxfile://tmp_a.mp3'), 'audio/mpeg', 'mp3 录音按 audio/mpeg 上传')
  eq(aiEval.mimeOf('a.m4a'), 'audio/mp4', 'm4a 录音按 audio/mp4 上传')
  eq(aiEval.mimeOf('a.bin'), 'audio/mpeg', '未知扩展名退回 audio/mpeg')

  // 没录音就别发请求（点了按钮但还没录）
  const noRec = await aiEval.evaluate({ text: 'xin chào', lang: 'vi' })
  eq(noRec.ok, false, '没有录音文件时直接失败')
  eq(noRec.error, 'no-recording', '失败原因说清楚是没录音')

  // 上传成功：把 Worker 的 verdict/issues/tip 原样透出
  const origReq2 = global.wx.request
  const origFs2 = global.wx.getFileSystemManager
  let evalReq = null
  global.wx.getFileSystemManager = function () {
    return { readFile(o) { o.success({ data: 'QUJD' }) } }   // 假装读到 3 字节 base64
  }
  global.wx.request = function (o) {
    evalReq = o
    o.success({ statusCode: 200, data: { ok: true, verdict: '声调有点平', issues: ['phở 读成了平调'], tip: '把问号音往上带' } })
  }
  const good = await aiEval.evaluate({ filePath: 'wxfile://tmp_a.mp3', text: 'phở', lang: 'vi' })
  eq(good.ok, true, 'AI 有反馈时 ok=true')
  eq(good.verdict, '声调有点平', 'verdict 原样给页面')
  eq(good.issues.length, 1, 'issues 原样给页面')
  eq(good.tip, '把问号音往上带', 'tip 原样给页面')
  eq(evalReq && evalReq.method, 'POST', '评测走 POST')
  ok(evalReq && /\/eval$/.test(evalReq.url), '评测打到 Worker 的 /eval')
  eq(evalReq && evalReq.data && evalReq.data.lang, 'vi', '带上语种，prompt 才对')
  eq(evalReq && evalReq.data && evalReq.data.mime, 'audio/mpeg', '带上真实 mime')

  // 限额用完：把 Worker 的文案带给用户，不要吞成「网络错误」
  global.wx.request = function (o) {
    o.success({ statusCode: 429, data: { ok: false, error: 'rate-limited', message: '今天的 AI 评测次数用完了' } })
  }
  const limited = await aiEval.evaluate({ filePath: 'wxfile://tmp_a.mp3', text: 'phở', lang: 'vi' })
  eq(limited.ok, false, '限额用完 ok=false')
  eq(limited.error, 'rate-limited', '限额用完有明确 error')
  eq(limited.message, '今天的 AI 评测次数用完了', 'Worker 的文案原样透出')

  // 网络挂：给一句人话
  global.wx.request = function (o) { o.fail({ errMsg: 'request:fail' }) }
  const netFail = await aiEval.evaluate({ filePath: 'wxfile://tmp_a.mp3', text: 'phở', lang: 'vi' })
  eq(netFail.ok, false, '网络失败 ok=false')
  eq(netFail.error, 'network', '网络失败 error=network')

  // 读不到文件（录音被系统清理）：当作没录音，别发出空 body
  global.wx.getFileSystemManager = function () {
    return { readFile(o) { o.fail({ errMsg: 'readFile:fail' }) } }
  }
  const noFile = await aiEval.evaluate({ filePath: 'wxfile://gone.mp3', text: 'phở', lang: 'vi' })
  eq(noFile.ok, false, '文件读不出来时失败')
  eq(noFile.error, 'no-recording', '读不出来按「重录一次」处理')

  global.wx.request = origReq2
  global.wx.getFileSystemManager = origFs2

  // 上传过录音这件事必须用户点过一次才记下来（默认 false）
  const settings = storage.getSettings()
  eq(settings.aiEvalAgreed === undefined || settings.aiEvalAgreed === false, true, 'AI 评测默认没同意过上传')
  storage.setAiEvalAgreed(true)
  eq(storage.getSettings().aiEvalAgreed, true, '同意过一次就记住，不再反复弹窗')
  storage.setAiEvalAgreed(false)

  // ---- 影子跟读 / AI 听音的页面接线（静态守门，防止哪天被删掉）----
  const fsMod = require('fs')
  const speakJs = fsMod.readFileSync(require('path').join(__dirname, '..', 'pages/speak/speak.js'), 'utf8')
  const speakXml = fsMod.readFileSync(require('path').join(__dirname, '..', 'pages/speak/speak.wxml'), 'utf8')
  ok(/comparePlay\(\)/.test(speakJs), '口语页有 comparePlay（标准音 ←→ 我的录音）')
  ok(/_shadowTip\(\)/.test(speakJs), '口语页有 shadowTip（时长对比结论）')
  ok(/bindtap="comparePlay"/.test(speakXml), 'wxml 上挂了 comparePlay')
  ok(/bindtap="aiListen"/.test(speakXml), 'wxml 上挂了 aiListen')
  ok(/aiLoading/.test(speakXml), 'AI 听音有 loading 态（模型要想一两秒）')
}

// ---- 追加用例：本轮新增的纯逻辑模块（日志 / 影子跟读 / 队列 / 设备号 / 预取 / 录音对比）----
async function runTailTests() {
  const fsMod = require('fs')
  const pathMod = require('path')
  const read = (p) => fsMod.readFileSync(pathMod.join(__dirname, '..', p), 'utf8')

  // A. 线上日志：拿到实时日志就双写，拿不到也只 console，不许抛
  const logger = require('../utils/logger')
  let logged = []
  const origLM = global.wx.getRealtimeLogManager
  global.wx.getRealtimeLogManager = function () {
    return {
      info: (...a) => logged.push(['info', a.join(' ')]),
      warn: (...a) => logged.push(['warn', a.join(' ')]),
      error: (...a) => logged.push(['error', a.join(' ')])
    }
  }
  ok(typeof logger.info === 'function', 'logger 有 info')
  const origConsoleLog = console.log
  console.log = () => {}
  logger.info('hello', 1)
  console.log = origConsoleLog
  eq(logged.length, 1, 'logger.info 写进实时日志')
  eq(logged[0][0], 'info', '级别正确')
  const origConsoleError = console.error
  console.error = () => {}
  logger.error(new Error('boom'))
  console.error = origConsoleError
  eq(logged.length, 2, 'logger.error 写进实时日志')
  ok(/boom/.test(logged[1][1]), 'Error 的 message 被带进日志')
  ok(logged[1][1].length <= 400, '单条日志有长度上限（后台单条有上限，超了会被截断）')
  global.wx.getRealtimeLogManager = function () { return null }
  let threw = false
  const origConsoleWarn = console.warn
  console.warn = () => {}
  try { logger.warn('no manager') } catch (e) { threw = true }
  console.warn = origConsoleWarn
  ok(!threw, '拿不到实时日志管理器时不抛异常（老基础库）')
  global.wx.getRealtimeLogManager = origLM

  // B. 影子跟读：只比时长，比值不对时给方向性提示
  const st = require('../utils/shadow-tip')
  eq(st.tip(0, 1000), '先跟住节奏，再抠发音。', '没有标准音时长时给通用建议')
  eq(st.tip(2000, 0), '先跟住节奏，再抠发音。', '没有录音时长时给通用建议')
  eq(st.tip(300, 300), '先跟住节奏，再抠发音。', '标准音太短（单词）时比值无意义')
  ok(/节奏对得上/.test(st.tip(2000, 2050)), '差 2.5% 算节奏对得上')
  ok(/慢了/.test(st.tip(2000, 3000)), '明显慢时提示卡顿')
  ok(/快了/.test(st.tip(2000, 1200)), '明显快时提示吞音')
  ok(st.tip(2000, 2050).indexOf('2.0s') > 0, '提示里带标准音秒数')
  ok(st.tip(2000, 3000).indexOf('1.0s') > 0, '提示里带慢了多久')

  // C. 队列与进度：纯逻辑，可脱离页面渲染验证
  const session = require('../utils/speak-session')
  const pg0 = session.progress(0, 0)
  eq(pg0.progressText, '0 / 0', '空队列进度文案')
  eq(pg0.showDots, false, '空队列不画圆点')
  const pg3 = session.progress(1, 3)
  eq(pg3.progressText, '2 / 3', '进度文案是「当前 / 总数」')
  eq(pg3.dots.length, 3, '20 条以内画圆点')
  eq(pg3.progressPercent, 67, '百分比四舍五入')
  const pg50 = session.progress(49, 50)
  eq(pg50.showDots, false, '条目多的时候不画圆点（省节点）')
  eq(pg50.dots.length, 0, '不画圆点时不生成数组')
  eq(pg50.progressPercent, 100, '最后一条是 100%')
  eq(session.progress(5, 3).progressText, '3 / 3', '下标越界时按总数封顶')

  // 前面的用例可能留下过「在线词库覆盖层」（只有 1 个词），先清掉再断言内置词库
  const od = require('../utils/online-data')
  const odBackup = od.getOverride
  od.getOverride = () => null
  const qWords = session.buildQueue({ lang: 'en', track: 'word', levelName: '全部', sceneIndex: 0 })
  ok(qWords.length >= 400, '英语单词队列包含整个词库')
  ok(qWords.every(w => w && w.word), '队列里没有空词（练不了的不进队列）')
  ok(qWords.every(w => w.kind === 'word'), '单词队列条目标了 kind=word')
  const qSent = session.buildQueue({ lang: 'en', track: 'sentence', levelName: '全部', sceneIndex: 0 })
  ok(qSent.length >= 100, '英语句子队列取到句库')
  ok(qSent.every(w => String(w.id).indexOf('st_') === 0), '句子 id 带 st_ 前缀（评分据此分流）')
  const qDlg = session.buildQueue({ lang: 'vi', track: 'dialogue', levelName: '全部', sceneIndex: 0 })
  ok(qDlg.length > 0, '越南语对话队列非空')
  ok(qDlg.every(w => String(w.id).indexOf('dl_') === 0), '台词 id 带 dl_ 前缀')
  const qBad = session.buildQueue({ lang: 'vi', track: 'dialogue', levelName: '全部', sceneIndex: 99 })
  eq(qBad.length, 0, '场景下标越界时返回空队列而不是崩')
  ok(Array.isArray(session.allItems('ja')) && session.allItems('ja').length >= 200, 'allItems 汇总词+句')
  od.getOverride = odBackup

  const sig1 = session.signature({ track: 'word', levelIndex: 0, sceneIndex: 0, mode: 'train' })
  const sig2 = session.signature({ track: 'word', levelIndex: 0, sceneIndex: 0, mode: 'train' })
  const sig3 = session.signature({ track: 'word', levelIndex: 1, sceneIndex: 0, mode: 'train' })
  eq(sig1, sig2, '同样状态签名一致（能沿用上次位置）')
  ok(sig1 !== sig3, '换了分类签名就变（重建队列）')

  // D. 设备标识：本机随机、可持久化、格式能过服务端校验
  delete require.cache[require.resolve('../utils/device')]
  const device = require('../utils/device')
  const id1 = device.id()
  const id2 = device.id()
  eq(id1, id2, '同一台设备两次取到的是同一个号')
  ok(/^[a-z0-9]{6,40}$/i.test(id1), '设备号能通过服务端正则（否则额度按 IP 算）')
  ok(id1.indexOf('dev') === 0, '设备号有 dev 前缀，便于日志里认出来')
  ok(id1 !== 'devundefined' && id1.length > 10, '设备号有随机部分')

  // E. 播放链路：CDN 音频先落盘缓存，下载失败才退回流播
  const audioSrc = read('utils/audio.js')
  ok(/function prefetch\(/.test(audioSrc), 'audio 有 prefetch（预取下一条）')
  ok(/ttsCache\.fileOf\(url\)/.test(audioSrc), 'CDN 音频先试缓存文件')
  ok(/wx\.downloadFile/.test(audioSrc), '缓存未命中时下载落盘')
  ok(/stream\(\)/.test(audioSrc), '下载失败退回流播（不比以前差）')
  ok(/ttsCache\.forget\(url\)/.test(audioSrc), '缓存文件坏了要丢掉，否则这句永远播不出来')
  ok(/prefetch/.test(audioSrc.split('module.exports')[1] || ''), 'prefetch 已导出')
  // 开发者工具里 operateAudio:fail:access denied 很常见：本地文件（缓存/临时）播不了。
  // 一条坏缓存不该让这个词永远读不出来 —— 丢掉缓存 + 自动流播一次。
  ok(/let triedStream = false/.test(audioSrc), '本地播放失败可以流播兜一次')
  ok(/if \(!triedStream && !destroyed\) \{[\s\S]{0,120}start\(url, 'url'\)/.test(audioSrc), '本地文件播不了就改成直接流播（工具里也能出声）')
  ok(/ttsCache\.fileOf\(url\) === src/.test(audioSrc), '只丢真正坏掉的那条缓存')
  const speakSrc = read('pages/speak/speak.js')
  ok(/audio\.prefetch\(next\.id\)/.test(speakSrc), '口语页切词后预取下一条')
  ok(/audio\.prefetch\(list\[1\]\.id\)/.test(read('pages/learn/learn.js')), '学习页开局预取第二张')
  ok(/audio\.prefetch\(nxt\.id\)/.test(read('pages/dictation/dictation.js')), '听写页切题后预取下一题')

  // F. 录音进步对比：同一句录多次要能看出「从多少分到多少分」
  const recSrc = read('pages/recordings/recordings.js')
  ok(/buildGroups\(/.test(recSrc), '录音页按素材归组')
  ok(/bothScored/.test(recSrc), '两次都有分才显示分差')
  ok(/compareGroup\(/.test(recSrc), '有「前后对比」播放')
  const recXml = read('pages/recordings/recordings.wxml')
  ok(/bindtap="compareGroup"/.test(recXml), 'wxml 上挂了前后对比')
  ok(/groups/.test(recXml), 'wxml 渲染进步卡片')

  // G. 搜索：句子 / 对话台词 / 自建素材都要能搜到
  const searchSrc = read('pages/search/search.js')
  ok(/_searchExtras\(/.test(searchSrc), '搜索有跨素材检索')
  ok(/sentCount/.test(searchSrc) && /customCount/.test(searchSrc), '页面有句子与自建素材的计数')
  ok(/practiceOne\(/.test(searchSrc), '搜到的句子能直接去跟读')
  const searchXml = read('pages/search/search.wxml')
  ok(/(bindtap|catchtap)="practiceOne"/.test(searchXml), 'wxml 上挂了「去跟读这句」')

  // H. worker：同一 WiFi 下多台设备不再互相挤占额度
  const workerSrc = read('deploy/ai/worker.js')
  ok(/DEVICE_DAILY_LIMIT/.test(workerSrc), 'worker 有每设备额度')
  ok(/function takeQuota\(/.test(workerSrc), '额度判断走 takeQuota（先设备再 IP）')
  ok(/x-device-id/.test(workerSrc), 'worker 读 x-device-id')
  ok(/x-device-id/.test(read('utils/ai-lookup.js')), 'AI 查词带设备号')
  ok(/x-device-id/.test(read('utils/ai-eval.js')), 'AI 听音带设备号')
  ok(/scope === 'device'/.test(workerSrc), '429 文案按设备/网络分开说')
  ok(/url\.pathname === '\/' \|\| url\.pathname === '\/health'/.test(workerSrc), '根路径给人看：返回接口说明，不再是 not-found')
  ok(/cache: !!env\.AI_CACHE/.test(workerSrc) && /configured: !!env\.GEMINI_API_KEY/.test(workerSrc), '根路径能看出缓存与 Key 是否就位')

  // I. 发布物：同一份数据不再进 git 两遍
  ok(!fsMod.existsSync(pathMod.join(__dirname, '..', 'deploy/cf/data.json')) ||
    /deploy\/cf\/data\.json/.test(read('.gitignore')),
  'deploy/cf/data.json 不进仓库（发布时复制）')
  ok(/cp \.\.\/data\.json data\.json/.test(read('deploy/cf/deploy.sh')), 'deploy.sh 发布前复制一份')
  ok(/cp deploy\/data\.json deploy\/cf\/data\.json/.test(read('.github/workflows/ci.yml')), 'CI 发布前复制一份')
  ok(/git diff --exit-code deploy\/data\.json\n/.test(read('.github/workflows/ci.yml')), 'CI 只校验仓库里那份 data.json')
}
