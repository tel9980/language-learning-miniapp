// 自建跟读素材的存储形状是 { id, text, cn, scene, lang, createdAt }（见 utils/storage.js 的 addCustomItems），
// 而词库 / 句子 / 对话条目统一用 { word, meaning } 表达「要念的文本 / 中文解释」。
// 练习页、重点复练都按后者取值，所以自建素材必须先在这里归一化一次：
// 不归一化的话，舞台文本是空的、点发音会把字面量 "undefined" 送去合成。
function toPracticeItem(x) {
  if (!x) return null
  const word = String(x.word || x.text || '').trim()
  if (!word) return null
  return {
    id: x.id,
    word: word,
    meaning: x.meaning || x.cn || '',
    phonetic: x.phonetic || '',
    example: x.example || '',
    exampleCn: x.exampleCn || '',
    scene: x.scene || '我的素材',
    kind: x.kind || 'sentence',
    isCustom: true
  }
}

function toPracticeItems(list) {
  return (list || []).map(toPracticeItem).filter(Boolean)
}

module.exports = { toPracticeItem, toPracticeItems }
