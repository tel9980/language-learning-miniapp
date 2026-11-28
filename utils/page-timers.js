// 页面定时器回收（第十一轮）
//
// 问题：项目里 14 处 setTimeout，13 处没有在 onHide/onUnload 里 clear。
// 跳页之后回调照样会跑，典型后果：
//   · pages/speak/speak.js 评分后 700ms 自动 next()，用户中途返回 → 已卸载页面 setData
//   · pages/profiles 与 pages/stats 里 600–900ms 后 wx.reLaunch，用户已手动返回却被拽走
//
// 用法：页面里加一个薄方法转发即可
//   later(fn, ms) { return pageTimers.later(this, fn, ms) },
//   onHide() { pageTimers.clear(this) },
//   onUnload() { pageTimers.clear(this) }
// 然后 this.later(...) 代替 setTimeout(...)
//
// 为什么不用全局 patch setTimeout：会连 utils 里的延迟落盘一起改掉，
// 那些定时器（storage / speaking / sentence-progress）本来就该在页面销毁后继续跑。

function later(page, fn, ms) {
  if (!page || typeof setTimeout !== 'function') return 0
  if (!page._timers) page._timers = []
  const id = setTimeout(function () {
    // 触发后从列表里摘掉，避免数组一直变长
    const at = page._timers ? page._timers.indexOf(id) : -1
    if (at >= 0) page._timers.splice(at, 1)
    fn()
  }, ms)
  page._timers.push(id)
  return id
}

function clear(page) {
  const list = page && page._timers
  if (!list || !list.length) return 0
  let n = 0
  for (let i = 0; i < list.length; i++) {
    const id = list[i]
    if (id) { clearTimeout(id); n++ }
  }
  page._timers = []
  return n
}

module.exports = { later: later, clear: clear }