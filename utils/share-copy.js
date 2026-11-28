// 分享文案：把「练英语口语」里的语种名跟着当前语种走。
//
// 以前 8 处都写死「英语」：学日语的用户连续打卡 30 天，分享出去是
// 「我在「语伴」连续打卡 30 天……一起来练英语口语吧」——对方点进来是日语界面，
// 两边对不上，对分享人自己的可信度也是折扣。
//
// 这里只做一件事：给一个语种码，返回该语种的「…口语」说法。
// 文案模板统一放这里，页面只管把数据递进来（见 pages/index、pages/stats、pages/share）。
const { getLangMeta } = require('./lang')

// 语种名 → 「练X口语」的 X。getLangMeta().name 已经是「英语/日语/越南语/韩语」，
// 直接拼即可；这里留一张表是为了以后要改说法（比如加「粤语」写成「广东话」）不用翻页面。
const SPOKEN = {
  en: '英语',
  ja: '日语',
  vi: '越南语',
  ko: '韩语'
}

function spokenOf(lang) {
  if (SPOKEN[lang]) return SPOKEN[lang]
  const m = getLangMeta(lang)
  return (m && m.name) || '外语'
}

/**
 * 拼分享标题。
 * @param {{lang?:string, streak?:number, mastered?:number, badges?:number}} opts
 * @returns {string}
 */
function title(opts) {
  const o = opts || {}
  const name = spokenOf(o.lang)
  const streak = o.streak || 0
  const mastered = o.mastered || 0
  const badges = o.badges || 0

  if (streak || mastered) {
    let t = '我在「语伴」连续打卡 ' + streak + ' 天，掌握了 ' + mastered + ' 个' + name + '词'
    if (badges) t += '，解锁 ' + badges + ' 枚徽章'
    return t + '，一起来练' + name + '口语吧'
  }
  return '来和我一起练' + name + '口语｜语伴'
}

/** 邀请页/朋友圈那种更短的版本 */
function invite(opts) {
  const o = opts || {}
  const name = spokenOf(o.lang)
  const who = o.name || '我'
  return who + '邀请你一起用「语伴」练' + name + '口语，点开就能试，免费～'
}

module.exports = { title: title, invite: invite, spokenOf: spokenOf, SPOKEN: SPOKEN }
