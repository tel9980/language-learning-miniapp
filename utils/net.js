// 在线状态判断（第九轮）
//
// 为什么要这个：以前 AI 查词 / AI 听音 / 对练 三个请求都是「先发出去，等超时」——
// utils/ai-lookup.js 15 秒、utils/ai-eval.js 25 秒、utils/translate.js 25 秒。
// 用户在地铁里点一下，要干等 15–25 秒才看到「再试一次」，而第 0.1 秒其实就断网了。
//
// 这里只做一件事：问 app 的 globalData.online（由 app.js 的 wx.onNetworkStatusChange 维护）。
// 拿不到就默认「在线」——宁可让它去试，也不要因为判断不准把能用的网络判成断网。
function isOnline() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null
    if (app && typeof app.isOnline === 'function') return app.isOnline()
    if (app && app.globalData && app.globalData.online !== undefined) return !!app.globalData.online
  } catch (e) {}
  return true
}

module.exports = { isOnline: isOnline }
