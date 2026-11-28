const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const sentences = require('../../utils/sentences')
const recordings = require('../../utils/recordings')
const backupFile = require('../../utils/backup-file')
const achievements = require('../../utils/achievements')
const shareCopy = require('../../utils/share-copy')
const prompt = require('../../utils/prompt')
const theme = require('../../utils/theme')
const familyBackup = require('../../utils/family-backup')
const ttsCache = require('../../utils/tts-cache')
const onlineData = require('../../utils/online-data')
const logger = require('../../utils/logger')
const { getWords } = require('../../utils/words')
const modePicker = require('../../utils/mode-picker')
const pageTimers = require('../../utils/page-timers')
const chartPalette = require('../../utils/chart-palette')

const app = getApp()

// 备份导入的长度上限（字符数）。一份 821 词的备份约 58KB，
// wx.showModal 的可编辑输入框粘到 20K 字以上在真机上就开始卡。
const IMPORT_MAX_CHARS = 200 * 1024

Page({
  behaviors: [theme],
  data: {
    stats: {}, mastered: 0, accuracy: 0, dailyGoal: 20,
    levels: [], days: [], speak: {},
    calendar: [], unlockedCount: 0, badges: [], shareTitle: '',
    feedbackEnabled: true, fontScale: 1, darkMode: false, ttsCacheKb: 0, voiceprintAgreed: false,
    recCount: 0, recKb: 0, recMaxMb: 6, recText: '还没录过'
  },
  // 定时器登记（第十一轮）：导入成功后 800/900ms reLaunch
  later(fn, ms) { return pageTimers.later(this, fn, ms) },
  onHide() { pageTimers.clear(this) },
  onUnload() { pageTimers.clear(this) },
  onShow() {
    this.syncTheme()
    this.refresh()
    // 发音缓存体积（离线缓存 mp3 用掉了多少本地空间）
    this.setData({ ttsCacheKb: Math.round(ttsCache.totalBytes() / 1024) })
    // 录音占用（第十轮）：录音才是 6MB 的大头，之前一点都不显示
    try {
      const ru = recordings.usage()
      // wxml 里不能用方法调用（{{x.toFixed(1)}} 会被编译成「unexpected token .」），
      // 所有格式化都在这里算好，模板只做字符串拼接。
      const mb = ru.bytes / 1048576
      const size = mb >= 1 ? mb.toFixed(1) : (ru.bytes / 1024).toFixed(2)
      this.setData({
        recCount: ru.count,
        recKb: Math.round(ru.bytes / 1024),
        recMaxMb: Math.round(ru.maxBytes / 1048576),
        // 条数上限也要露出来（第十三轮）：超出 30 条会挤掉最旧的一条，
        // 但界面上从来没说过有 30 条这个上限，用户只会觉得录音自己消失了。
        recText: ru.count > 0
          ? ru.count + ' / ' + ru.maxKeep + ' 条 · ' + size + ' MB / ' + Math.round(ru.maxBytes / 1048576) + ' MB'
          : '还没录过（上限 ' + ru.maxKeep + ' 条）'
      })
    } catch (e) { logger.warn('[stats] 读取录音占用失败', e) }
  },
  refresh() {
    const lang = storage.getCurrentLang()
    const stats = storage.getStats()
    const prog = storage.getProgress()
    const words = getWords(lang)
    const allSpeakingItems = words.concat(sentences.getAllItems(lang))
    const settings = storage.getSettings()
    const daily = storage.getDaily()
    const speakDaily = speaking.getDaily()

    // 总正确率
    const accuracy = stats.totalReviews > 0
      ? Math.round(stats.totalCorrect / stats.totalReviews * 100) : 0

    // 掌握分布：按 level 0..6 分桶
    const names = ['生词', '初识', '熟悉', '巩固', '掌握', '熟练', '精通']
    const colors = ['#E4E8F2', '#C9D4FF', '#A9BCFF', '#7E9BFF', '#4A6CF7', '#2E52E0', '#1B35A8']
    const counts = [0, 0, 0, 0, 0, 0, 0]
    words.forEach(w => {
      const p = prog[w.id]
      if (!p) { counts[0] += 1 }
      else { counts[Math.min(p.level, 6)] += 1 }
    })
    const max = Math.max.apply(null, counts.concat([1]))
    const levels = names.map((name, i) => ({
      name, count: counts[i], color: colors[i],
      percent: Math.round(counts[i] / max * 100)
    }))

    // 近 7 天
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = storage.todayKey(d)
      days.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), value: (daily[key] && daily[key].reviewed) || 0 })
    }

    // 口语汇总 + 打卡日历
    const speak = speaking.getSummary(lang, allSpeakingItems)
    const cal = achievements.calendar(daily, speakDaily, 28)

    // 近 14 天口语流利度趋势：每天 流利数/练习数
    const fluency = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = storage.todayKey(d)
      const rec = speakDaily[key] || { count: 0, good: 0 }
      fluency.push({
        label: (d.getMonth() + 1) + '/' + d.getDate(),
        count: rec.count || 0,
        rate: rec.count ? Math.round((rec.good || 0) / rec.count * 100) : 0
      })
    }

    // 掌握数（只算一次，下面复用）
    const mastered = storage.getMasteredCount(lang)

    // 成就徽章
    const badges = achievements.compute({
      speakTimes: speak.speakTimes,
      fluent: speak.fluent,
      streak: stats.streak || 0,
      mastered: mastered,
      dialogues: speak.dialogues,
      recordings: recordings.list().length
    })
    const unlockedCount = badges.filter(b => b.unlocked).length
    // 分享文案用真实数据拼，不做假徽章（没有记录就退化成邀请文案）。
    // 语种名跟当前语种走，不再写死「英语」（文案模板见 utils/share-copy.js）
    const shareTitle = shareCopy.title({
      lang: storage.getCurrentLang(),
      streak: stats.streak || 0,
      mastered: mastered,
      badges: unlockedCount
    })

    const practiceMin = Math.round(storage.getPracticeSeconds() / 60)
    this.setData({
      stats, accuracy, levels, days, speak, fluency,
      calendar: cal, badges, unlockedCount, shareTitle: shareTitle,
      mastered: mastered,
      dailyGoal: settings.dailyGoal || 20,
      feedbackEnabled: settings.feedbackEnabled !== false,
      voiceprintAgreed: !!settings.voiceprintAgreed,
      practiceMin: practiceMin,
      todayLearned: (storage.getToday() || {}).learned || 0,
      kidAiUnlocked: storage.getKidAiUnlocked(),
      kidTip: practiceMin >= 30 ? '今天够啦，休息一下，明天再来。'
        : (practiceMin >= 15 ? '已经 15 分钟了，看看远处，让眼睛歇一会儿。'
          : '慢慢来，每天十分钟就很好。')
    }, () => { this.drawChart(); this.drawFluencyChart() })
  },
  // 设备像素比只取一次：wx.getSystemInfoSync 已废弃，且每次重画都调一次是浪费。
  // 新版基础库有 wx.getWindowInfo / wx.getDeviceInfo，老版本回退到 getSystemInfoSync。
  dpr() {
    if (this._dpr) return this._dpr
    let v = 2
    try {
      if (wx.getWindowInfo) v = wx.getWindowInfo().pixelRatio || 2
      else if (wx.getDeviceInfo) v = wx.getDeviceInfo().pixelRatio || 2
      else v = wx.getSystemInfoSync().pixelRatio || 2
    } catch (e) { v = 2 }
    this._dpr = v
    return v
  },

  drawFluencyChart() {
    const query = wx.createSelectorQuery()
    query.select('#fluencyChart').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = this.dpr()
      const W = res[0].width, H = res[0].height
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, W, H)

      const pal = chartPalette.palette(!!this.data.darkMode)
      const pts = this.data.fluency || []
      const padL = 36, padB = 30, padT = 16, padR = 12
      const chartH = H - padB - padT
      const chartW = W - padL - padR
      const slot = chartW / Math.max(pts.length - 1, 1)

      // 网格线 0/50/100%（配色跟主题走，见 utils/chart-palette.js）
      ctx.strokeStyle = pal.grid
      ctx.lineWidth = 1
      ;[0, 50, 100].forEach(function (rate) {
        const y = padT + chartH - (rate / 100) * chartH
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
        ctx.fillStyle = pal.label; ctx.font = '16px sans-serif'; ctx.textAlign = 'right'
        ctx.fillText(rate + '%', padL - 6, y + 5)
      })

      // 折线（只连有练习的天，无练习天跳过）
      ctx.strokeStyle = pal.line
      ctx.lineWidth = 3
      ctx.beginPath()
      let drawing = false
      const coords = []
      pts.forEach(function (p, i) {
        const x = padL + slot * i
        const y = padT + chartH - (p.rate / 100) * chartH
        coords.push({ x: x, y: y, p: p })
        if (p.count > 0) {
          if (!drawing) { ctx.moveTo(x, y); drawing = true }
          else ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // 数据点 + 标签（每 3 天标一次）
      coords.forEach(function (c, i) {
        if (c.p.count > 0) {
          ctx.fillStyle = pal.line
          ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, Math.PI * 2); ctx.fill()
        }
        if (i % 3 === 0 || i === coords.length - 1) {
          ctx.fillStyle = pal.label; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'
          ctx.fillText(c.p.label, c.x, H - 8)
        }
      })
    })
  },
  drawChart() {
    const query = wx.createSelectorQuery()
    query.select('#barChart').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = this.dpr()
      const W = res[0].width, H = res[0].height
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, W, H)

      const pal = chartPalette.palette(!!this.data.darkMode)
      const days = this.data.days
      const max = Math.max.apply(null, days.map(d => d.value).concat([1]))
      const padL = 30, padB = 40, padT = 20
      const chartH = H - padB - padT
      const chartW = W - padL - 10
      const slot = chartW / days.length
      const barW = Math.min(slot * 0.5, 36)

      // 网格线（配色跟主题走）
      ctx.strokeStyle = pal.grid
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = padT + chartH - (chartH / 4) * i
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(W - 10, y)
        ctx.stroke()
        ctx.fillStyle = pal.label
        ctx.font = '18px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(String(Math.round(max / 4 * i)), padL - 6, y + 6)
      }

      days.forEach((d, i) => {
        const h = max ? (d.value / max) * chartH : 0
        const x = padL + slot * i + (slot - barW) / 2
        const y = padT + chartH - h
        // 柱
        const grad = ctx.createLinearGradient(0, y, 0, padT + chartH)
        grad.addColorStop(0, pal.barTop)
        grad.addColorStop(1, pal.barBottom)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect ? ctx.roundRect(x, y, barW, Math.max(h, 2), 6) : ctx.rect(x, y, barW, Math.max(h, 2))
        ctx.fill()
        // 数值
        if (d.value > 0) {
          ctx.fillStyle = pal.line
          ctx.font = 'bold 18px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(String(d.value), x + barW / 2, y - 6)
        }
        // 日期
        ctx.fillStyle = pal.label
        ctx.font = '18px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(d.label, x + barW / 2, H - 12)
      })
    })
  },
  // ---------- 分享 ----------
  // 分享卡片带真实数据（连续打卡 / 掌握词数 / 徽章数），别人点进来直接到首页。
  onShareAppMessage() {
    return {
      title: this.data.shareTitle || shareCopy.title({ lang: storage.getCurrentLang() }),
      path: '/pages/index/index'
    }
  },
  onShareTimeline() {
    return { title: this.data.shareTitle || shareCopy.title({ lang: storage.getCurrentLang() }) }
  },
  copyShare() {
    const that = this
    wx.setClipboardData({
      data: (that.data.shareTitle || shareCopy.title({ lang: storage.getCurrentLang() })) + '（微信小程序「语伴」）',
      success() { wx.showToast({ title: '分享文案已复制', icon: 'success' }) }
    })
  },

  editGoal() {
    const that = this
    prompt.askNumber({
      title: '设置每日目标',
      content: '请输入每天要复习的单词数（1-200）',
      min: 1,
      max: 200,
      value: this.data.dailyGoal,
      done(n) {
        storage.setDailyGoal(n)
        that.setData({ dailyGoal: n })
        wx.showToast({ title: '已保存', icon: 'success' })
      }
    })
  },

  // 儿童模式的 AI 开关：默认关闭，要家长亲手确认一次才解锁（孩子点不出来）
  openKidAi() {
    const that = this
    if (!this.data.isKid) {
      wx.showModal({
        title: 'AI 功能默认开启',
        content: 'AI 查词、AI 听音、对练会把文字或一段录音发到境外服务器。切到儿童模式后会自动关闭。',
        showCancel: false, confirmText: '知道了'
      })
      return
    }
    if (this.data.kidAiUnlocked) {
      wx.showModal({
        title: '关掉儿童模式的 AI 功能',
        content: '关掉后 AI 听音与对练会从口语页消失，只剩本机录音和自评。',
        confirmText: '关掉', cancelText: '留着',
        success(r) {
          if (!r.confirm) return
          storage.setKidAiUnlocked(false)
          that.refresh()
          wx.showToast({ title: '已关闭', icon: 'none' })
        }
      })
      return
    }
    wx.showModal({
      title: '请家长确认',
      content: '开启后，孩子在口语页可以用 AI 听音与对练：会把一段录音发到境外 AI 服务，不保存、不用于训练。请确认你是孩子的家长或监护人。',
      confirmText: '我是家长', cancelText: '不开启',
      success(r) {
        if (!r.confirm) return
        storage.setGuardianAgreed(true)
        const ok = storage.setKidAiUnlocked(true)
        that.refresh()
        wx.showToast({ title: ok ? '已解锁，去口语页试试' : '没能解锁，再点一次', icon: 'none' })
      }
    })
  },

  // 当前档案的显示模式（儿童模式入口就放在设置里，和字体大小挨着）
  openMode() {
    const that = this
    modePicker.pick(function () {
      that.syncTheme()
      that.refresh()
      // 儿童/长辈模式也会改字号，图表要跟着重算尺寸
      that.later(function () { that.drawChart(); that.drawFluencyChart() }, 60)
    })
  },

  toggleFeedback() {
    const v = !this.data.feedbackEnabled
    storage.setFeedbackEnabled(v)
    this.setData({ feedbackEnabled: v })
    wx.showToast({ title: v ? '反馈已开启' : '反馈已关闭', icon: 'none' })
  },

  setFontSize() {
    const that = this
    wx.showActionSheet({
      itemList: ['标准', '大', '超大', '小'],
      success(res) {
        const scales = [1, 1.18, 1.35, 0.9]
        storage.setFontScale(scales[res.tapIndex])
        app.refreshTheme()
        that.syncTheme()
        // 字号变了，卡片高度跟着变 → canvas 尺寸要重算，否则图会被拉伸
        that.later(function () { that.drawChart(); that.drawFluencyChart() }, 60)
        wx.showToast({ title: '字号已调整', icon: 'success' })
      }
    })
  },

  toggleDarkMode() {
    const self = this
    const v = !this.data.darkMode
    storage.setDarkMode(v)
    app.refreshTheme()
    this.syncTheme()
    // canvas 是个独立绘制层：换配色后必须重画，否则深色下还是浅色图表。
    // setData 是异步的，等这一帧渲染完再画，不然拿到的是旧底色。
    this.later(function () { self.drawChart(); self.drawFluencyChart() }, 60)
    wx.showToast({ title: v ? '已开启深色模式' : '已关闭深色模式', icon: 'none' })
  },

  // 清掉发音缓存：听力靠它提速，但占本地文件配额，空间紧张时用户得能自己清
  // 平时启动后 6 小时内不再联网查词库（省掉每次启动白拉 134KB），想马上更新点这里
  checkOnline() {
    if (!onlineData.configured()) {
      wx.showToast({ title: '这一版没配在线词库', icon: 'none' })
      return
    }
    wx.showLoading({ title: '检查中…', mask: true })
    onlineData.checkUpdate(function (r) {
      wx.hideLoading()
      if (!r.ok) {
        wx.showToast({ title: r.reason === 'network' ? '连不上服务器，稍后再试' : '词库数据有问题', icon: 'none' })
        return
      }
      if (r.updated) {
        wx.showModal({ title: '词库已更新', content: '拉到新版本了，新素材会在下次打开页面时生效。', showCancel: false })
        return
      }
      wx.showToast({ title: '已经是最新版本', icon: 'success' })
    }, { force: true })
  },

  // 声纹授权入口：协议必须「随时可查看、可撤回」，所以放在使用设置里常驻
  openVoiceprint() {
    wx.navigateTo({ url: '/pages/voiceprint/voiceprint' })
  },

  goRecordings() { wx.navigateTo({ url: '/pages/recordings/recordings' }) },

  clearTtsCache() {
    const that = this
    const kb = Math.round(ttsCache.totalBytes() / 1024)
    if (kb <= 0) {
      wx.showToast({ title: '还没有缓存的发音', icon: 'none' })
      return
    }
    wx.showModal({
      title: '清掉发音缓存？',
      content: '会释放约 ' + kb + 'KB 空间。清理后第一次听同一句话会重新联网下载，之后又快起来。',
      success(res) {
        if (!res.confirm) return
        ttsCache.clear()
        wx.showToast({ title: '已清理', icon: 'none' })
        that.setData({ ttsCacheKb: 0 })
      }
    })
  },

  // ---- 备份：复制 or 存成文件（第十三轮） ----
  //
  // 原来只有「复制到剪贴板」一条路。828 词全学完的备份约 60KB，
  // 换手机时得粘进备忘录、再整段复制回来，错一个字符就整包失败 ——
  // 备份功能是有的，但真正要用的时候用不上。所以多给一条「存成文件」。
  copyText(text, tip) {
    wx.setClipboardData({
      data: text,
      success() {
        wx.showModal({ title: '已复制到剪贴板', content: tip, showCancel: false })
      },
      fail() { wx.showToast({ title: '复制失败', icon: 'none' }) }
    })
  },

  // 写成本地 json 再交给 wx.shareFileMessage，用户可以直接发给「文件传输助手」
  shareBackup(text, label) {
    const that = this
    const r = backupFile.save(text)
    if (!r.ok) {
      // 老基础库没有文件系统 / 写失败：退回剪贴板，别让用户卡在这一步
      that.copyText(text, '这个环境不支持存成文件，已改为复制到剪贴板。')
      return
    }
    backupFile.share(r.filePath, r.name, function (res) {
      if (res.ok || res.reason === 'cancelled') return
      if (res.reason === 'unsupported') {
        that.copyText(text, '这个版本的微信不支持分享文件，已改为复制到剪贴板。')
        return
      }
      wx.showModal({
        title: '文件已生成',
        content: '已存成 ' + r.name + '，但分享没成功。可以改用「复制到剪贴板」。',
        showCancel: false
      })
    })
  },

  exportProgress() {
    const that = this
    const data = storage.exportData()
    const text = JSON.stringify(data)
    wx.showActionSheet({
      itemList: ['复制到剪贴板', '存成文件发给微信（换手机用这个）'],
      success(res) {
        if (res.tapIndex === 0) {
          that.copyText(text, '备份数据已复制。粘贴到备忘录或微信收藏保存，换设备时用「导入进度」恢复。')
        } else {
          that.shareBackup(text, '学习数据备份')
        }
      },
      fail() {}
    })
  },

  importProgress() {
    const that = this
    wx.showActionSheet({
      itemList: ['从聊天记录选备份文件（推荐）', '手动粘贴文本'],
      success(res) {
        if (res.tapIndex === 0) that.importFromFile()
        else that.importByPaste()
      },
      fail() {}
    })
  },

  // 从聊天记录里选一份备份 json 读回来。比粘贴可靠得多：文件不会被输入框截断。
  importFromFile() {
    const that = this
    backupFile.pick(function (r) {
      if (!r.ok) {
        if (r.reason === 'cancelled') return
        wx.showToast({ title: that.pickErrorText(r.reason), icon: 'none' })
        return
      }
      let data
      try {
        data = JSON.parse(r.text)
      } catch (e) {
        wx.showToast({ title: '这个文件不是备份数据', icon: 'none' })
        return
      }
      that.applyBackup(data)
    })
  },

  // 导入成功后的公共收尾：换档 / 校验都走 storage.importData
  applyBackup(data) {
    const that = this
    const result = storage.importData(data)
    if (!result.ok) {
      wx.showToast({ title: result.reason, icon: 'none' })
      return
    }
    wx.showToast({ title: '导入成功', icon: 'success' })
    that.later(function () { wx.reLaunch({ url: '/pages/index/index' }) }, 800)
  },

  importByPaste() {
    const that = this
    wx.showModal({
      title: '导入进度',
      content: '请粘贴之前导出的备份数据（以 {"format":"yuban-lang-backup" 开头）',
      editable: true,
      success(res) {
        if (!res.confirm || !res.content) return
        const text = String(res.content).trim()
        // 一份 821 词的备份约 58KB。wx.showModal 的可编辑输入框粘这么长会明显卡顿，
        // 真机上还可能被截断——截断后 JSON.parse 报错，用户看到的是「格式错误」，
        // 会以为是备份文件坏了。所以先量长度，超了直接给能行动的提示。
        if (text.length > IMPORT_MAX_CHARS) {
          that.tipTooLong('导入进度')
          return
        }
        let data
        try {
          data = JSON.parse(text)
        } catch (e) {
          wx.showToast({ title: '数据格式不对，检查是否粘完整', icon: 'none' })
          return
        }
        that.applyBackup(data)
      }
    })
  },

  // 备份太长时给一条能走通的路，而不是只报错
  tipTooLong(title) {
    wx.showModal({
      title: '内容太长',
      content: '粘贴的备份超过 ' + Math.round(IMPORT_MAX_CHARS / 1024) + 'K 字，真机输入框粘不下这么长。\n\n建议改用「导出全家包 / 导入全家包」：它同样复制到剪贴板，但恢复时不用把整段贴进输入框（可直接从剪贴板读）。',
      showCancel: false
    })
  },

  // ---- 全家包备份（跨设备搬一家人） ----
  exportFamily() {
    const that = this
    const data = familyBackup.exportAll()
    const text = JSON.stringify(data)
    wx.showActionSheet({
      itemList: ['复制到剪贴板', '存成文件发给微信（换手机用这个）'],
      success(res) {
        if (res.tapIndex === 0) {
          that.copyText(text, '已包含全部 ' + data.profiles.length + ' 位家人的进度。发到微信收藏，换设备时用「导入全家包」恢复。注意：录音需到新设备重录。')
        } else {
          that.shareBackup(text, '全家包备份')
        }
      },
      fail() {}
    })
  },

  importFamily() {
    const that = this
    wx.showActionSheet({
      itemList: ['从聊天记录选全家包文件（推荐）', '手动粘贴文本'],
      success(res) {
        if (res.tapIndex === 0) that.importFamilyFromFile()
        else that.importFamilyByPaste()
      },
      fail() {}
    })
  },

  importFamilyFromFile() {
    const that = this
    backupFile.pick(function (r) {
      if (!r.ok) {
        if (r.reason === 'cancelled') return
        wx.showToast({ title: that.pickErrorText(r.reason), icon: 'none' })
        return
      }
      let data
      try { data = JSON.parse(r.text) } catch (e) {
        wx.showToast({ title: '这个文件不是全家包数据', icon: 'none' }); return
      }
      that.applyFamilyBackup(data)
    })
  },

  // 选文件失败的各种原因，翻译成人话
  pickErrorText(reason) {
    const map = {
      unsupported: '这个版本的微信不支持选文件，请改用「手动粘贴文本」',
      'too-big': '这个文件太大了，不像是备份数据',
      empty: '这个文件是空的',
      'read-failed': '文件读不出来，换一个试试',
      'no-file': '没有选到文件'
    }
    return map[reason] || '没能读到备份文件'
  },

  // 导入全家包后的公共收尾：让用户选合并还是覆盖
  applyFamilyBackup(data) {
    const that = this
    wx.showActionSheet({
      itemList: ['合并（保留现有 + 导入）', '覆盖（清空后恢复）'],
      success(choice) {
        const mode = choice.tapIndex === 0 ? 'merge' : 'overwrite'
        const result = familyBackup.importAll(data, mode)
        if (!result.ok) { wx.showToast({ title: result.reason, icon: 'none' }); return }
        wx.showToast({ title: '导入 ' + result.count + ' 位家人', icon: 'success' })
        that.later(function () { wx.reLaunch({ url: '/pages/index/index' }) }, 900)
      }
    })
  },

  importFamilyByPaste() {
    const that = this
    wx.showModal({
      title: '导入全家包',
      content: '粘贴全家包数据（以 {"format":"yuban-family-backup" 开头）',
      editable: true,
      success(res) {
        if (!res.confirm || !res.content) return
        const text = String(res.content).trim()
        if (text.length > IMPORT_MAX_CHARS) {
          that.tipTooLong('导入全家包')
          return
        }
        let data
        try { data = JSON.parse(text) } catch (e) {
          wx.showToast({ title: '数据格式不对，检查是否粘完整', icon: 'none' }); return
        }
        that.applyFamilyBackup(data)
      }
    })
  }
})
