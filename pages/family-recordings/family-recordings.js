const theme = require('../../utils/theme')
const family = require('../../utils/family')
const audioCtx = require('../../utils/audio-ctx')
const prompt = require('../../utils/prompt')

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
    this._player = audioCtx.create()
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
    prompt.askText({
      title: '写点评',
      content: '给这段录音一句鼓励或建议',
      value: '',
      maxLen: 40,
      done(text) {
        family.addComment(id, text)
        that.refresh()
        wx.showToast({ title: '已点评', icon: 'success' })
      }
    })
  }
})
