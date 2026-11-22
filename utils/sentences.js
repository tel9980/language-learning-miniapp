// 口语素材库：句子跟读 + 情景对话（脱离单词级别，练连贯表达）
// 统一条目结构：{ id, text, cn, scene, level, role? }
//   scene 场景名；level CEFR 等级（A1/A2/B1/B2）；role 可空，情景对话里区分角色
//
// 素材按语种分文件放（sentences.en.js / .ja.js / .vi.js），这里只做懒加载：
// 三语全量在一个文件里是 49.7KB，进任何一个页面都要先解析三份，而每次只用一份。
// 和 utils/words.js 一样，用 require 的天然缓存，第二次以后是 0 成本。

const { LANG_KEYS } = require('./lang')

const _cache = {}

function dataOf(langKey) {
  const k = LANG_KEYS.indexOf(langKey) >= 0 ? langKey : 'en'
  if (!_cache[k]) {
    const m = require('./sentences.' + k)
    _cache[k] = { sentences: m.sentences || [], dialogues: m.dialogues || [] }
  }
  return _cache[k]
}

// 保留 SENTENCES.en / DIALOGUES.ja 这种旧写法（deploy/export-data.js 在用），
// 但只有真正访问某个语种时才把那一个语种的文件加载进来。
const SENTENCES = {}
const DIALOGUES = {}
LANG_KEYS.forEach(function (k) {
  Object.defineProperty(SENTENCES, k, {
    get: function () { return dataOf(k).sentences },
    enumerable: true
  })
  Object.defineProperty(DIALOGUES, k, {
    get: function () { return dataOf(k).dialogues },
    enumerable: true
  })
})

const LEVELS = ['A1', 'A2', 'B1', 'B2']

function getSentencesBuiltin(lang) {
  const d = dataOf(lang)
  return d.sentences.length ? d.sentences : dataOf('en').sentences
}
function getDialoguesBuiltin(lang) {
  const d = dataOf(lang)
  return d.dialogues.length ? d.dialogues : dataOf('en').dialogues
}

function getSentences(lang, level) {
  let list = getSentencesBuiltin(lang)
  try {
    const od = require('./online-data').getOverride()
    if (od && od.sentences && od.sentences[lang] && od.sentences[lang].length) list = od.sentences[lang]
  } catch (e) {}
  return level ? list.filter(function (s) { return s.level === level }) : list
}
function getDialogues(lang, level) {
  let list = getDialoguesBuiltin(lang)
  try {
    const od = require('./online-data').getOverride()
    if (od && od.dialogues && od.dialogues[lang] && od.dialogues[lang].length) list = od.dialogues[lang]
  } catch (e) {}
  return level ? list.filter(function (d) { return d.level === level }) : list
}
function getLevels() { return LEVELS.slice() }
// 把一条台词/句子转成可跟读的统一对象（id 带前缀避免与单词 id 冲突）
function toItem(raw, prefix) {
  return {
    id: (prefix || 'sp') + '_' + raw.id,
    word: raw.text,
    phonetic: '',
    meaning: raw.cn,
    example: raw.text,
    exampleCn: raw.cn,
    scene: raw.scene || raw.role || '',
    role: raw.role || '',
    level: raw.level || '',
    kind: 'sentence'
  }
}
// 取所有句子条目（含对话台词，平铺），供跟读队列使用
function getAllItems(lang) {
  const list = []
  getSentences(lang).forEach(s => list.push(toItem(s, 'st')))
  getDialogues(lang).forEach(d => d.lines.forEach(l => list.push(toItem(Object.assign({ scene: d.scene, level: d.level }, l), 'dl'))))
  return list
}

module.exports = {
  SENTENCES, DIALOGUES, LEVELS,
  getSentences, getDialogues, getLevels, getAllItems, toItem
}
