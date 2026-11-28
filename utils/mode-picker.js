// 模式选择面板：首页顶部、统计页设置、家人档案页共用同一套文案。
// 以前只在家人档案页的一个小按钮里弹 ActionSheet，文案写「儿童模式（字大、简单）」，
// 而「简单」这件事并不存在——分散维护最容易出这种谎。集中到这里，改一次三处一致。
const profile = require('./profile')
const logger = require('./logger')

const LABELS = {
  normal: '标准模式（正常字号）',
  kid: '儿童模式（字更大、只留基础分类）',
  elder: '长辈模式（超大字）'
}

// 给「当前档案」换模式。done(key) 在切换成功后回调，页面自己决定要不要刷新。
function pick(done) {
  const p = profile.currentProfile()
  if (!p) return false
  const keys = Object.keys(profile.modes())
  wx.showActionSheet({
    itemList: keys.map(function (k) { return LABELS[k] || k }),
    success(res) {
      const key = keys[res.tapIndex]
      if (!key || key === p.mode) return
      profile.setMode(p.id, key)
      if (done) done(key)
      wx.showToast({ title: '已切到' + ((profile.modes()[key] || {}).name || '') + '模式', icon: 'none' })
      // 切模式改的是全局状态：字号、深色、以及词库的过滤范围（儿童模式藏掉 7 个分类）。
      // tabBar 的 5 个页面实例是常驻的，只刷当前页会让「学习」页继续摆着四级/六级、
      // 右上角继续写「共 828 词」，也就是用户说的「字库没跟着切换」。
      // 这里统一重建当前页，其余页下次进入时按新模式重新 onLoad。
      reloadCurrent()
    }
  })
  return true
}

// 重建当前页面（新实例、新 data）。留在原页面，不把用户弹回首页。
function reloadCurrent() {
  let url = '/pages/index/index'
  try {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1]
    if (cur && cur.route) url = '/' + cur.route
  } catch (e) { logger.warn('[mode-picker] 取当前页面失败，回首页重建', e) }
  setTimeout(function () {
    try { wx.reLaunch({ url: url }) } catch (e) { logger.warn('[mode-picker] 重建页面失败', e) }
  }, 400)
}

module.exports = { pick: pick, LABELS: LABELS, reloadCurrent: reloadCurrent }
