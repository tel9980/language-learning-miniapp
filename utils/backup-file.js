// 备份文件化（第十三轮）
//
// 背景：原来「导出学习数据」只有一条路 —— wx.setClipboardData 复制成一串 JSON 文本。
// 实测 828 个词全学完的备份约 60KB。用户要拿它换手机，得先粘进手机备忘录、
// 再从备忘录里整段选中复制回来，中间错一个字符 importData 就整包失败。
// 也就是说：备份功能是有的，但换手机时实际上用不上 —— 而这是它唯一的用途。
//
// 这里补上「文件」这条通道：
//   save()  → 写一份 backup-YYYYMMDD-HHmm.json 到本地文件目录
//   share() → 用 wx.shareFileMessage 让用户发给自己（文件传输助手）
//   pick()  → 用 wx.chooseMessageFile 从聊天记录里把文件选回来
//
// 全部做 typeof 检查与 try/catch：老基础库没有这些 API 时自动降级，
// 调用方拿到的 reason 会说明原因，界面回落到「复制到剪贴板」。
//
// 文件写在 USER_DATA_PATH 下，和录音、发音缓存共用每个小程序 10MB 的文件配额
// （见 utils/file-budget.js）。一份备份 15–60KB，可忽略，但还是只保留最近 3 份。

const KEEP = 3
const PREFIX = 'backup-'

function fs() {
  return wx.getFileSystemManager && wx.getFileSystemManager()
}

function dir() {
  return (wx.env && wx.env.USER_DATA_PATH) || ''
}

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

// backup-20261128-221530.json（带秒，同一分钟内连按两次也不会互相覆盖）
function fileName(d) {
  const t = d || new Date()
  return PREFIX + t.getFullYear() + pad(t.getMonth() + 1) + pad(t.getDate()) +
    '-' + pad(t.getHours()) + pad(t.getMinutes()) + pad(t.getSeconds()) + '.json'
}

// 只留最近 KEEP 份，其余删掉（按文件名排序即时间序）
function prune() {
  const m = fs()
  const base = dir()
  if (!m || !base) return 0
  let names = []
  try { names = m.readdirSync(base) || [] } catch (e) { return 0 }
  const mine = names.filter(function (n) { return n.indexOf(PREFIX) === 0 && /\.json$/.test(n) }).sort()
  let dropped = 0
  while (mine.length > KEEP) {
    const old = mine.shift()
    try { m.unlinkSync(base + '/' + old); dropped += 1 } catch (e) {}
  }
  return dropped
}

// 写一份备份，返回 { ok, filePath, reason }
function save(json) {
  if (typeof json !== 'string' || !json) return { ok: false, reason: 'empty' }
  const m = fs()
  const base = dir()
  if (!m || !base) return { ok: false, reason: 'unsupported' }
  const name = fileName()
  const filePath = base + '/' + name
  try {
    m.writeFileSync(filePath, json, 'utf8')
  } catch (e) {
    return { ok: false, reason: 'write-failed', error: e }
  }
  prune()
  return { ok: true, filePath: filePath, name: name }
}

// 把文件发给微信好友 / 文件传输助手（必须在用户点击的回调里调用）
function share(filePath, name, cb) {
  const done = typeof cb === 'function' ? cb : function () {}
  if (typeof wx.shareFileMessage !== 'function') { done({ ok: false, reason: 'unsupported' }); return }
  if (!filePath) { done({ ok: false, reason: 'no-file' }); return }
  try {
    wx.shareFileMessage({
      filePath: filePath,
      fileName: name || '',
      success: function () { done({ ok: true }) },
      fail: function (err) { done({ ok: false, reason: 'cancelled', error: err }) }
    })
  } catch (e) {
    done({ ok: false, reason: 'failed', error: e })
  }
}

// 从聊天记录里选一个备份文件，读出文本。cb({ ok, text, name, reason })
function pick(cb) {
  const done = typeof cb === 'function' ? cb : function () {}
  if (typeof wx.chooseMessageFile !== 'function') { done({ ok: false, reason: 'unsupported' }); return }
  const m = fs()
  if (!m) { done({ ok: false, reason: 'unsupported' }); return }
  try {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: function (res) {
        const f = res && res.tempFiles && res.tempFiles[0]
        if (!f || !f.path) { done({ ok: false, reason: 'no-file' }); return }
        // 60KB 上限放到 4MB：正常备份 15–60KB，留足余量又不至于把内存读爆
        if (f.size && f.size > 4 * 1024 * 1024) { done({ ok: false, reason: 'too-big' }); return }
        let text = ''
        try { text = m.readFileSync(f.path, 'utf8') } catch (e) { done({ ok: false, reason: 'read-failed', error: e }); return }
        if (typeof text !== 'string' || !text) { done({ ok: false, reason: 'empty' }); return }
        done({ ok: true, text: text, name: f.name || '' })
      },
      fail: function (err) { done({ ok: false, reason: 'cancelled', error: err }) }
    })
  } catch (e) {
    done({ ok: false, reason: 'failed', error: e })
  }
}

module.exports = { save: save, share: share, pick: pick, fileName: fileName, KEEP: KEEP }
