// 离线发音包（分包页面）
//
// 这个页面放在 packageJa 分包里，不是为了给用户看，而是因为
// 小程序的分包必须至少有一个页面——日语音频 1.8MB 放不进 2MB 主包，
// 只能连同这个页面一起打成分包，用 wx.loadSubpackage 预载。
// 顺便它也真的有用：可以试听、能看到离线包有没有加载好。
const localAudio = require('../../../utils/local-audio')
const audio = require('../../../utils/audio')
const sentences = require('../../../utils/sentences')

Page({
  data: {
    ready: false,
    loading: false,
    jaCount: 0,
    enCount: 0,
    jaKb: 0,
    enKb: 0,
    samples: []
  },

  onLoad() {
    const st = localAudio.stats()
    this.setData({
      ready: localAudio.isReady('ja'),
      jaCount: st.ja.count,
      enCount: st.en.count,
      jaKb: Math.round(st.ja.bytes / 1024),
      enKb: Math.round(st.en.bytes / 1024),
      samples: sentences.getSentences('ja').slice(0, 5)
    })
    this.load()
  },

  // 分包加载：正常由 app.js 启动时预载，这里给个手动重试入口
  load() {
    if (localAudio.isReady('ja')) {
      this.setData({ ready: true })
      return
    }
    this.setData({ loading: true })
    const that = this
    localAudio.ensureLoaded('ja').then(function (ok) {
      that.setData({ loading: false, ready: ok })
      if (!ok) {
        wx.showToast({ title: '加载失败，可再试一次', icon: 'none' })
      }
    })
  },

  play(e) {
    const id = e.currentTarget.dataset.id
    if (!this._player) return
    if (this._player.destroy) this._player.destroy()
    this._player = audio.speak(e.currentTarget.dataset.text, false, {
      id: id,
      lang: 'ja_JP',
      onError() { wx.showToast({ title: '这条暂时读不出来', icon: 'none' }) }
    })
  },

  stop() {
    if (this._player && this._player.destroy) this._player.destroy()
    this._player = null
  },

  onHide() { this.stop() },
  onUnload() { this.stop() }
})
