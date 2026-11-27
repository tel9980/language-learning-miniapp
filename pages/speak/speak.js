const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const sentences = require('../../utils/sentences')
const audio = require('../../utils/audio')
const aiEval = require('../../utils/ai-eval')
const localAudio = require('../../utils/local-audio')
const speechScore = require('../../utils/speech-score')
const practiceTimer = require('../../utils/practice-timer')
const recordings = require('../../utils/recordings')
const karaoke = require('../../utils/karaoke')
const feedback = require('../../utils/feedback')
const theme = require('../../utils/theme')
const profile = require('../../utils/profile')
const nav = require('../../utils/nav')
const { getLangMeta, langOfId } = require('../../utils/lang')
const sentenceProgress = require('../../utils/sentence-progress')
const session = require('../../utils/speak-session')
const shadowTip = require('../../utils/shadow-tip')
const mic = require('../../utils/mic')
const translate = require('../../utils/translate')

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
    comparing: false, shadowTip: '',
    aiLoading: false, aiFeedback: null,
    focusCount: 0, justRated: false, todayCount: 0,
    // 客观评分
    scoreSupported: false, scoring: false, score: null, recognized: '',
    scoreDetail: null, wrongWords: [],
    // 对话展示
    showLine: 0,
    // 逐词高亮（K歌字幕）
    karaokeOn: false, karaokeTokens: [], karaokeIdx: -1,
    audioLoading: false,      // 网络发音下载中（弱网时给用户一个「在等」的信号）
    // A-B 复读
    abLoop: false, abCount: 0,
    // 角色扮演
    rolePlay: false, revealed: false, otherLine: null,
    // 对练（只在情景对话里）：我说中文 → 给我目标语言的说法
    trainMode: false, trainRecording: false, trainBusy: false, trainResult: null, trainErr: '',
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

  onLoad(options) {
    this.setData({ scoreSupported: speechScore.isSupported(storage.getCurrentLang()) })
    const s = storage.getSettings()
    if (!s.guideSeen) this.setData({ showGuide: true })
    // 别人从转发卡片点进来时带 ?item=xxx：进来直接练这一条（onShow 里消费）
    this._pendingItem = (options && options.item) || ''
  },

  // 转发给朋友：带上当前这一条，对方点开就练同一句
  //（朋友圈不做——单页模式拿不到本机进度，看到的会是空数据）
  onShareAppMessage() {
    const cur = this.data.current
    const id = cur && cur.id ? String(cur.id) : ''
    let label = (cur && (cur.word || cur.meaning)) || ''
    if (label.length > 16) label = label.slice(0, 16)
    return {
      title: label ? '我在练这句：' + label : '一起练口语，读错了有人告诉你',
      path: '/pages/speak/speak' + (id ? '?item=' + encodeURIComponent(id) : '')
    }
  },

  onShow() {
    this.syncTheme()
    // 离线音频优先流播 CDN（见 utils/audio.js），不预载分包——
    // 预载要拉 1–3MB，而真机上读分包文件还可能失败，不如按需。
    const p = profile.currentProfile() || {}
    const kid = p.mode === 'kid'
    // 儿童模式默认零上传：不开智聆（录音发腾讯云）、不出现 AI 听音与对练（发境外 AI）。
    // aiAllowed 只在家长做过监护人确认并单独解锁后为 true。
    this.setData({
      isKid: kid,
      aiAllowed: !kid || storage.getKidAiUnlocked(),
      scoreSupported: !kid && speechScore.isSupported(storage.getCurrentLang()),
      stars: storage.getStats().totalCorrect || 0
    })
    practiceTimer.start(kid)
    const intent = nav.takeIntent('pages/speak/speak')
    // 从搜索页点「去跟读这句」、或从转发卡片带 ?item= 进来：只练这一条，练完回正常队列
    const oneId = (intent && intent.item) || this._pendingItem
    if (oneId) {
      this._pendingItem = ''
      this.refreshScenes()
      this.startOne(oneId)
      return
    }
    if (intent && intent.focus) {
      this.refreshScenes()
      this.startFocus()
      return
    }
    if (intent && intent.due) {
      this.refreshScenes()
      this.startDue()
      return
    }
    // 同一组队列（语种/等级/场景/模式都没变）就接着上次的位置练：
    // 以前 onShow 一律重建队列并把 index 归零、场景也重置，做到第 87 条
    // 切去查词页再回来就从头开始，等于白练。
    const same = this._queue.length && this._queueSig === this._sig() && this._memoIndex > 0
    this.refreshScenes()
    if (same) {
      const i = Math.min(this._memoIndex, this._queue.length - 1)
      this.setData({ index: i }, () => this.loadCurrent())
      return
    }
    this.buildQueueAndLoad()
  },

  // 队列指纹：决定「要不要重建队列」。变了才重建，没变就沿用。
  _sig() {
    return session.signature(this.data)
  },

  // 评分/录音记录是延迟落盘的，离开页面前必须冲一次
  onHide() { practiceTimer.stop(); this.stopAll(); storage.flushAll() },
  onUnload() { practiceTimer.stop(); this.stopAll(); storage.flushAll() },

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
    // 场景数可能因切语种/等级而变少，下标要夹紧，否则取到 undefined
    const si = Math.min(this.data.sceneIndex, Math.max(0, scenes.length - 1))
    this.setData({
      scenes: scenes,
      sceneNames: scenes.map(s => s.name),
      sceneIndex: si,
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

  // 汇总某语种下全部可跟读条目（词 + 句 + 对话台词 + 自建），实现见 utils/speak-session.js
  allItems(lang) {
    return session.allItems(lang)
  },

  buildQueueAndLoad() {
    const queue = session.buildQueue({
      lang: storage.getCurrentLang(),
      track: this.data.track,
      levelName: this.data.levelNames[this.data.levelIndex],
      sceneIndex: this.data.sceneIndex
    })
    this._queue = queue
    this._memoIndex = 0
    this._queueSig = session.signature({ track: this.data.track, levelIndex: this.data.levelIndex,
      sceneIndex: this.data.sceneIndex, mode: 'train' })
    this.setData(Object.assign({
      queueLen: queue.length, index: 0, showLine: 0, mode: 'train', abCount: 0
    }, this._progress(0, queue.length)), () => this.loadCurrent())
  },

  switchTrack(e) {
    const track = e.currentTarget.dataset.track
    this.stopAll()
    this.setData({ track, sceneIndex: 0, rolePlay: false, revealed: false, trainMode: false, trainResult: null }, () => {
      this.refreshScenes()
      this.buildQueueAndLoad()
    })
  },
  switchScene(e) {
    const idx = Number(e.detail.value)
    this.stopAll()
    this.setData({ sceneIndex: idx, revealed: false, trainResult: null }, () => this.buildQueueAndLoad())
  },

  // 进度显示：条目少时用圆点，条目多（几十上百）时改用进度条，
  // 避免为每个条目都渲染一个 view 节点（220 词 = 220 个节点，明显拖慢渲染）
  _progress(index, total) {
    return session.progress(index, total)
  },

  loadCurrent() {
    this.stopAll()
    const w = this._queue[this.data.index] || null
    this._recFilePath = null
    this._savePromise = null
    this._lastScore = null
    this._lastRecognized = ''
    this._abPlaying = false
    this._trainRec = false
    const tokens = w ? karaoke.tokenize(w.word) : []
    // 角色扮演：取上一条对方台词作为提示
    let otherLine = null
    if (this.data.rolePlay && this.data.track === 'dialogue') {
      const prev = this._queue[this.data.index - 1]
      otherLine = prev ? { role: prev.role, text: prev.word, cn: prev.meaning, id: prev.id } : null
    }
    this._memoIndex = this.data.index
    // 一次 setData 搞定：以前是 setData({...}, () => setData(progress))，
    // 同一个动作要渲染两轮，进度条会先显示上一张的数字再跳。
    this.setData(Object.assign({
      current: w, hasRecording: false, justRated: false,
      score: null, recognized: '', playingMine: false, scoreDetail: null, wrongWords: [],
      comparing: false, shadowTip: '',
      aiLoading: false, aiFeedback: null,
      trainRecording: false, trainBusy: false, trainResult: null, trainErr: '',
      showLine: 0, revealed: false, otherLine,
      karaokeOn: false, karaokeIdx: -1, karaokeTokens: karaoke.toPlain(tokens), abCount: 0
    }, this._progress(this.data.index, this._queue.length)))
    // 预取下一条的预生成音频：点「下一句」时文件已经在本地，切换是瞬时的
    const next = this._queue[this.data.index + 1]
    if (next) audio.prefetch(next.id)
  },

  // ---------- 音频播放（带降级兜底 + 逐词高亮 + AB复读） ----------
  playText(text, slow, id) {
    // 兜底：空文本不要去合成（历史上自建素材缺 word 字段时会把字面量 "undefined" 送去有道）
    if (!text || !String(text).trim()) return
    this.stopAudio()
    const that = this
    const tokens = karaoke.tokenize(text)
    // 日语一句的字符数远少于英语词数，用同一套估算会明显偏长；
    // 这里只是「音频还没报时长」之前的第一版估算，真实时长一到就用 retime 覆盖。
    const duration = karaoke.isJapaneseish(text)
      ? Math.max(1200, String(text).replace(/\s/g, '').length * 190)
      : Math.max(2200, tokens.length * 480)
    // 高亮控制器先建好（不启动），等音频真正出声再 start。
    // 原来点下去就 start，网络源第一次要点下载，字幕会自己先跑完、声音后到，
    // 弱网下（甚至等到 8 秒看门狗）尤其明显。
    if (this._highlighter) this._highlighter.destroy()
    this._highlighter = karaoke.createHighlighter({
      tokens: tokens,
      durationMs: duration,
      // 只传下标：整句 token 数组不再每个词都重发一遍（长句 447B → 16B），
      // 渲染层也只需改一个 class，不用 diff 全部 text 节点
      onWord(idx) { that.setData({ karaokeOn: idx >= 0, karaokeIdx: idx }) },
      onDone() { that.setData({ karaokeOn: false }) }
    })
    this._audioPlayer = audio.speak(text, slow, {
      id: id,
      lang: getLangMeta(storage.getCurrentLang()).voice,
      // 真正开始出声的那一刻，才是字幕应该起跑的时刻
      onPlay() { if (that._highlighter) that._highlighter.start() },
      // 弱网下下载可能要好几百毫秒甚至触发 8 秒看门狗，页面得让用户看到「在等」
      onLoading(on) { that.setData({ audioLoading: on }) },
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
        // 越南语没有任何在线合成源，只有内置素材的预生成音频
        const vi = audio.isVietnameseText(text)
        // 韩语整句也没有在线源（有道 500、百度失败），单词才有
        const ko = audio.isKoreanText(text)
        wx.showToast({
          title: vi ? '越南语只支持内置素材的发音，这句读不出来'
            : (ko && String(text).trim().split(/\s+/).length > 2
              ? '韩语整句暂无合成发音，可点单词单独听'
              : (long ? '日语整句暂无合成发音，可点单词单独听' : '这句暂时读不出来，点一下再试')),
          icon: 'none'
        })
        that.stopHighlight()
      },
      onDuration(ms) {
        // 拿到真实音频时长后重排高亮时间表（估算 → 实测）
        if (ms > 0) that._stdDuration = ms    // 影子跟读拿它跟我的录音比长短
        if (that._highlighter && ms > 0) that._highlighter.retime(ms)
      },
      onEnded() {
        that.stopHighlight()
        if (that._abPlaying && that.data.abLoop) {
          that._abPlaying = false
          that.setData({ abCount: that.data.abCount + 1 })
          setTimeout(function () { if (that.data.abLoop) that.playText(text, slow, id) }, 400)
        }
      }
    })
  },
  stopHighlight() {
    if (this._highlighter) { this._highlighter.destroy(); this._highlighter = null }
    this.setData({ karaokeOn: false })
  },
  stopAudio() {
    this.stopHighlight()
    this._abPlaying = false
    // 只在真的在加载时才 setData，避免每次切词都白渲染一轮
    if (this.data.audioLoading) this.setData({ audioLoading: false })
    if (this._audioPlayer) { try { this._audioPlayer.destroy() } catch (e) {} this._audioPlayer = null }
    if (this._compareCtx) { try { this._compareCtx.destroy() } catch (e) {} this._compareCtx = null }
  },
  playStd() { if (this.data.current) { this._abPlaying = false; this.playText(this.data.current.word, false, this.data.current.id) } },
  playSlow() { if (this.data.current) { this._abPlaying = false; this.playText(this.data.current.word, true, this.data.current.id) } },
  playExample() { if (this.data.current) { this._abPlaying = false; this.playText(this.data.current.example, false, this.data.current.id ? this.data.current.id + '_ex' : '') } },

  // A-B 复读：循环朗读当前这一条
  toggleAB() {
    const on = !this.data.abLoop
    this.setData({ abLoop: on, abCount: 0 })
    feedback.tap()
    if (on && this.data.current) {
      this._abPlaying = false
      this.playText(this.data.current.word, true, this.data.current.id)
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
    if (this.data.otherLine) this.playText(this.data.otherLine.text, false, this.data.otherLine.id)
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

  // 影子跟读：标准音 → 我的录音 → 标准音，串成一遍。
  // 日语和越南语没有客观评分（智聆只支持中英文），音色只能靠耳朵；
  // 但「你说了多久 vs 标准音多长」是能算的，读太快、读太慢会被直接点出来。
  comparePlay() {
    const cur = this.data.current
    if (!cur) return
    if (!this._recFilePath && !this._savePromise) {
      wx.showToast({ title: '先按下面的按钮录一遍', icon: 'none' })
      return
    }
    const that = this
    const run = function () {
      if (!that._recFilePath) {
        wx.showToast({ title: '录音已失效，请重录', icon: 'none' })
        return
      }
      that.stopAudio()
      feedback.tap()
      that.setData({ comparing: true, shadowTip: '' })
      const voice = getLangMeta(storage.getCurrentLang()).voice
      const playStd = function (then) {
        that._audioPlayer = audio.speak(cur.word, false, {
          id: cur.id,
          lang: voice,
          onDuration(ms) { if (ms > 0) that._stdDuration = ms },
          onEnded() { if (then) then() },
          onError() {
            that.setData({ comparing: false })
            wx.showToast({ title: '标准音没读出来，先看看网络', icon: 'none' })
          }
        })
      }
      const playMine = function (then) {
        const ctx = wx.createInnerAudioContext()
        that._compareCtx = ctx
        const done = function () {
          try { ctx.destroy() } catch (e) {}
          if (that._compareCtx === ctx) that._compareCtx = null
          if (then) then()
        }
        ctx.onEnded(done)
        ctx.onError(done)
        ctx.src = that._recFilePath
        ctx.play()
      }
      playStd(function () {
        playMine(function () {
          playStd(function () {
            that.setData({ comparing: false, shadowTip: that._shadowTip() })
          })
        })
      })
    }
    // 刚录完就点对比时，落盘可能还在途中
    if (this._savePromise) this._savePromise.then(run).catch(run)
    else run()
  },

  // AI 听音反馈：智聆评不了的语种（日语/越南语）用这个给「哪里不对」的具体话。
  // 录音要上传，所以第一次必须先让用户明确同意，同意过就记在设置里不再问。
  aiListen() {
    const cur = this.data.current
    if (!cur) return
    if (!this._recFilePath && !this._savePromise) {
      wx.showToast({ title: '先按下面的按钮录一遍', icon: 'none' })
      return
    }
    if (this.data.aiLoading) return
    const that = this
    const run = function () {
      if (!that._recFilePath) {
        wx.showToast({ title: '录音已失效，请重录', icon: 'none' })
        return
      }
      that.stopAudio()
      that.setData({ aiLoading: true, aiFeedback: null })
      aiEval.evaluate({
        filePath: that._recFilePath,
        text: cur.word,
        lang: storage.getCurrentLang()
      }).then(function (r) {
        if (!r || !r.ok) {
          that.setData({ aiLoading: false })
          wx.showToast({ title: (r && r.message) || 'AI 这次没听明白', icon: 'none' })
          return
        }
        that.setData({ aiLoading: false, aiFeedback: r })
      }).catch(function () {
        that.setData({ aiLoading: false })
        wx.showToast({ title: 'AI 这次没听明白，再点一次', icon: 'none' })
      })
    }
    if (storage.getSettings().aiEvalAgreed) { run(); return }
    wx.showModal({
      title: '把这段录音发给 AI 听？',
      content: '这一段录音会上传到 AI 服务器（境外）听一遍，返回「哪里不对」的文字建议。只上传这一小段，服务器不保存、不缓存。不想上传就别点确定。',
      confirmText: '同意并评测',
      cancelText: '不上传',
      success(res) {
        if (!res.confirm) return
        storage.setAiEvalAgreed(true)
        run()
      }
    })
  },

  // 时长对比：只比说了多久，不比音色。差 15% 以内算对得上。
  _shadowTip() {
    return shadowTip.tip(this._stdDuration, this._recDurationMs)
  },

  // ---------- 录音 ----------
  // 优先走智聆评测插件：它自己录音，并把「发音分 + 逐词错误 + 录音文件」一次给全。
  // 注意 wx.getRecorderManager() 是全局单例，插件内部也用它，两边同时开会互相覆盖回调，
  // 所以走插件时不再自己开录音器。
  _evalAvailable(cur) {
    if (!cur) return false
    // 儿童模式不评测：智聆要把录音上传到腾讯云，孩子没有「同意上传」的能力
    if (this.data.isKid) return false
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
      recognized: this._lastRecognized,
      // 录制时长：录音页的「进步对比」用它比语速（标准音时长在影子跟读里另算）
      ms: this._recDurationMs || 0
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

  // 第一次要录音时先请用户看《声纹授权协议》。
  // 用 modal 说明「要采集什么」，再把用户送到独立协议页——审核要的是「独立协议」，
  // 弹窗只做前情提示，真正的同意动作在那一页完成。
  askVoiceprint() {
    wx.showModal({
      title: '录音前需要你的同意',
      content: '跟读功能会采集你的声音，用于打分和本地回放。详情见《声纹授权协议》，同意后才会开始录音。',
      confirmText: '看协议',
      cancelText: '先不用',
      success(res) {
        if (res.confirm) wx.navigateTo({ url: '/pages/voiceprint/voiceprint?from=record' })
      }
    })
  },

  // wx.getRecorderManager() 是全局单例，跟读录音和对练录音共用同一套回调，
  // 用 _trainRec 区分是谁开的（同一时刻只可能有一个在录）。
  _ensureRecorder() {
    if (this._recManager) return this._recManager
    const that = this
    this._recManager = wx.getRecorderManager()
    this._recManager.onStop(res => {
      if (that._trainRec) {
        that._trainRec = false
        that._trainDo(res && res.tempFilePath)
        return
      }
      that._recFilePath = res.tempFilePath
      that.setData({ hasRecording: true, recording: false })
      that._saveRecording(res.tempFilePath)
      wx.showToast({ title: '录好了，点「听我的」对比', icon: 'none' })
    })
    this._recManager.onError(() => {
      that._trainRec = false
      that.setData({ recording: false, trainRecording: false })
      // 不再只说「请检查麦克风权限」——用户不知道去哪检查。
      // mic.guide 会在确认权限被拒时弹「去开启」直接跳 wx.openSetting。
      mic.guide && mic.guide()
    })
    return this._recManager
  },

  // 三层拦截，顺序不能换：
  //   1. 声纹授权（审核要求「取得同意后才能获取声纹」）
  //   2. 智聆 20802 限流（连点两下必踩）
  //   3. 麦克风权限（被拒过一次就永远失败，必须能一键去设置找回）
  toggleRecord() {
    if (this.data.recording) { this.stopRecord(); return }
    if (!storage.getVoiceprintAgreed()) { this.askVoiceprint(); return }
    if (this._evalAvailable(this.data.current) && this._lastEvalAt && Date.now() - this._lastEvalAt < 2000) {
      wx.showToast({ title: '慢一点，刚评过一次', icon: 'none' })
      return
    }
    const that = this
    mic.check(function (ok) { if (ok) that._startRecord() })
  },

  _startRecord() {
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
            // 把音素分排成一行人话：「θ 34 分 / ð 52 分」，页面就不用写复杂表达式
            wrongWords: (res.wrongWords || []).slice(0, 6).map(function (w) {
              return {
                word: w.word,
                tagText: w.tagText,
                phoneText: (w.phones || []).map(function (p) { return p.phone + ' ' + p.accuracy + ' 分' }).join(' / ')
              }
            })
          })
          // 机评出分就记一次调度（用户再点自评会覆盖成本次的口径）
          that._reviewByScore(cur.id, res.score)
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
        this._lastEvalAt = Date.now()
        this._recStartedAt = Date.now()
        this.setData({ recording: true, hasRecording: false, scoring: true, score: null, scoreDetail: null, wrongWords: [] })
        ev.start()
        return
      }
    }

    // 路径 B：自带录音器（若同声传译可用，并行做文字识别算相似度）
    this._ensureRecorder()
    // 同声传译识别同样是把录音发出去，儿童模式一并关掉（只留本机录音 + 自评）
    if (cur && !this.data.isKid && speechScore.isSupported(lang)) {
      this._recognizer = speechScore.createRecognizer({
        targetText: cur.word,
        lang: getLangMeta(lang).voice,
        onResult(res) {
          that._lastScore = res.score
          that._lastRecognized = res.recognized
          that.setData({ scoring: false, score: res.score, recognized: res.recognized })
          that._reviewByScore(cur.id, res.score)
        },
        onError() { that.setData({ scoring: false }) }
      })
      if (this._recognizer.supported) {
        this._recognizer.start()
        this.setData({ scoring: true, score: null, recognized: '' })
      }
    }
    this._recStartedAt = Date.now()
    try {
      this._recManager.start({ duration: 60000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1 })
      this.setData({ recording: true, hasRecording: false })
    } catch (e) {
      wx.showToast({ title: '录音启动失败', icon: 'none' })
    }
  },

  stopRecord() {
    // 影子跟读要比「说了多久」，插件的回调不给时长，就用按下到松手的时间当近似
    if (this._recStartedAt) {
      this._recDurationMs = Date.now() - this._recStartedAt
      this._recStartedAt = 0
    }
    // 智聆路径：录音归插件管，stop 之后由它的 onStop 回调收尾
    if (this._evaluator) { this._evaluator.stop(); return }
    if (this._recManager && this.data.recording) {
      try { this._recManager.stop() } catch (e) {}
      this.setData({ recording: false })
    }
    if (this._recognizer) { this._recognizer.stop() }
  },

  // ---------- 对练：我说中文，给我目标语言的说法 ----------
  // 只出现在情景对话里。为什么不做独立翻译页：个人主体 + 教育类目，
  // 独立翻译入口容易被判成工具类应用（插件类目那条驳回已经吃过一次亏）。
  toggleTrain() {
    const on = !this.data.trainMode
    this.stopAudio()
    this.setData({
      trainMode: on, trainResult: null, trainErr: '',
      trainRecording: false, trainBusy: false
    })
    if (on) wx.showToast({ title: '点话筒，说一句中文', icon: 'none' })
  },

  _sceneName() {
    const names = this.data.sceneNames || []
    return names[this.data.sceneIndex] || ''
  },

  trainTap() {
    if (this.data.trainBusy) return
    if (this.data.trainRecording) {
      try { this._recManager.stop() } catch (e) {}
      return
    }
    // 和跟读录音同一条要求：微信审核要求先取得声纹授权，才允许开麦克风
    if (!storage.getVoiceprintAgreed()) { this.askVoiceprint(); return }
    const that = this
    mic.check(function (ok) { if (ok) that._startTrain() })
  },

  _startTrain() {
    if (this.data.recording) this.stopRecord()
    this.stopAudio()
    this._ensureRecorder()
    this._trainRec = true
    try {
      this._recManager.start({ duration: 15000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1 })
      this.setData({ trainRecording: true, trainResult: null, trainErr: '' })
    } catch (e) {
      this._trainRec = false
      mic.guide && mic.guide()
    }
  },

  _trainDo(filePath) {
    const that = this
    this.setData({ trainRecording: false, trainBusy: true, trainErr: '' })
    if (!filePath) {
      this.setData({ trainBusy: false, trainErr: '没拿到录音，再试一次' })
      return
    }
    translate.sayWhat({
      filePath: filePath,
      to: storage.getCurrentLang(),
      scene: this._sceneName()
    }).then(function (res) {
      if (!res.ok) {
        that.setData({ trainBusy: false, trainErr: res.message || translate.explain(res.error) })
        return
      }
      that.setData({
        trainBusy: false, trainErr: '',
        trainResult: { text: res.text, translation: res.translation, note: res.note || '' }
      })
      // 拿到就念一遍：学会说之前先听清楚怎么说
      that._playTrainText(res.translation)
    })
  },

  _playTrainText(text) {
    if (!text) return
    audio.speak(text, false, {
      lang: getLangMeta(storage.getCurrentLang()).voice,
      onError() { wx.showToast({ title: '这句读不出来，点一下再试', icon: 'none' }) }
    })
  },

  playTrain() {
    const r = this.data.trainResult
    if (r && r.translation) this._playTrainText(r.translation)
  },

  // ---------- 复习调度 ----------
  // 单词进 storage 的 FSRS 表；句子/台词/自建素材进 sentence-progress（两张表分开存，
  // 因为它们的评分来源不同，混在一张表里以后查不清「这句为什么明天要复习」）。
  _reviewItem(id, quality) {
    if (!id) return
    if (/^(st_|dl_|cu_)/.test(id)) sentenceProgress.review(id, quality, 'speak')
    else storage.review(id, quality)
  },

  // 机评出分就直接记一次：不用等用户再点自评（用户点了自评以自评为准）
  _reviewByScore(id, score) {
    if (!id || typeof score !== 'number' || score <= 0) return
    const q = score >= 80 ? 5 : (score >= 60 ? 3 : 0)
    if (/^(st_|dl_|cu_)/.test(id)) sentenceProgress.review(id, q, 'speak-score')
    else storage.review(id, q)
  },

  // ---------- 自评 / 翻页 ----------
  rate(e) {
    const q = Number(e.currentTarget.dataset.q)
    if (!this.data.current || this.data.justRated) return
    const cur = this.data.current
    speaking.record(cur.id, q, this._lastScore)
    const schedQ = q === 0 ? 0 : (q === 1 ? 3 : 5)
    this._reviewItem(cur.id, schedQ)
    if (q === 0) feedback.warn(); else feedback.success()

    const msg = this.data.isKid
      ? (['已加入重点复练 💪', '读得不错！', '读得真好！'][q] || '已记录')
      : (['已加入重点复练 💪', '不错，继续！', '很流利，赞！'][q] || '已记录')
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
    } else if (this.data.mode === 'one') {
      // 单条练习：练完这条就回正常队列，不要停在一条上转圈
      wx.showToast({ title: '这一条练完了', icon: 'success' })
      this.setData({ mode: 'train' }, () => { this.refreshScenes(); this.buildQueueAndLoad() })
    } else if (this.data.mode === 'focus' || this.data.mode === 'due') {
      const wasDue = this.data.mode === 'due'
      this.setData({ mode: 'train', sceneIndex: this.data.sceneIndex }, () => {
        this.refreshScenes(); this.buildQueueAndLoad()
      })
      wx.showToast({ title: wasDue ? '到期句子复习完成！' : '重点复练完成！', icon: 'success' })
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
  // 单条练习：搜索页点「去跟读这句」进来的，队列里就这一条
  startOne(id) {
    let lang = storage.getCurrentLang()
    let item = this.allItems(lang).filter(function (it) { return it.id === id })[0]
    if (!item) {
      // 转发卡片可能来自别的语种：按 id 前缀切过去，别直接告诉对方「找不到」
      const want = langOfId(id)
      if (want && want !== lang) {
        storage.setLang(want)
        lang = want
        this.refreshScenes()
        item = this.allItems(lang).filter(function (it) { return it.id === id })[0]
      }
    }
    if (!item) {
      wx.showToast({ title: '这条素材找不到了', icon: 'none' })
      return
    }
    this.stopAll()
    this._queue = [item]
    this._memoIndex = 0
    this.setData(Object.assign({ mode: 'one', queueLen: 1, index: 0 }, this._progress(0, 1)), () => {
      this._queueSig = this._sig()
      this.loadCurrent()
    })
  },

  startFocus() {
    const lang = storage.getCurrentLang()
    const list = speaking.getFocusItems(this.allItems(lang))
    if (!list.length) {
      wx.showToast({ title: '还没有重点条目，练习时点「再练练」加入', icon: 'none' })
      return
    }
    this.stopAll()
    this._queue = list
    this._memoIndex = 0
    this.setData(Object.assign({ mode: 'focus', queueLen: list.length, index: 0 }, this._progress(0, list.length)), () => {
      this._queueSig = this._sig()
      this.loadCurrent()
    })
  },
  // 句子到期复习：只排「练过且到点」的句子（句子调度见 utils/sentence-progress.js）
  startDue() {
    const lang = storage.getCurrentLang()
    const now = Date.now()
    const due = this.allItems(lang).filter(function (it) {
      const p = sentenceProgress.get(it.id)
      return p && p.dueAt && p.dueAt <= now
    })
    if (!due.length) {
      wx.showToast({ title: '还没有到期的句子，先随口练几句', icon: 'none' })
      return
    }
    this.stopAll()
    this._queue = due
    this._memoIndex = 0
    this.setData(Object.assign({ mode: 'due', queueLen: due.length, index: 0 }, this._progress(0, due.length)), () => {
      this._queueSig = this._sig()
      this.loadCurrent()
    })
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
