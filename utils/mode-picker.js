// 模式选择面板：首页顶部、统计页设置、家人档案页共用同一套文案。
// 以前只在家人档案页的一个小按钮里弹 ActionSheet，文案写「儿童模式（字大、简单）」，
// 而「简单」这件事并不存在——分散维护最容易出这种谎。集中到这里，改一次三处一致。
const profile = require('./profile')

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
    }
  })
  return true
}

module.exports = { pick: pick, LABELS: LABELS }
