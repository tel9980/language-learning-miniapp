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
function schedule(old, quality) {
  const q = normalize(quality)
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
  return { intervalDays, ef: Math.round(newEf * 100) / 100, level, reps, lapses, quality: q }
}

// 计算 dueAt：intervalDays=0 表示 10 分钟后（口语重点短间隔）
function dueAt(intervalDays) {
  return Date.now() + (intervalDays === 0 ? 10 * 60 * 1000 : intervalDays * DAY)
}

module.exports = { schedule, dueAt, normalize, DAY }
