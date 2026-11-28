// 练习计时：只统计「页面在前台的时间」，不记任何内容。
// 儿童模式用它做休息提醒（15 分钟一次、30 分钟一次，每天各一次）。
// 用法：页面 onShow → timer.start(isKid)；onHide / onUnload → timer.stop()。
//
// 第十三轮重写：提醒时机从「离开页面时结算」改成「页内定时到点就弹」。
// 旧实现在 stop() 里才检查，于是孩子在口语页连着练 40 分钟一次提醒都没有
// （口语页本来就是「练一长串句子」的场景，很容易一坐半小时）；
// 等终于离开，又一次性补弹 15 分钟、30 分钟两条，说的还是已经过去的事。
const storage = require('./storage')
const kidMode = require('./kid-mode')

let _t0 = 0        // 本次前台开始的时间戳（0 = 当前不在前台）
let _kid = false
let _timer = null  // 到点提醒的定时器

const REST_TEXT = {
  15: { title: '休息一下 👀', content: '已经练了 15 分钟啦。看看远处，让眼睛歇一会儿，回来再练。' },
  30: { title: '练得够久了', content: '已经练了 30 分钟，今天很努力了。休息一下，明天再来接着练。' }
}

// 已累计的练习秒数 = 今天落盘的 + 本次前台已经过去的
// 为什么不能只用 storage.getPracticeSeconds()：那是 stop() 时才落盘的，
// 一次长练习期间它一直停在进入页面那一刻的值，页内定时就永远等不到 15 分钟。
function elapsedSeconds() {
  const base = storage.getPracticeSeconds() || 0
  const cur = _t0 ? Math.max(0, (Date.now() - _t0) / 1000) : 0
  return base + cur
}

function disarm() {
  if (_timer) {
    try { clearTimeout(_timer) } catch (e) {}
    _timer = null
  }
}

// 按「还剩多久到下一个没提示过的档位」设一个定时器
function arm() {
  disarm()
  if (!_kid) return
  const steps = kidMode.REST_STEPS
  const elapsed = elapsedSeconds()
  let target = 0
  for (let i = 0; i < steps.length; i++) {
    if (storage.kidRestSeen(String(steps[i]))) continue  // 今天这一档已经提示过
    // 取第一个「今天还没提示过」的档位。已经过点的话 wait 会是 0，等于马上补一次 ——
    // 不能跳过去，否则这一档今天就再也不会出现了（例如上次小程序被系统杀掉、定时器没跑成）。
    target = steps[i]
    break
  }
  if (!target) return
  const wait = Math.max(0, target * 60 * 1000 - elapsed * 1000)
  _timer = setTimeout(function () {
    _timer = null
    fire(target)
  }, wait)
}

function fire(step) {
  if (!_kid) return
  if (storage.kidRestSeen(String(step))) { arm(); return }
  storage.markKidRestSeen(String(step))
  const t = REST_TEXT[step] || REST_TEXT[15]
  try {
    wx.showModal({
      title: t.title,
      content: t.content,
      showCancel: false,
      confirmText: '知道了',
      // 关掉之后接着盯下一档（15 分钟档弹完就排 30 分钟档）
      complete: function () { arm() }
    })
  } catch (e) {
    arm()
  }
}

function start(kid) {
  _kid = !!kid
  _t0 = Date.now()
  arm()
}

function stop() {
  disarm()
  if (!_t0) return
  const sec = Math.round((Date.now() - _t0) / 1000)
  _t0 = 0
  // 3 秒以下多半是误触（切个语言又切回来），不值得记
  if (sec < 3) return
  storage.addPracticeSeconds(sec)
  // 注意：这里不再弹提醒 —— 提醒由页内定时器负责，见文件头。
}

// 给测试与「切换档案」用：把计时归零，不记时长
function reset() {
  disarm()
  _t0 = 0
}

module.exports = { start: start, stop: stop, reset: reset, REST_TEXT: REST_TEXT, elapsedSeconds: elapsedSeconds }
