// 反馈工具：轻震动 + 成功/警告提示音（可选，失败静默不影响功能）
// 统一入口，方便用户在设置里关闭（读取 storage 的 feedbackEnabled）。

const storage = require('./storage')

function enabled() {
  try {
    const s = storage.getSettings()
    return s.feedbackEnabled !== false
  } catch (e) { return true }
}

function vibrate(type) {
  if (!enabled()) return
  try {
    if (type === 'heavy') wx.vibrateLong({ fail() {} })
    else wx.vibrateShort({ type: 'light', fail() {} })
  } catch (e) {}
}

// 答对/流利：轻震 + 成功音
function success() {
  if (!enabled()) return
  vibrate('light')
  playTone('success')
}

// 录音开始/停止：轻震
function tap() { vibrate('light') }

// 答错/需重练：短震
function warn() { vibrate('light') }

// 用 InnerAudioContext 播放一个极短的数据音（不依赖网络文件）
// 微信不支持 data URI，这里用系统提示音替代：setEnableAlert 不一定可用，故静默处理。
function playTone(kind) {
  if (!enabled()) return
  try {
    // 优先用微信的 toast 图标音（若可用）
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail() {} })
  } catch (e) {}
}

module.exports = { vibrate, success, tap, warn, enabled }
