// 复习调度算法：SM-2 风格动态间隔（替代固定 INTERVALS）
// 保留旧 progress 字段（level/reps/lapses/dueAt）兼容，新增 EF（难度因子）/stability。
// 评分 quality: 0=不记得 1=模糊 2=记得（口语页三档）；也兼容 3/5（学习页旧档）。

const DAY = 24 * 60 * 60 * 1000

function normalize(q) {
  if (q >= 5) return 2
  if (q === 3) return 1
  if (q === 1) return 1
  return 0
}

// 返回 { intervalDays, ef, level, reps, lapses } —— 只算调度，不写存储
//
// opts（可选，给句子调度用；单词不传，行为与以前完全一致）：
//   weight   0~1，这次评分有多可信——测验/听写答对是硬信号 1.0，
//            机评 0.85，自评 0.7。间隔按 (0.5 + 0.5 * weight) 缩放，
//            也就是「自己说记得」只算八成，别把间隔一次拉太远。
//   sameDay  true = 同一天已经练过一次，这次不晋级，只把到期时间往前挪一点
//            （防止连着点五次「很流利」，间隔一天内翻到 30 天）
function schedule(old, quality, opts) {
  const q = normalize(quality)
  const o = opts || {}
  const weight = typeof o.weight === 'number' ? Math.max(0, Math.min(1, o.weight)) : 1
  const ef = Math.max(1.3, Math.min(2.5, old.ef == null ? 2.5 : old.ef))
  const reps = (old.reps || 0) + (q >= 1 ? 1 : 0)
  const lapses = (old.lapses || 0) + (q === 0 ? 1 : 0)

  let level = old.level || 0
  let newEf = ef + (0.1 - (2 - q) * (0.08 + (2 - q) * 0.02))
  newEf = Math.max(1.3, Math.min(2.5, newEf))

  let intervalDays
  if (q === 0) {
    level = 0
    intervalDays = 0 // 10 分钟后（由调用方用 0 表示短间隔）
  } else {
    level = Math.min(level + 1, 8)
    if (reps <= 1) intervalDays = 1
    else if (reps === 2) intervalDays = 6
    else intervalDays = Math.max(1, Math.round(Math.pow(level, newEf) * 0.6))
  }

  if (o.sameDay && q >= 1) {
    // 同一天重复练：不晋级，间隔只按「上次间隔 × 1.2」小幅前移
    level = old.level || 0
    intervalDays = Math.max(1, Math.round((old.intervalDays || 1) * 1.2))
  }
  if (weight < 1) intervalDays = Math.max(1, Math.round(intervalDays * (0.5 + 0.5 * weight)))
  return { intervalDays, ef: Math.round(newEf * 100) / 100, level, reps, lapses, quality: q }
}

// 计算 dueAt：intervalDays=0 表示 10 分钟后（口语重点短间隔）
function dueAt(intervalDays) {
  return Date.now() + (intervalDays === 0 ? 10 * 60 * 1000 : intervalDays * DAY)
}

module.exports = { schedule, dueAt, normalize, DAY }
