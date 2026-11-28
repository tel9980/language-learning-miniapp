const theme = require('../../utils/theme')
const storage = require('../../utils/storage')
const pageTimers = require('../../utils/page-timers')

Page({
  behaviors: [theme],
  data: {
    text: '',
    scene: '我的素材',
    count: 0,
    preview: [],
    mine: []            // 已保存的自建素材（可单条删除）
  },

  onShow() { this.syncTheme(); this.refreshMine() },
  // 定时器登记（第十一轮）：导入成功后 600ms 弹结果窗
  later(fn, ms) { return pageTimers.later(this, fn, ms) },
  onHide() { pageTimers.clear(this) },
  onUnload() { pageTimers.clear(this) },

  refreshMine() {
    this.setData({ mine: storage.getCustomItems(storage.getCurrentLang()) })
  },

  // 以前只有「添加」没有「删除」：导入错一条就再也去不掉（storage.removeCustomItem 一直没接 UI）
  removeOne(e) {
    const that = this
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条素材？',
      content: '删掉后不能再恢复（已产生的跟读记录保留）。',
      confirmText: '删除',
      confirmColor: '#E24A4A',
      success(res) {
        if (!res.confirm) return
        storage.removeCustomItem(id)
        that.refreshMine()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },

  onTextInput(e) { this.updatePreview(e.detail.value) },
  onSceneInput(e) { this.setData({ scene: e.detail.value }) },

  updatePreview(text) {
    // 每行一句；支持「英文|中文」格式
    const lines = String(text || '').split('\n').map(s => s.trim()).filter(Boolean)
    const preview = lines.slice(0, 20).map(line => {
      const parts = line.split('|')
      return { text: parts[0].trim(), cn: (parts[1] || '').trim() }
    })
    this.setData({ text, count: lines.length, preview })
  },

  save() {
    const that = this
    if (!this.data.count) {
      wx.showToast({ title: '请先输入素材内容', icon: 'none' })
      return
    }
    const lines = this.data.text.split('\n').map(s => s.trim()).filter(Boolean)
    const items = lines.map(line => {
      const parts = line.split('|')
      return { text: parts[0].trim(), cn: (parts[1] || '').trim(), scene: that.data.scene }
    }).filter(x => x.text)
    const lang = storage.getCurrentLang()
    // addCustomItems 现在返回 { added, skipped, capped }（第十四轮）：
    // 以前按 id 判重永远判不出重复，同一份内容导入两次会存两条；也没有上限。
    // 三个数字都要如实报出来，否则「已导入 N 条」会和用户实际看到的条数对不上。
    const r = storage.addCustomItems(items.map(x => Object.assign(x, { lang: lang })))
    const added = r.added
    const tail = []
    if (r.skipped) tail.push(`跳过 ${r.skipped} 条重复`)
    if (r.capped) tail.push(`${r.capped} 条超出上限（最多 ${storage.CUSTOM_MAX} 条）`)
    const note = tail.length ? '，' + tail.join('，') : ''
    wx.showToast({ title: added ? `已导入 ${added} 条` : '没有新增内容', icon: 'none' })
    this.later(() => {
      wx.showModal({
        title: added ? '导入成功' : '没有新增内容',
        content: added
          ? `已添加 ${added} 条到「自建」跟读素材${note}。去口语练习页切换「✏️ 自建」开始练习吧。`
          : `这次没有新内容${note}。`,
        showCancel: false,
        success() { wx.navigateBack() }
      })
    }, 600)
  },

  clear() {
    this.setData({ text: '', count: 0, preview: [] })
  }
})
