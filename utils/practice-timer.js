// 练习计时：只统计「页面在前台的时间」，不记任何内容。
// 儿童模式用它做休息提醒（15 分钟一次、30 分钟一次，每天各一次）。
// 用法：页面 onShow → timer.start()；onHide / onUnload → timer.stop()。
const storage = require('./storage')
const kidMode = require('./kid-mode')

let _t0 = 0
let _kid = false

const REST_TEXT = {
  15: { title: '休息一下 👀', content: '已经练了 15 分钟啦。看看远处，让眼睛歇一会儿，回来再练。' },
  30: { title: '今天先到这里', content: '练了 30 分钟，已经很棒了。休息一下吧，明天再来。' }
}

function start(kid) {
  _kid = !!kid
  _t0 = Date.now()
}

function stop() {
  if (!_t0) return
  const sec = Math.round((Date.now() - _t0) / 1000)
  _t0 = 0
  // 3 秒以下多半是误触（切个语言又切回来），不值得记
  if (sec < 3) return
  storage.addPracticeSeconds(sec)
  if (!_kid) return
  const step = kidMode.restDue()
  if (!step) return
  const t = REST_TEXT[step] || REST_TEXT[15]
  wx.showModal({ title: t.title, content: t.content, showCancel: false, confirmText: '知道了' })
}

// 给测试与「切换档案」用：把计时归零，不记时长
function reset() { _t0 = 0 }

module.exports = { start: start, stop: stop, reset: reset, REST_TEXT: REST_TEXT }
