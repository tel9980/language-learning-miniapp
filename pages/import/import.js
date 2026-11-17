const theme = require('../../utils/theme')
const storage = require('../../utils/storage')

Page({
  behaviors: [theme],
  onShow() { this.syncTheme() },
  data: {
    text: '',
    scene: '我的素材',
    count: 0,
    preview: []
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
    const added = storage.addCustomItems(items.map(x => Object.assign(x, { lang: lang })))
    wx.showToast({ title: `已导入 ${added} 条`, icon: 'success' })
    setTimeout(() => {
      wx.showModal({
        title: '导入成功', content: `已添加 ${added} 条到「自建」跟读素材，去口语练习页切换「✏️ 自建」开始练习吧。`,
        showCancel: false,
        success() { wx.navigateBack() }
      })
    }, 600)
  },

  clear() {
    this.setData({ text: '', count: 0, preview: [] })
  }
})
