// 词库：英语为主，结构上预留多语言扩展（增加 ja 等语种即可）
// 数据本身拆在 words.en.js / words.ja.js / words.vi.js 里，**按语种懒加载**：切到日语或越南语时不必解析 480 个英语词
// （首页只用到 utils/lang.js 的语言元信息，早就不经过这里）。
// 字段：id / word 词形 / phonetic 音标 / meaning 释义 / example 例句 / exampleCn 例句中文 / category 类别
const { getLangMeta, LANG_KEYS } = require('./lang')

const _builtin = {}
function builtin(langKey) {
  const k = LANG_KEYS.indexOf(langKey) >= 0 ? langKey : 'en'
  if (!_builtin[k]) _builtin[k] = require('./words.' + k).words
  return _builtin[k]
}

// 兼容旧的 words.WORDS.en 写法：仍是同一个数组，只是取的时候才加载
const WORDS = {}
LANG_KEYS.forEach(function (k) {
  Object.defineProperty(WORDS, k, { get() { return builtin(k) }, enumerable: true })
})


function getWords(lang) {
  // 在线覆盖层：配置了在线词库且有缓存时优先用；否则用内置（默认行为不变）
  try {
    const od = require('./online-data').getOverride()
    if (od && od.words && od.words[lang] && od.words[lang].length) return od.words[lang]
  } catch (e) {}
  return builtin(lang)
}

// 词表分类分组。先按固定顺序出「考试类」，再出「场景类」，最后兜住任何新加的类别，
// 保证新增 category 一定能在页面上选到（否则只能出现在「全部」里）。
const CATEGORY_ORDER = [
  '四级', '六级', '考研', '雅思托福',
  '日常', '情绪', '工作', '科技', '旅行', '健康', '饮食', '社交',
  '交通', '购物', '学校', '家庭', '身体', '天气', '形容词', '动词',
  '食物', '数字', '时间', '问候', '财务'
]
function getExamCategories(lang) {
  const list = getWords(lang)
  const map = {}
  list.forEach(w => { map[w.category] = (map[w.category] || 0) + 1 })
  const known = CATEGORY_ORDER.filter(k => map[k])
  const extra = Object.keys(map).filter(k => known.indexOf(k) < 0).sort()
  return known.concat(extra).map(k => ({ name: k, count: map[k] }))
}

// 按考试分类过滤词表
function getWordsByCategory(lang, category) {
  const list = getWords(lang)
  return (!category || category === '全部') ? list : list.filter(w => w.category === category)
}

module.exports = { WORDS, LANG_KEYS, getWords, getLangMeta, getExamCategories, getWordsByCategory }
