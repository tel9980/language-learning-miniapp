// 设备标识：一串本机随机生成的字母数字，只用于「同一 WiFi 下分摊 AI 额度」。
//
// 为什么需要：AI 查词/评测的额度按出口 IP 算，一家人共用一个 WiFi 就是一个池子，
// 一台手机查猛了别人全被挡，而提示只写「明天再来」，用户不知道是被谁用掉的。
// 服务端（deploy/ai/worker.js）加了每设备一档额度，需要客户端带一个稳定的标识。
//
// 注意：这不是用户 ID —— 不含昵称、手机号、档案信息，换设备就换一个，
// 卸载重装也会变（存在 Storage 里）。档案切换时也不变（设备级，不是档案级）。
const KEY = 'lp_device_id_v1'

function id() {
  let v = ''
  try { v = wx.getStorageSync(KEY) } catch (e) {}
  if (v && /^[a-z0-9]{6,40}$/i.test(String(v))) return String(v)
  v = 'dev' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  try { wx.setStorageSync(KEY, v) } catch (e) {}
  return v
}

// 按档案分摊：一台手机四个家人档案，以前共用一份额度，
// 一个人查 60 个词，另外三个人当天就没额度了。额度应该跟「谁在用」走。
// 仍然不含任何身份信息——只是设备号后面拼一个本机档案序号。
function scopedId() {
  const base = id()
  let pid = ''
  try {
    const profile = require('./profile')
    const p = profile.currentProfile && profile.currentProfile()
    if (p && p.id) pid = String(p.id).replace(/[^a-z0-9]/gi, '').slice(0, 8)
  } catch (e) {}
  return pid ? base + '-' + pid : base
}

module.exports = { id, scopedId }
