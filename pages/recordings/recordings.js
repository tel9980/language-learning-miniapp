const theme = require('../../utils/theme')
const recordings = require('../../utils/recordings')

Page({
  behaviors: [theme],
  data: { list: [], playingId: '' },
  _player: null,

  onShow() {
    this.syncTheme(); this.refresh() },
  onHide() { this.stopPlay() },
  onUnload() { this.stopPlay() },

  refresh() {
    const list = recordings.list().map(r => Object.assign({}, r, {
      timeText: this.formatTime(r.createdAt)
    }))
    this.setData({ list })
  },

  formatTime(ts) {
    const d = new Date(ts)
    const p = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
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
    this._player.onError(() => { wx.showToast({ title: '这条录音可能已过期，请重录', icon: 'none' }); that.setData({ playingId: '' }) })
    this._player.play()
    this.setData({ playingId: id })
  },

  stopPlay() {
    if (this._player) { try { this._player.stop(); this._player.destroy() } catch (e) {} this._player = null }
    this.setData({ playingId: '' })
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    const that = this
    wx.showModal({
      title: '删除录音', content: '确定删除这条录音吗？',
      success(res) {
        if (res.confirm) { recordings.remove(id); that.refresh(); wx.showToast({ title: '已删除', icon: 'success' }) }
      }
    })
  },

  clearAll() {
    const that = this
    wx.showModal({
      title: '清空录音', content: '确定清空全部录音吗？此操作不可恢复。',
      success(res) {
        if (res.confirm) { recordings.clear(); that.refresh(); wx.showToast({ title: '已清空', icon: 'success' }) }
      }
    })
  }
})
