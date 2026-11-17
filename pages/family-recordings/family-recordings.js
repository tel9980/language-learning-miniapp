const theme = require('../../utils/theme')
const family = require('../../utils/family')

Page({
  behaviors: [theme],
  data: { list: [], commentCounts: {}, playingId: '' },
  _player: null,

  onShow() { this.syncTheme(); this.refresh(); family.markCommentsSeen() },
  onHide() { this.stopPlay() },
  onUnload() { this.stopPlay() },

  refresh() {
    const list = family.familyRecordings().map(r => Object.assign({}, r, {
      timeText: this.formatTime(r.createdAt)
    }))
    this.setData({ list })
  },

  formatTime(ts) {
    const d = new Date(ts)
    const p = n => String(n).padStart(2, '0')
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  },

  play(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.list.find(x => x.id === id)
    if (!item || !item.filePath) return
    this.stopPlay()
    const that = this
    this._player = wx.createInnerAudioContext()
    this._player.src = item.filePath
    this._player.onEnded(() => that.setData({ playingId: '' }))
    this._player.onError(() => { wx.showToast({ title: '播放失败', icon: 'none' }); that.setData({ playingId: '' }) })
    this._player.play()
    this.setData({ playingId: id })
  },

  stopPlay() {
    if (this._player) { try { this._player.stop(); this._player.destroy() } catch (e) {} this._player = null }
    this.setData({ playingId: '' })
  },

  comments(e) {
    const id = e.currentTarget.dataset.id
    const that = this
    const list = family.getComments(id)
    const lines = list.length ? list.map(c => c.name + '：' + c.text).join('\n') : '还没有家人点评，来说第一句吧～'
    wx.showModal({
      title: '家人点评',
      content: lines,
      confirmText: '写点评',
      cancelText: '关闭',
      success(res) {
        if (res.confirm) that.askComment(id)
      }
    })
  },

  askComment(id) {
    const that = this
    wx.showModal({
      title: '写点评',
      content: '给这段录音一句鼓励或建议',
      editable: true,
      placeholderText: '发音很棒，继续加油！',
      success(res) {
        if (res.confirm && res.content && res.content.trim()) {
          family.addComment(id, res.content.trim())
          that.refresh()
          wx.showToast({ title: '已点评', icon: 'success' })
        }
      }
    })
  }
})
