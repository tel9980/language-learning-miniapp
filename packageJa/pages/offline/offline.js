// 离线发音包（分包页面）
//
// 分包必须至少有一个页面，所以日语/英语各带一个离线页：日语在 packageJa，英语在 packageEn。
// 小程序不允许一个页面被两个分包共用，只能各放一份，逻辑保持同步（改这里记得改另一份）。
//
// 顺带它也真的有用：可以试听、能看到离线包有没有加载好。
const localAudio = require('../../../utils/local-audio')
const audio = require('../../../utils/audio')
const sentences = require('../../../utils/sentences')

const LANG = 'ja'          // 本页所在分包对应的语种
const VOICE = 'ja_JP'

Page({
  data: {
    ready: false,
    readyJa: false,
    readyEn: false,
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
      ready: localAudio.isReady(LANG),
      readyJa: localAudio.isReady('ja'),
      readyEn: localAudio.isReady('en'),
      jaCount: st.ja.count,
      enCount: st.en.count,
      jaKb: Math.round(st.ja.bytes / 1024),
      enKb: Math.round(st.en.bytes / 1024),
      samples: sentences.getSentences(LANG).slice(0, 5)
    })
    this.load()
  },

  // 分包加载：正常进页面时已由 onShow/启动预载，这里给个手动重试入口
  load() {
    if (localAudio.isReady(LANG)) {
      this.setData({ ready: true, readyJa: localAudio.isReady('ja'), readyEn: localAudio.isReady('en') })
      return
    }
    this.setData({ loading: true })
    const that = this
    localAudio.ensureLoaded(LANG).then(function (ok) {
      that.setData({
        loading: false,
        ready: ok,
        readyJa: localAudio.isReady('ja'),
        readyEn: localAudio.isReady('en')
      })
      if (!ok) wx.showToast({ title: '加载失败，可再试一次', icon: 'none' })
    })
  },

  play(e) {
    const id = e.currentTarget.dataset.id
    if (this._player && this._player.destroy) this._player.destroy()
    this._player = audio.speak(e.currentTarget.dataset.text, false, {
      id: id,
      lang: VOICE,
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
