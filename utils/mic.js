// 麦克风权限的「被拒之后还有救」处理。
//
// 为什么需要它：微信的系统授权弹窗只会弹一次。用户点了「拒绝」（或者手滑点了，
// 或者第一次点录音时系统弹窗和《声纹授权协议》页前后脚出现、他没看清就拒了），
// 之后再调 recorderManager.start() 永远失败，而原来只提示一句
// 「录音失败，请检查麦克风权限」—— 他不知道去哪检查，只能翻右上角 ··· → 设置。
// 绝大多数人到这一步就认定「这功能坏了」。
//
// 所以这里做两件事：
//   check(next)  录制前先探一次，明确拒绝过就直接引导去 wx.openSetting()
//   guide(next)  录音失败的兜底引导（onError 里用），语义和 check 一样
// 注意：authSetting['scope.record'] 为 undefined 表示「还没问过」，这时不要引导，
// 直接放行让系统自己弹窗——否则会出现「还没拒绝就先教育用户」的怪体验。
const SCOPE = 'scope.record'

function ask(next) {
  wx.showModal({
    title: '麦克风被关掉了',
    content: '录不进去是因为没给麦克风权限。点「去开启」在设置里打开「麦克风」，回来就能录了。',
    confirmText: '去开启',
    cancelText: '先不用',
    success(res) {
      if (!res.confirm) { if (next) next(false); return }
      if (typeof wx.openSetting !== 'function') { if (next) next(false); return }
      wx.openSetting({
        success(s) {
          const ok = !!(s && s.authSetting && s.authSetting[SCOPE] === true)
          if (!ok) {
            try { wx.showToast({ title: '还是没打开，录音暂时用不了', icon: 'none' }) } catch (e) {}
          }
          if (next) next(ok)
        },
        fail() { if (next) next(false) }
      })
    },
    fail() { if (next) next(false) }
  })
}

// 录制前调用。next(true) 才可以往下走。
function check(next) {
  const done = function (ok) { if (next) next(!!ok) }
  if (typeof wx.getSetting !== 'function') { done(true); return }
  wx.getSetting({
    success(res) {
      const v = res && res.authSetting ? res.authSetting[SCOPE] : undefined
      if (v === false) { ask(done); return }
      done(true)      // true = 已授权，undefined = 还没问过（交给系统弹窗）
    },
    fail() { done(true) }
  })
}

// 录音已经失败之后的引导（onError 路径）。
function guide(next) {
  if (typeof wx.getSetting !== 'function') { if (next) next(false); return }
  wx.getSetting({
    success(res) {
      const v = res && res.authSetting ? res.authSetting[SCOPE] : undefined
      if (v === false) { ask(next); return }
      // 权限是开的还失败：不是权限问题，说清楚别误导
      try { wx.showToast({ title: '录音没启动成功，再点一次试试', icon: 'none' }) } catch (e) {}
      if (next) next(false)
    },
    fail() { if (next) next(false) }
  })
}

module.exports = { check, guide, SCOPE }
