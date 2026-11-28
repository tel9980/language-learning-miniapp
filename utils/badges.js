// 徽章解锁提示（第十二轮）
//
// 问题：utils/achievements.js 的 compute() 以前全项目只有 pages/stats 一处调用。
// 用户连续打卡 7 天、掌握 50 个词，徽章确实解锁了，但**当时什么都看不到**，
// 只能自己想起来去统计页翻——徽章做了，却没有「解锁瞬间」。
//
// 这里负责三件事：
//   1. 把各模块的原始数据拼成 achievements.compute() 要的形状；
//   2. 和上次记下的已解锁集合比对，找出新解锁的；
//   3. 弹一条 toast，并把新的集合写回。
//
// 为什么不放在 utils/storage.js 的 review() 里：badges 依赖 storage，
// storage 再反过来 require badges 就成了循环依赖。所以由页面在动作成功之后调一次。
//
// 为什么不放在 app.onShow：那要等下次切回前台才提示，等于延迟一整天。
const storage = require('./storage')
const speaking = require('./speaking')
const recordings = require('./recordings')
const achievements = require('./achievements')
const sentences = require('./sentences')
const { getWords } = require('./words')

const profile = require('./profile')

const KEY = 'lp_badges_seen_v1'

// 「哪些徽章已经提示过」必须按档案隔离（第十四轮）：以前直接用 KEY 读写，
// 家人共用一台手机时，第一个人解锁过的徽章，第二个人达成时系统以为他早知道了，不弹提示。
// 同项目 utils/speaking.js 一直是正确写法（profile.nsKey(key)）。
function seenKey() {
  try { return profile.nsKey(KEY) } catch (e) { return KEY }
}

function readSeen() {
  try {
    const v = wx.getStorageSync(seenKey())
    if (Array.isArray(v)) return v
    if (typeof v === 'string' && v) {
      const arr = JSON.parse(v)
      return Array.isArray(arr) ? arr : []
    }
  } catch (e) {}
  return null   // null = 从来没记过（首次运行）
}

function writeSeen(ids) {
  try { wx.setStorageSync(seenKey(), ids) } catch (e) {}
}

// 拼 achievements.compute() 需要的数据。字段来源与 pages/stats/stats.js 保持一致，
// 两处算出来的徽章状态必须相同，否则统计页显示已解锁、这里却不提示。
function snapshot() {
  const stats = storage.getStats()
  const lang = storage.getCurrentLang()
  // 和 pages/stats/stats.js 的组法完全一致（那里是 getWords(lang) + sentences.getAllItems(lang)）。
  // 必须一致：fluent / dialogues 依赖 allItems 的范围，两边算得不一样就会出现
  // 「统计页显示已解锁、这里却不提示」。
  const allSpeakingItems = getWords(lang).concat(sentences.getAllItems(lang))
  const speak = speaking.getSummary(lang, allSpeakingItems)
  return {
    speakTimes: speak.speakTimes,
    fluent: speak.fluent,
    streak: stats.streak || 0,
    mastered: storage.getMasteredCount(lang),
    dialogues: speak.dialogues,
    recordings: recordings.list().length
  }
}

// 检查并提示。返回新解锁的徽章数组（给测试用）。
// quiet=true 只记录不弹（首次运行时用，避免把历史上已解锁的一口气弹出来）。
function check(quiet) {
  let badges
  try { badges = achievements.compute(snapshot()) } catch (e) { return [] }
  const unlocked = badges.filter(function (b) { return b.unlocked }).map(function (b) { return b.id })
  const seen = readSeen()
  // 首次运行：把当前已解锁的全记下来，不弹。否则老用户一更新就被十几条 toast 淹没。
  if (seen === null) { writeSeen(unlocked); return [] }
  const fresh = badges.filter(function (b) {
    return b.unlocked && seen.indexOf(b.id) < 0
  })
  if (!fresh.length) return []
  writeSeen(seen.concat(fresh.map(function (b) { return b.id })))
  if (!quiet) {
    const title = fresh.length === 1
      ? '🏅 解锁徽章：' + fresh[0].name
      : '🏅 解锁 ' + fresh.length + ' 枚新徽章'
    try { wx.showToast({ title: title, icon: 'none', duration: 2200 }) } catch (e) {}
  }
  return fresh
}

module.exports = { check, snapshot, KEY }
