const theme = require('../../utils/theme')
const recordings = require('../../utils/recordings')
const audioCtx = require('../../utils/audio-ctx')

Page({
  behaviors: [theme],
  data: { list: [], playingId: '', groups: [], compareId: '' },
  _player: null,

  onShow() {
    this.syncTheme(); this.refresh() },
  onHide() { this.stopPlay() },
  onUnload() { this.stopPlay() },

  refresh() {
    const list = recordings.list().map(r => Object.assign({}, r, {
      timeText: this.formatTime(r.createdAt),
      sec: r.ms ? Math.round(r.ms / 100) / 10 : 0
    }))
    this.setData({ list, groups: this.buildGroups(list) })
  },

  // 「同一句练了 N 次」：按 itemId 归组，取最早与最新两条，给分数差与时长。
  // 数据本来就存着（_saveRecording 记 itemId / score / ms），以前只是没拿来用——
  // 练了十遍看不到进步，跟不需要反馈的练习没区别。
  buildGroups(list) {
    const map = {}
    list.forEach(function (r) {
      if (!r.itemId) return
      if (!map[r.itemId]) map[r.itemId] = { itemId: r.itemId, label: r.label, cn: r.cn, items: [] }
      map[r.itemId].items.push(r)
    })
    const out = []
    const that = this
    Object.keys(map).forEach(function (k) {
      const g = map[k]
      if (g.items.length < 2) return
      const last = g.items[0]                  // list 是新到旧
      const first = g.items[g.items.length - 1]
      const bothScored = first.score > 0 && last.score > 0
      const delta = bothScored ? last.score - first.score : 0
      out.push({
        itemId: k, label: g.label, cn: g.cn, count: g.items.length,
        firstId: first.id, lastId: last.id,
        firstTime: that.formatTime(first.createdAt), lastTime: that.formatTime(last.createdAt),
        firstSec: first.sec, lastSec: last.sec,
        firstScore: first.score || 0, lastScore: last.score || 0,
        bothScored: bothScored,
        deltaText: bothScored ? (delta > 0 ? '+' + delta : String(delta)) : '',
        up: delta > 0
      })
    })
    out.sort((a, b) => b.count - a.count)
    return out.slice(0, 10)
  },

  // 先播最早那条、再播最新那条：同一句话自己前后对比，比看数字直观
  compareGroup(e) {
    const itemId = e.currentTarget.dataset.item
    const g = this.data.groups.find(x => x.itemId === itemId)
    if (!g) return
    const first = this.data.list.find(x => x.id === g.firstId)
    const last = this.data.list.find(x => x.id === g.lastId)
    if (!first || !last) return
    this.stopPlay()
    const that = this
    const ctx = audioCtx.create()
    this._player = ctx
    let stage = 0
    ctx.onEnded(function () {
      stage += 1
      if (stage === 1) {
        try { ctx.src = last.filePath; ctx.play() } catch (err) { that.failPlay() }
        return
      }
      that.setData({ compareId: '' })
    })
    ctx.onError(function () { that.failPlay() })
    ctx.src = first.filePath
    ctx.play()
    this.setData({ compareId: itemId })
    wx.showToast({ title: '先播最早，再播最新', icon: 'none' })
  },

  failPlay() {
    this.stopPlay()
    wx.showToast({ title: '这条录音可能已过期，请重录', icon: 'none' })
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
    this._player = audioCtx.create()
    this._player.src = item.filePath
    this._player.onEnded(() => that.setData({ playingId: '' }))
    this._player.onError(() => { wx.showToast({ title: '这条录音可能已过期，请重录', icon: 'none' }); that.setData({ playingId: '' }) })
    this._player.play()
    this.setData({ playingId: id })
  },

  stopPlay() {
    if (this._player) { try { this._player.stop(); this._player.destroy() } catch (e) {} this._player = null }
    this.setData({ playingId: '', compareId: '' })
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
