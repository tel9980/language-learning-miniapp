// 统一的「弹框输入」封装（第十轮）
//
// 为什么要这个：wx.showModal 的 editable 模式全项目用了 7 处，
// 其中「设置每日目标」在 pages/index/index.js 与 pages/stats/stats.js 里
// 是两份一字不差的复制。校验规则、placeholder、toast 文案全一样，
// 改一处忘另一处就会不一致 —— 这种重复收进一个地方更稳。
//
// 只封装纯输入 + 校验 + 回调，不碰页面状态；页面拿到值自己 setData / refresh。

function askNumber(opts) {
  const o = opts || {}
  const min = o.min === undefined ? 1 : o.min
  const max = o.max === undefined ? 200 : o.max
  const title = o.title || '请输入数字'
  const content = o.content || ('请输入 ' + min + '-' + max + ' 的数字')
  wx.showModal({
    title: title,
    content: content,
    editable: true,
    placeholderText: o.value === undefined ? '' : String(o.value),
    success(res) {
      if (!res.confirm) return
      const n = parseInt(res.content, 10)
      if (!isNaN(n) && n >= min && n <= max) {
        if (o.done) o.done(n)
      } else {
        wx.showToast({ title: '请输入 ' + min + '-' + max + ' 的数字', icon: 'none' })
      }
    }
  })
}

function askText(opts) {
  const o = opts || {}
  const maxLen = o.maxLen || 20
  const title = o.title || '请输入'
  wx.showModal({
    title: title,
    content: o.content || '',
    editable: true,
    placeholderText: o.value === undefined ? '' : String(o.value),
    success(res) {
      if (!res.confirm) return
      const v = String(res.content || '').trim()
      if (!v) {
        wx.showToast({ title: '不能为空', icon: 'none' })
        return
      }
      if (v.length > maxLen) {
        wx.showToast({ title: '最多 ' + maxLen + ' 个字', icon: 'none' })
        return
      }
      if (o.done) o.done(v)
    }
  })
}

module.exports = { askNumber: askNumber, askText: askText }
