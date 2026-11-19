const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const sentences = require('../../utils/sentences')
const audio = require('../../utils/audio')
const speechScore = require('../../utils/speech-score')
const recordings = require('../../utils/recordings')
const karaoke = require('../../utils/karaoke')
const feedback = require('../../utils/feedback')
const theme = require('../../utils/theme')
const profile = require('../../utils/profile')
const nav = require('../../utils/nav')
const { getWords } = require('../../utils/words')

// 跟读模式：word=单词 | sentence=句子 | dialogue=情景对话 | custom=自建素材
Page({
  behaviors: [theme],
  data: {
    mode: 'train',            // train | focus
    track: 'sentence',        // word | sentence | dialogue | custom
    sceneIndex: 0, scenes: [], sceneNames: [],
    levelIndex: 0, levelNames: ['全部', 'A1', 'A2', 'B1', 'B2'],
    queueLen: 0, dots: [], index: 0, current: null,
    showDots: true, progressText: '0 / 0', progressPercent: 0,
    recording: false, hasRecording: false, playingMine: false,
    focusCount: 0, justRated: false, todayCount: 0,
    // 客观评分
    scoreSupported: false, scoring: false, score: null, recognized: '',
    scoreDetail: null, wrongWords: [],
    // 对话展示
    showLine: 0,
    // 逐词高亮（K歌字幕）
    karaokeOn: false, karaokeTokens: [],
    // A-B 复读
    abLoop: false, abCount: 0,
    // 角色扮演
    rolePlay: false, revealed: false, otherLine: null,
    // 新手引导
    showGuide: false,
    // 儿童模式星星奖励
    isKid: false, stars: 0, showStar: false
  },

  _queue: [],
  _audioPlayer: null,
  _recManager: null,
  _recognizer: null,
  _evaluator: null,
  _recFilePath: null,
  _savePromise: null,
  _lastScore: null,
  _lastRecognized: '',
  _lastWrong: [],
  _highlighter: null,
  _abPlaying: false,

  onLoad() {
    this.setData({ scoreSupported: speechScore.isSupported(storage.getCurrentLang()) })
    const s = storage.getSettings()
    if (!s.guideSeen) this.setData({ showGuide: true })
  },

  onShow() {
    this.syncTheme()
    this.setData({ scoreSupported: speechScore.isSupported(storage.getCurrentLang()) })
    const p = profile.currentProfile() || {}
    this.setData({ isKid: p.mode === 'kid', stars: storage.getStats().totalCorrect || 0 })
    const intent = nav.takeIntent('pages/speak/speak')
    this.setData({ sceneIndex: 0 })
    this.refreshScenes()
    if (intent && intent.focus) {
      this.startFocus()
    } else {
      this.buildQueueAndLoad()
    }
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
    this._queue = queue
    this.setData(Object.assign({
      queueLen: queue.length, index: 0, showLine: 0, mode: 'train', abCount: 0
    }, this._progress(0, queue.length)), () => this.loadCurrent())
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

  // 进度显示：条目少时用圆点，条目多（几十上百）时改用进度条，
  // 避免为每个条目都渲染一个 view 节点（220 词 = 220 个节点，明显拖慢渲染）
  _progress(index, total) {
    const n = total || 0
    const showDots = n > 0 && n <= 20
    const dots = []
    if (showDots) for (let i = 0; i < n; i++) dots.push(i)
    return {
      showDots, dots,
      progressText: n ? (Math.min(index + 1, n) + ' / ' + n) : '0 / 0',
      progressPercent: n ? Math.round((index + 1) / n * 100) : 0
    }
  },

  loadCurrent() {
    this.stopAll()
    const w = this._queue[this.data.index] || null
    this._recFilePath = null
    this._savePromise = null
    this._lastScore = null
    this._lastRecognized = ''
    this._abPlaying = false
    const tokens = w ? karaoke.tokenize(w.word) : []
    // 角色扮演：取上一条对方台词作为提示
    let otherLine = null
    if (this.data.rolePlay && this.data.track === 'dialogue') {
      const prev = this._queue[this.data.index - 1]
      otherLine = prev ? { role: prev.role, text: prev.word, cn: prev.meaning } : null
    }
    this.setData({
      current: w, hasRecording: false, justRated: false,
      score: null, recognized: '', playingMine: false, scoreDetail: null, wrongWords: [],
      showLine: 0, revealed: false, otherLine,
      karaokeOn: false, karaokeTokens: karaoke.toView(tokens, -1), abCount: 0
    }, () => {
      // 进度随当前索引更新
      this.setData(this._progress(this.data.index, this._queue.length))
    })
  },

  // ---------- 音频播放（带降级兜底 + 逐词高亮 + AB复读） ----------
  playText(text, slow) {
    this.stopAudio()
    const that = this
    const tokens = karaoke.tokenize(text)
    const duration = Math.max(2200, tokens.length * 480)
    this._audioPlayer = audio.speak(text, slow, {
      lang: storage.getCurrentLang() === 'ja' ? 'ja_JP' : 'en_US',
      onFallback(src) {
        const tip = src === 'wesisi-tts' ? '切换本地合成发音…'
          : (src === 'baidu' ? '换用备用发音…' : '切换发音源…')
        wx.showToast({ title: tip, icon: 'none' })
      },
      onError() {
        // 日语整句没有可用的免费合成源（有道只支持词、百度 403、同声传译只支持中英文），
        // 别说成「网络不好」，直接讲清楚能怎么办。
        const ja = audio.needJapaneseVoice(text)
        const long = ja && String(text).trim().length > 6
        wx.showToast({
          title: long ? '日语整句暂无合成发音，可点单词单独听' : '这句暂时读不出来，点一下再试',
          icon: 'none'
        })
        that.stopHighlight()
      },
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
    if (!this._recFilePath && !this._savePromise) return
    const that = this
    const start = () => {
      // wx.saveFile 会把临时文件「移走」，临时路径随即失效。
      // 必须等落盘完成、改用返回的 permanent 路径再播，否则一直是「回放失败」。
      if (!that._recFilePath) {
        wx.showToast({ title: '录音已失效，请重录', icon: 'none' })
        return
      }
      that.stopAudio()
      that._audioPlayer = audio.createPlayer({
        onEnded() { that.setData({ playingMine: false }) },
        onError() {
          that.setData({ playingMine: false, hasRecording: false })
          wx.showToast({ title: '回放失败，请重录一次', icon: 'none' })
        }
      })
      that._audioPlayer.play(that._recFilePath)
      that.setData({ playingMine: true })
    }
    // 刚录完就点「听我的」时，落盘还可能在途，等它完成
    if (this._savePromise) this._savePromise.then(start).catch(start)
    else start()
  },

  // ---------- 录音 ----------
  // 优先走智聆评测插件：它自己录音，并把「发音分 + 逐词错误 + 录音文件」一次给全。
  // 注意 wx.getRecorderManager() 是全局单例，插件内部也用它，两边同时开会互相覆盖回调，
  // 所以走插件时不再自己开录音器。
  _evalAvailable(cur) {
    if (!cur) return false
    // 按文本判断，不看用户设置的语言：切到日语但素材是英文时照样能评测
    return speechScore.canEvaluateText(cur.word)
  },

  // 存一条录音到「全家录音墙」，插件路径与自带录音器路径共用
  _saveRecording(filePath) {
    if (!filePath) return Promise.resolve(null)
    const that = this
    const cur = this.data.current
    const p = recordings.save(filePath, {
      itemId: cur ? cur.id : '',
      label: cur ? cur.word : '',
      cn: cur ? cur.meaning : '',
      kind: this.data.track,
      score: this._lastScore,
      recognized: this._lastRecognized
    }).then((entry) => {
      // 关键：落盘成功后临时文件已被移走，后续播放必须用 entry.filePath
      if (entry && entry.filePath) that._recFilePath = entry.filePath
      else wx.showToast({ title: '录音没能存下来（空间可能已满）', icon: 'none' })
      that._savePromise = null
      return entry
    })
    this._savePromise = p
    return p
  },

  toggleRecord() {
    if (this.data.recording) { this.stopRecord(); return }
    const that = this
    this.stopAudio()
    feedback.tap()
    this._lastScore = null
    this._lastRecognized = ''
    const cur = this.data.current
    const lang = storage.getCurrentLang()

    // 路径 A：智聆评测
    if (this._evalAvailable(cur)) {
      const ev = speechScore.createEvaluator({
        text: cur.word,
        lang: lang,
        onResult(res) {
          that._evaluator = null
          that._lastScore = res.score
          that._lastWrong = res.wrongWords || []
          if (res.filePath) {
            that._recFilePath = res.filePath
            that._saveRecording(res.filePath)
          }
          that.setData({
            recording: false,
            scoring: false,
            hasRecording: !!res.filePath,
            score: res.score,
            scoreDetail: { accuracy: res.accuracy, fluency: res.fluency, completion: res.completion },
            wrongWords: (res.wrongWords || []).slice(0, 6)
          })
          if (res.filePath) wx.showToast({ title: '录好了，点「听我的」对比', icon: 'none' })
        },
        onError() {
          that._evaluator = null
          that.setData({ recording: false, scoring: false })
          wx.showToast({ title: '评测失败，可以先自评', icon: 'none' })
        }
      })
      if (ev.supported) {
        this._evaluator = ev
        this.setData({ recording: true, hasRecording: false, scoring: true, score: null, scoreDetail: null, wrongWords: [] })
        ev.start()
        return
      }
    }

    // 路径 B：自带录音器（若同声传译可用，并行做文字识别算相似度）
    if (!this._recManager) {
      this._recManager = wx.getRecorderManager()
      this._recManager.onStop(res => {
        that._recFilePath = res.tempFilePath
        that.setData({ hasRecording: true, recording: false })
        that._saveRecording(res.tempFilePath)
        wx.showToast({ title: '录好了，点「听我的」对比', icon: 'none' })
      })
      this._recManager.onError(() => {
        that.setData({ recording: false })
        wx.showToast({ title: '录音失败，请检查麦克风权限', icon: 'none' })
      })
    }
    if (cur && speechScore.isSupported(lang)) {
      this._recognizer = speechScore.createRecognizer({
        targetText: cur.word,
        lang: lang === 'ja' ? 'ja_JP' : 'en_US',
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
    // 智聆路径：录音归插件管，stop 之后由它的 onStop 回调收尾
    if (this._evaluator) { this._evaluator.stop(); return }
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

    // 儿童模式：答好给星星动画奖励
    const addUpdate = {}
    if (this.data.isKid && q >= 1) {
      addUpdate.showStar = true
      addUpdate.stars = (this.data.stars || 0) + 1
      const that = this
      setTimeout(function () { that.setData({ showStar: false }) }, 1200)
    }
    this.setData(Object.assign({
      justRated: true,
      todayCount: speaking.getToday().count,
      focusCount: speaking.getFocusItems(this.allItems(storage.getCurrentLang())).length
    }, addUpdate))
    setTimeout(() => this.next(), 700)
  },

  next() {
    const i = this.data.index + 1
    if (i < this._queue.length) {
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
    this._queue = list
    this.setData(Object.assign({ mode: 'focus', queueLen: list.length, index: 0 }, this._progress(0, list.length)), () => this.loadCurrent())
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
    if (this._evaluator) { try { this._evaluator.stop() } catch (e) {} this._evaluator = null }
    if (this._recManager && this.data.recording) { try { this._recManager.stop() } catch (e) {} }
    if (this._recognizer) { try { this._recognizer.stop() } catch (e) {} this._recognizer = null }
    if (this.data.recording) this.setData({ recording: false })
    if (this.data.playingMine) this.setData({ playingMine: false })
  }
})
