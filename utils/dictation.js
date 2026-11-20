// 听写用的文本归一化：只比「听到的内容」，不 punishing 大小写和标点。
// 例：'Could you help me, please?' 与 'could you help me please' 视为一致。
function normalizeAnswer(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,!?;:"“”‘’()\[\]…—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 判定：完全一致算对；单词允许漏掉所有格缩写差异（don't / dont）
function isAnswerRight(input, answer) {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(answer)
  if (!a) return false
  if (a === b) return true
  return a.replace(/'/g, '') === b.replace(/'/g, '')
}

module.exports = { normalizeAnswer, isAnswerRight }
