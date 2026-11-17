const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const { getWords } = require('../../utils/words')

function ttsUrl(text, slow) {
  return 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=' + (slow ? 1 : 2)
}

Page({
  data: {
    mode: 'train',            // train=跟读练习 | focus=重点复练
    queue: [], index: 0, current: null,
    recording: false, hasRecording: false, playingMine: false,
    focusCount: 0, justRated: false, todayCount: 0
  },

  onShow() {
    const lang = storage.getCurrentLang()
    const focusWords = speaking.getFocusWords(lang)
    this.setData({
      mode: 'train', index: 0,
      queue: this.buildQueue(lang),
      focusCount: focusWords.length,
      todayCount: speaking.getToday().count
    }, () => this.loadCurrent())
  },

  onHide() { this.stopAll() },
  onUnload() { this.stopAll() },

  buildQueue(lang) {
    const all = getWords(lang)
    if (!all.length) return []
    // 今日优先练没练过的词，练过的排后面
    const records = speaking.getRecords()
    const fresh = all.filter(w => !records[w.id])
    const done = all.filter(w => records[w.id])
    return (fresh.length ? fresh : all).concat(fresh.length ? done : [])
  },

  loadCurrent() {
    const w = this.data.queue[this.data.index] || null
    this.stopAll()
    this.setData({ current: w, hasRecording: false, justRated: false })
  },

  // ---------- 音频 ----------
  _audio: null,
  _recManager: null,
  _play(url, cb) {
    this.stopAll()
    const audio = wx.createInnerAudioContext()
    this._audio = audio
    audio.src = url
    audio.onEnded(() => { this.setData({ playingMine: false }); if (cb) cb() })
    audio.onError(() => {
      this.setData({ playingMine: false })
      wx.showToast({ title: '发音需联网，请检查网络', icon: 'none' })
    })
    audio.play()
  },
  stopAll() {
    if (this._audio) { try { this._audio.stop(); this._audio.destroy() } catch (e) {} this._audio = null }
    if (this._recManager && this.data.recording) { try { this._recManager.stop() } catch (e) {} }
    if (this.data.recording) this.setData({ recording: false })
    if (this.data.playingMine) this.setData({ playingMine: false })
  },
  playStd() { if (this.data.current) this._play(ttsUrl(this.data.current.word, false)) },
  playSlow() { if (this.data.current) this._play(ttsUrl(this.data.current.word, true)) },
  playExample() { if (this.data.current) this._play(ttsUrl(this.data.current.example, false)) },
  playMine() {
    if (!this._recFilePath) return
    this._play(this._recFilePath)
    this.setData({ playingMine: true })
  },

  toggleRecord() {
    if (this.data.recording) { this.stopRecord(); return }
    const that = this
    if (!this._recManager) {
      this._recManager = wx.getRecorderManager()
      this._recManager.onStop(res => {
        that._recFilePath = res.tempFilePath
        that.setData({ hasRecording: true, recording: false })
        wx.showToast({ title: '录好了，点「听我的」对比', icon: 'none' })
      })
      this._recManager.onError(() => {
        that.setData({ recording: false })
        wx.showToast({ title: '录音失败，请检查麦克风权限', icon: 'none' })
      })
    }
    this.stopAll()
    this._recManager.start({ duration: 60000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1 })
    this.setData({ recording: true, hasRecording: false })
  },
  stopRecord() {
    if (this._recManager && this.data.recording) {
      this._recManager.stop()
      this.setData({ recording: false })
    }
  },

  // ---------- 自评 / 翻页 ----------
  rate(e) {
    const q = Number(e.currentTarget.dataset.q)
    if (!this.data.current || this.data.justRated) return
    speaking.record(this.data.current.id, q)
    const msg = ['已加入重点复练 💪', '不错，继续！', '很流利，赞！'][q] || '已记录'
    wx.showToast({ title: msg, icon: 'none' })
    this.setData({
      justRated: true,
      todayCount: speaking.getToday().count,
      focusCount: speaking.getFocusWords(storage.getCurrentLang()).length
    })
    setTimeout(() => this.next(), 700)
  },
  next() {
    const i = this.data.index + 1
    if (i < this.data.queue.length) {
      this.setData({ index: i }, () => this.loadCurrent())
    } else if (this.data.mode === 'focus') {
      this.setData({ mode: 'train', queue: this.buildQueue(storage.getCurrentLang()), index: 0 }, () => this.loadCurrent())
      wx.showToast({ title: '重点复练完成！', icon: 'success' })
    } else {
      wx.showToast({ title: '今日口语练习完成！', icon: 'success' })
      this.setData({ index: 0 }, () => this.loadCurrent())
    }
  },
  prev() {
    const i = this.data.index - 1
    if (i >= 0) this.setData({ index: i }, () => this.loadCurrent())
  },

  // ---------- 重点复练 ----------
  startFocus() {
    const lang = storage.getCurrentLang()
    const list = speaking.getFocusWords(lang)
    if (!list.length) {
      wx.showToast({ title: '还没有重点词，练习时点「再练练」加入', icon: 'none' })
      return
    }
    this.setData({ mode: 'focus', queue: list, index: 0 }, () => this.loadCurrent())
  },
  backToTrain() {
    this.setData({ mode: 'train', queue: this.buildQueue(storage.getCurrentLang()), index: 0 }, () => this.loadCurrent())
  }
})
