const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const sentences = require('../../utils/sentences')
const audio = require('../../utils/audio')
const speechScore = require('../../utils/speech-score')
const recordings = require('../../utils/recordings')
const karaoke = require('../../utils/karaoke')
const feedback = require('../../utils/feedback')
const theme = require('../../utils/theme')
const { getWords } = require('../../utils/words')

// 跟读模式：word=单词 | sentence=句子 | dialogue=情景对话 | custom=自建素材
Page({
  behaviors: [theme],
  data: {
    mode: 'train',            // train | focus
    track: 'sentence',        // word | sentence | dialogue | custom
    sceneIndex: 0, scenes: [], sceneNames: [],
    levelIndex: 0, levelNames: ['全部', 'A1', 'A2', 'B1', 'B2'],
    queue: [], index: 0, current: null,
    recording: false, hasRecording: false, playingMine: false,
    focusCount: 0, justRated: false, todayCount: 0,
    // 客观评分
    scoreSupported: false, scoring: false, score: null, recognized: '',
    // 对话展示
    showLine: 0,
    // 逐词高亮（K歌字幕）
    karaokeOn: false, karaokeTokens: [],
    // A-B 复读
    abLoop: false, abCount: 0,
    // 角色扮演
    rolePlay: false, revealed: false, otherLine: null,
    // 新手引导
    showGuide: false
  },

  _audioPlayer: null,
  _recManager: null,
  _recognizer: null,
  _recFilePath: null,
  _lastScore: null,
  _lastRecognized: '',
  _highlighter: null,
  _abPlaying: false,

  onLoad() {
    this.setData({ scoreSupported: speechScore.isSupported() })
    const s = storage.getSettings()
    if (!s.guideSeen) this.setData({ showGuide: true })
  },

  onShow() {
    this.syncTheme()
    this.setData({ sceneIndex: 0 })
    this.refreshScenes()
    this.buildQueueAndLoad()
  },

  onHide() { this.stopAll() },
  onUnload() { this.stopAll() },

  closeGuide() {
    this.setData({ showGuide: false })
    storage.setGuideSeen(true)
  },

  // ---------- 场景 / 等级 ----------
  refreshScenes() {
    const lang = storage.getCurrentLang()
    let scenes = []
    if (this.data.track === 'dialogue') {
      const level = this.data.levelNames[this.data.levelIndex]
      const list = level === '全部' ? sentences.getDialogues(lang) : sentences.getDialogues(lang, level)
      scenes = list.map((d, i) => ({ name: d.scene, index: i }))
    }
    this.setData({
      scenes: scenes,
      sceneNames: scenes.map(s => s.name),
      focusCount: speaking.getFocusItems(this.allItems(lang)).length,
      todayCount: speaking.getToday().count
    })
  },

  switchLevel(e) {
    const idx = Number(e.detail.value)
    this.stopAll()
    this.setData({ levelIndex: idx, sceneIndex: 0 }, () => {
      this.refreshScenes()
      this.buildQueueAndLoad()
    })
  },

  // 汇总某语种下全部可跟读条目（词 + 句 + 对话台词 + 自建）
  allItems(lang) {
    const custom = storage.getCustomItems(lang).map(x => Object.assign({}, x, { kind: 'sentence' }))
    return getWords(lang).concat(sentences.getAllItems(lang)).concat(custom)
  },

  buildQueueAndLoad() {
    const lang = storage.getCurrentLang()
    const level = this.data.levelNames[this.data.levelIndex]
    let pool = []
    if (this.data.track === 'word') {
      pool = getWords(lang).map(w => Object.assign({}, w, { kind: 'word' }))
    } else if (this.data.track === 'sentence') {
      pool = sentences.getSentences(lang, level === '全部' ? null : level).map(s => sentences.toItem(s, 'st'))
    } else if (this.data.track === 'custom') {
      pool = storage.getCustomItems(lang).map(x => Object.assign({}, x, { kind: 'sentence' }))
    } else {
      const list = level === '全部' ? sentences.getDialogues(lang) : sentences.getDialogues(lang, level)
      const dlg = list[this.data.sceneIndex]
      pool = dlg ? dlg.lines.map(l => sentences.toItem(Object.assign({ scene: dlg.scene, level: dlg.level }, l), 'dl')) : []
    }
    const records = speaking.getRecords()
    const fresh = pool.filter(w => !records[w.id])
    const done = pool.filter(w => records[w.id])
    const queue = fresh.concat(done)
    this.setData({ queue, index: 0, showLine: 0, mode: 'train', abCount: 0 }, () => this.loadCurrent())
  },

  switchTrack(e) {
    const track = e.currentTarget.dataset.track
    this.stopAll()
    this.setData({ track, sceneIndex: 0, rolePlay: false, revealed: false }, () => {
      this.refreshScenes()
      this.buildQueueAndLoad()
    })
  },
  switchScene(e) {
    const idx = Number(e.detail.value)
    this.stopAll()
    this.setData({ sceneIndex: idx, revealed: false }, () => this.buildQueueAndLoad())
  },

  loadCurrent() {
    this.stopAll()
    const w = this.data.queue[this.data.index] || null
    this._recFilePath = null
    this._lastScore = null
    this._lastRecognized = ''
    this._abPlaying = false
    const tokens = w ? karaoke.tokenize(w.word) : []
    // 角色扮演：取上一条对方台词作为提示
    let otherLine = null
    if (this.data.rolePlay && this.data.track === 'dialogue') {
      const prev = this.data.queue[this.data.index - 1]
      otherLine = prev ? { role: prev.role, text: prev.word, cn: prev.meaning } : null
    }
    this.setData({
      current: w, hasRecording: false, justRated: false,
      score: null, recognized: '', playingMine: false,
      showLine: 0, revealed: false, otherLine,
      karaokeOn: false, karaokeTokens: karaoke.toView(tokens, -1), abCount: 0
    })
  },

  // ---------- 音频播放（带降级兜底 + 逐词高亮 + AB复读） ----------
  playText(text, slow) {
    this.stopAudio()
    const that = this
    const tokens = karaoke.tokenize(text)
    const duration = Math.max(2200, tokens.length * 480)
    this._audioPlayer = audio.speak(text, slow, {
      onFallback() { wx.showToast({ title: '切换备用发音源…', icon: 'none' }) },
      onError() { wx.showToast({ title: '发音需联网，请检查网络', icon: 'none' }); that.stopHighlight() },
      onEnded() {
        that.stopHighlight()
        if (that._abPlaying && that.data.abLoop) {
          that._abPlaying = false
          that.setData({ abCount: that.data.abCount + 1 })
          setTimeout(function () { if (that.data.abLoop) that.playText(text, slow) }, 400)
        }
      }
    })
    // 逐词高亮
    if (this._highlighter) this._highlighter.destroy()
    this._highlighter = karaoke.createHighlighter({
      tokens: tokens,
      durationMs: duration,
      onWord(idx) { that.setData({ karaokeOn: idx >= 0, karaokeTokens: karaoke.toView(tokens, idx) }) },
      onDone() { that.setData({ karaokeOn: false }) }
    })
    this._highlighter.start()
  },
  stopHighlight() {
    if (this._highlighter) { this._highlighter.destroy(); this._highlighter = null }
    this.setData({ karaokeOn: false })
  },
  stopAudio() {
    this.stopHighlight()
    this._abPlaying = false
    if (this._audioPlayer) { try { this._audioPlayer.destroy() } catch (e) {} this._audioPlayer = null }
  },
  playStd() { if (this.data.current) { this._abPlaying = false; this.playText(this.data.current.word, false) } },
  playSlow() { if (this.data.current) { this._abPlaying = false; this.playText(this.data.current.word, true) } },
  playExample() { if (this.data.current) { this._abPlaying = false; this.playText(this.data.current.example, false) } },

  // A-B 复读：循环朗读当前这一条
  toggleAB() {
    const on = !this.data.abLoop
    this.setData({ abLoop: on, abCount: 0 })
    feedback.tap()
    if (on && this.data.current) {
      this._abPlaying = false
      this.playText(this.data.current.word, true)
      wx.showToast({ title: 'A-B 复读已开启：慢速循环这一句', icon: 'none' })
    } else {
      this.stopAudio()
      wx.showToast({ title: '已关闭复读', icon: 'none' })
    }
  },

  // 角色扮演：隐藏/显示自己的台词
  toggleRolePlay() {
    const on = !this.data.rolePlay
    this.stopAll()
    this.setData({ rolePlay: on, revealed: false }, () => this.loadCurrent())
    wx.showToast({ title: on ? '角色扮演：看对方台词，自己接话' : '已退出角色扮演', icon: 'none' })
  },
  revealLine() { this.setData({ revealed: true }) },
  playOtherLine() {
    if (this.data.otherLine) this.playText(this.data.otherLine.text, false)
  },

  playMine() {
    if (!this._recFilePath) return
    this.stopAudio()
    const that = this
    this._audioPlayer = audio.createPlayer({
      onEnded() { that.setData({ playingMine: false }) },
      onError() { that.setData({ playingMine: false }); wx.showToast({ title: '回放失败', icon: 'none' }) }
    })
    this._audioPlayer.play(this._recFilePath)
    this.setData({ playingMine: true })
  },

  // ---------- 录音（并行启动客观识别） ----------
  toggleRecord() {
    if (this.data.recording) { this.stopRecord(); return }
    const that = this
    if (!this._recManager) {
      this._recManager = wx.getRecorderManager()
      this._recManager.onStop(res => {
        that._recFilePath = res.tempFilePath
        that.setData({ hasRecording: true, recording: false })
        const cur = that.data.current
        recordings.save(res.tempFilePath, {
          itemId: cur ? cur.id : '',
          label: cur ? cur.word : '',
          cn: cur ? cur.meaning : '',
          kind: that.data.track,
          score: that._lastScore,
          recognized: that._lastRecognized
        })
        wx.showToast({ title: '录好了，点「听我的」对比', icon: 'none' })
      })
      this._recManager.onError(() => {
        that.setData({ recording: false })
        wx.showToast({ title: '录音失败，请检查麦克风权限', icon: 'none' })
      })
    }
    this.stopAudio()
    feedback.tap()
    this._lastScore = null
    this._lastRecognized = ''
    const cur = this.data.current
    if (this.data.scoreSupported && cur) {
      this._recognizer = speechScore.createRecognizer({
        targetText: cur.word,
        lang: storage.getCurrentLang() === 'ja' ? 'ja_JP' : 'en_US',
        onResult(res) {
          that._lastScore = res.score
          that._lastRecognized = res.recognized
          that.setData({ scoring: false, score: res.score, recognized: res.recognized })
        },
        onError() { that.setData({ scoring: false }) }
      })
      if (this._recognizer.supported) {
        this._recognizer.start()
        this.setData({ scoring: true, score: null, recognized: '' })
      }
    }
    try {
      this._recManager.start({ duration: 60000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1 })
      this.setData({ recording: true, hasRecording: false })
    } catch (e) {
      wx.showToast({ title: '录音启动失败', icon: 'none' })
    }
  },

  stopRecord() {
    if (this._recManager && this.data.recording) {
      try { this._recManager.stop() } catch (e) {}
      this.setData({ recording: false })
    }
    if (this._recognizer) { this._recognizer.stop() }
  },

  // ---------- 自评 / 翻页 ----------
  rate(e) {
    const q = Number(e.currentTarget.dataset.q)
    if (!this.data.current || this.data.justRated) return
    const cur = this.data.current
    speaking.record(cur.id, q, this._lastScore)
    const schedQ = q === 0 ? 0 : (q === 1 ? 3 : 5)
    storage.review(cur.id, schedQ)
    if (q === 0) feedback.warn(); else feedback.success()

    const msg = ['已加入重点复练 💪', '不错，继续！', '很流利，赞！'][q] || '已记录'
    wx.showToast({ title: msg, icon: 'none' })
    this.setData({
      justRated: true,
      todayCount: speaking.getToday().count,
      focusCount: speaking.getFocusItems(this.allItems(storage.getCurrentLang())).length
    })
    setTimeout(() => this.next(), 700)
  },

  next() {
    const i = this.data.index + 1
    if (i < this.data.queue.length) {
      this.setData({ index: i }, () => this.loadCurrent())
    } else if (this.data.mode === 'focus') {
      this.setData({ mode: 'train', sceneIndex: this.data.sceneIndex }, () => {
        this.refreshScenes(); this.buildQueueAndLoad()
      })
      wx.showToast({ title: '重点复练完成！', icon: 'success' })
    } else {
      wx.showToast({ title: '本组跟读完成！', icon: 'success' })
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
    const list = speaking.getFocusItems(this.allItems(lang))
    if (!list.length) {
      wx.showToast({ title: '还没有重点条目，练习时点「再练练」加入', icon: 'none' })
      return
    }
    this.stopAll()
    this.setData({ mode: 'focus', queue: list, index: 0 }, () => this.loadCurrent())
  },
  backToTrain() {
    this.stopAll()
    this.setData({ mode: 'train' }, () => this.buildQueueAndLoad())
  },

  goRecordings() { wx.navigateTo({ url: '/pages/recordings/recordings' }) },
  goImport() { wx.navigateTo({ url: '/pages/import/import' }) },

  // ---------- 清理 ----------
  stopAll() {
    this.stopAudio()
    if (this._recManager && this.data.recording) { try { this._recManager.stop() } catch (e) {} }
    if (this._recognizer) { try { this._recognizer.stop() } catch (e) {} this._recognizer = null }
    if (this.data.recording) this.setData({ recording: false })
    if (this.data.playingMine) this.setData({ playingMine: false })
  }
})
