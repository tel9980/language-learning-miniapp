// 家庭聚合：跨档案读取统计做排行榜；录音点评存全局 key（录音 id 全局唯一）。
const profile = require('./profile')

const KEY_COMMENTS = 'lp_family_comments_v1'
const KEY_SEEN = 'lp_family_comments_seen_v1' // 每个档案上次查看录音墙的时间

function rawRead(key, fallback) {
  try { const v = wx.getStorageSync(key); return v ? JSON.parse(v) : fallback } catch (e) { return fallback }
}
function rawWrite(key, value) {
  try { wx.setStorageSync(key, JSON.stringify(value)) } catch (e) {}
}

// 家庭排行榜：读每个档案的累计统计 + 今日口语
function leaderboard() {
  const tk = (function () {
    const t = new Date()
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0')
  })()
  const rows = profile.list().map(function (p) {
    let stats = {}, speakDaily = {}, speakRecords = {}
    try { stats = JSON.parse(wx.getStorageSync(profile.nsKey('lp_stats_v1', p.id)) || '{}') } catch (e) {}
    try { speakDaily = JSON.parse(wx.getStorageSync(profile.nsKey('lp_speak_daily_v1', p.id)) || '{}') } catch (e) {}
    try { speakRecords = JSON.parse(wx.getStorageSync(profile.nsKey('lp_speak_records_v1', p.id)) || '{}') } catch (e) {}
    const sd = speakDaily[tk] || {}
    let speakTimes = 0
    Object.keys(speakRecords).forEach(function (k) { speakTimes += (speakRecords[k].times || 0) })
    return {
      id: p.id, name: p.name, avatar: p.avatar,
      streak: stats.streak || 0,
      learned: stats.totalLearned || 0,
      speaks: speakTimes,
      todaySpeak: sd.count || 0,
      isCurrent: p.id === profile.current()
    }
  })
  // 默认按今日口语次数排，其次连续天数
  rows.sort(function (a, b) { return (b.todaySpeak - a.todaySpeak) || (b.streak - a.streak) || (b.learned - a.learned) })
  rows.forEach(function (r, i) { r.rank = i + 1 })
  return rows
}

// 汇总所有档案的录音（带所属档案名 + 点评数），最新在前
function familyRecordings() {
  const comments = rawRead(KEY_COMMENTS, {})
  const out = []
  profile.list().forEach(function (p) {
    let recs = []
    try { recs = JSON.parse(wx.getStorageSync(profile.nsKey('lp_recordings_v1', p.id)) || '[]') } catch (e) {}
    recs.forEach(function (r) {
      out.push(Object.assign({}, r, {
        ownerName: p.name, ownerAvatar: p.avatar,
        commentCount: (comments[r.id] || []).length
      }))
    })
  })
  out.sort(function (a, b) { return b.createdAt - a.createdAt })
  return out
}

function getComments(recordingId) {
  return (rawRead(KEY_COMMENTS, {})[recordingId] || [])
}

function addComment(recordingId, text) {
  if (!recordingId || !text || !text.trim()) return false
  const all = rawRead(KEY_COMMENTS, {})
  const p = profile.currentProfile() || { name: '家人' }
  const arr = all[recordingId] || []
  arr.push({ id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000), profileId: p.id, name: p.name, avatar: p.avatar, text: String(text).trim().slice(0, 100), at: Date.now() })
  all[recordingId] = arr
  rawWrite(KEY_COMMENTS, all)
  return true
}

function removeComment(recordingId, commentId) {
  const all = rawRead(KEY_COMMENTS, {})
  const arr = all[recordingId] || []
  all[recordingId] = arr.filter(function (c) { return c.id !== commentId })
  rawWrite(KEY_COMMENTS, all)
}

// 未读点评数：当前档案之外的家人，在"我"的录音下留下的、晚于上次查看时间的点评
function unreadComments() {
  const all = rawRead(KEY_COMMENTS, {})
  const seen = rawRead(KEY_SEEN, {})
  const myId = profile.current()
  const lastSeen = seen[myId] || 0
  const myRecordingIds = {}
  let mine = []
  try { mine = JSON.parse(wx.getStorageSync(profile.nsKey('lp_recordings_v1', myId)) || '[]') } catch (e) {}
  mine.forEach(function (r) { myRecordingIds[r.id] = true })
  let n = 0
  Object.keys(all).forEach(function (recId) {
    if (!myRecordingIds[recId]) return
    ;(all[recId] || []).forEach(function (c) {
      if (c.profileId !== myId && c.at > lastSeen) n++
    })
  })
  return n
}

// 标记当前档案已查看录音墙
function markCommentsSeen() {
  const seen = rawRead(KEY_SEEN, {})
  seen[profile.current()] = Date.now()
  rawWrite(KEY_SEEN, seen)
}

module.exports = { leaderboard, familyRecordings, getComments, addComment, removeComment, unreadComments, markCommentsSeen }
