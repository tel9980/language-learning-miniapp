// 成就徽章：根据累计数据计算解锁状态（纯函数，不写存储）
// 每个徽章: { id, name, icon, desc, unlocked, progress:'当前/目标' }

const DEFS = [
  { id: 'first_speak', name: '开口第一句', icon: '🎤', desc: '完成第 1 次口语练习', target: 1,
    value: (d) => d.speakTimes },
  { id: 'speak_50', name: '口语达人', icon: '🗣️', desc: '累计 50 次口语练习', target: 50,
    value: (d) => d.speakTimes },
  { id: 'fluent_10', name: '字正腔圆', icon: '🌟', desc: '有 10 个词/句说得流利', target: 10,
    value: (d) => d.fluent },
  { id: 'streak_7', name: '坚持一周', icon: '📅', desc: '连续打卡 7 天', target: 7,
    value: (d) => d.streak },
  { id: 'streak_30', name: '月度铁人', icon: '🔥', desc: '连续打卡 30 天', target: 30,
    value: (d) => d.streak },
  { id: 'mastered_50', name: '词汇收藏家', icon: '📚', desc: '掌握 50 个单词', target: 50,
    value: (d) => d.mastered },
  { id: 'dialogue_5', name: '对话高手', icon: '🎭', desc: '完成 5 个情景对话', target: 5,
    value: (d) => d.dialogues },
  { id: 'record_10', name: '留下声音', icon: '🎧', desc: '保存 10 条录音', target: 10,
    value: (d) => d.recordings }
]

function compute(data) {
  return DEFS.map(def => {
    const v = def.value(data) || 0
    return {
      id: def.id, name: def.name, icon: def.icon, desc: def.desc,
      unlocked: v >= def.target,
      progress: Math.min(v, def.target) + '/' + def.target
    }
  })
}

// 生成近 N 天打卡日历（含今天）
function calendar(daily, speakingDaily, n) {
  n = n || 28
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const key = `${d.getFullYear()}-${m}-${day}`
    const learnCount = (daily[key] && daily[key].reviewed) || 0
    const speakCount = (speakingDaily[key] && speakingDaily[key].count) || 0
    out.push({ key, day: d.getDate(), active: learnCount > 0 || speakCount > 0, speak: speakCount > 0 })
  }
  return out
}

module.exports = { DEFS, compute, calendar }
