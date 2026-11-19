const storage = require('../../utils/storage')
const speaking = require('../../utils/speaking')
const sentences = require('../../utils/sentences')
const recordings = require('../../utils/recordings')
const achievements = require('../../utils/achievements')
const theme = require('../../utils/theme')
const familyBackup = require('../../utils/family-backup')
const { getWords } = require('../../utils/words')

const app = getApp()

Page({
  behaviors: [theme],
  data: {
    stats: {}, mastered: 0, accuracy: 0, dailyGoal: 20,
    levels: [], days: [], speak: {},
    calendar: [], unlockedCount: 0, badges: [],
    feedbackEnabled: true, fontScale: 1, darkMode: false
  },
  onShow() {
    this.syncTheme()
    this.refresh()
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

    this.setData({
      stats, accuracy, levels, days, speak, fluency,
      calendar: cal, badges, unlockedCount,
      mastered: mastered,
      dailyGoal: settings.dailyGoal || 20,
      feedbackEnabled: settings.feedbackEnabled !== false
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

      const pts = this.data.fluency || []
      const padL = 36, padB = 30, padT = 16, padR = 12
      const chartH = H - padB - padT
      const chartW = W - padL - padR
      const slot = chartW / Math.max(pts.length - 1, 1)

      // 网格线 0/50/100%
      ctx.strokeStyle = '#EEF1FB'
      ctx.lineWidth = 1
      ;[0, 50, 100].forEach(function (rate) {
        const y = padT + chartH - (rate / 100) * chartH
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
        ctx.fillStyle = '#B7BFCC'; ctx.font = '16px sans-serif'; ctx.textAlign = 'right'
        ctx.fillText(rate + '%', padL - 6, y + 5)
      })

      // 折线（只连有练习的天，无练习天跳过）
      ctx.strokeStyle = '#4A6CF7'
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
          ctx.fillStyle = '#4A6CF7'
          ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, Math.PI * 2); ctx.fill()
        }
        if (i % 3 === 0 || i === coords.length - 1) {
          ctx.fillStyle = '#8A94A6'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'
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

      const days = this.data.days
      const max = Math.max.apply(null, days.map(d => d.value).concat([1]))
      const padL = 30, padB = 40, padT = 20
      const chartH = H - padB - padT
      const chartW = W - padL - 10
      const slot = chartW / days.length
      const barW = Math.min(slot * 0.5, 36)

      // 网格线
      ctx.strokeStyle = '#EEF1FB'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = padT + chartH - (chartH / 4) * i
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(W - 10, y)
        ctx.stroke()
        ctx.fillStyle = '#B7BFCC'
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
        grad.addColorStop(0, '#6E8BFF')
        grad.addColorStop(1, '#4A6CF7')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect ? ctx.roundRect(x, y, barW, Math.max(h, 2), 6) : ctx.rect(x, y, barW, Math.max(h, 2))
        ctx.fill()
        // 数值
        if (d.value > 0) {
          ctx.fillStyle = '#4A6CF7'
          ctx.font = 'bold 18px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(String(d.value), x + barW / 2, y - 6)
        }
        // 日期
        ctx.fillStyle = '#8A94A6'
        ctx.font = '18px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(d.label, x + barW / 2, H - 12)
      })
    })
  },
  editGoal() {
    const that = this
    wx.showModal({
      title: '设置每日目标',
      content: '请输入每天要复习的单词数（1-200）',
      editable: true,
      placeholderText: String(this.data.dailyGoal),
      success(res) {
        if (res.confirm) {
          const n = parseInt(res.content, 10)
          if (n >= 1 && n <= 200) {
            storage.setDailyGoal(n)
            that.setData({ dailyGoal: n })
            wx.showToast({ title: '已保存', icon: 'success' })
          } else {
            wx.showToast({ title: '请输入 1-200 的数字', icon: 'none' })
          }
        }
      }
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
        wx.showToast({ title: '字号已调整', icon: 'success' })
      }
    })
  },

  toggleDarkMode() {
    const v = !this.data.darkMode
    storage.setDarkMode(v)
    app.refreshTheme()
    this.syncTheme()
    wx.showToast({ title: v ? '已开启深色模式' : '已关闭深色模式', icon: 'none' })
  },

  exportProgress() {
    const data = storage.exportData()
    const text = JSON.stringify(data)
    wx.setClipboardData({
      data: text,
      success() {
        wx.showModal({
          title: '已复制到剪贴板',
          content: '备份数据已复制。粘贴到备忘录或微信收藏保存，换设备时用「导入进度」恢复。',
          showCancel: false
        })
      },
      fail() {
        wx.showToast({ title: '复制失败', icon: 'none' })
      }
    })
  },

  importProgress() {
    wx.showModal({
      title: '导入进度',
      content: '请粘贴之前导出的备份数据（以 {"format":"yuban-lang-backup" 开头）',
      editable: true,
      success(res) {
        if (!res.confirm || !res.content) return
        let data
        try {
          data = JSON.parse(res.content)
        } catch (e) {
          wx.showToast({ title: '数据格式错误', icon: 'none' })
          return
        }
        const result = storage.importData(data)
        if (!result.ok) {
          wx.showToast({ title: result.reason, icon: 'none' })
          return
        }
        wx.showToast({ title: '导入成功', icon: 'success' })
        setTimeout(function () { wx.reLaunch({ url: '/pages/index/index' }) }, 800)
      }
    })
  },

  // ---- 全家包备份（跨设备搬一家人） ----
  exportFamily() {
    const data = familyBackup.exportAll()
    wx.setClipboardData({
      data: JSON.stringify(data),
      success() {
        wx.showModal({
          title: '全家包已复制',
          content: '已包含全部 ' + data.profiles.length + ' 位家人的进度。发到微信收藏，换设备时用「导入全家包」恢复。注意：录音需到新设备重录。',
          showCancel: false
        })
      },
      fail() { wx.showToast({ title: '复制失败', icon: 'none' }) }
    })
  },

  importFamily() {
    const that = this
    wx.showModal({
      title: '导入全家包',
      content: '粘贴全家包数据（以 {"format":"yuban-family-backup" 开头）',
      editable: true,
      success(res) {
        if (!res.confirm || !res.content) return
        let data
        try { data = JSON.parse(res.content) } catch (e) {
          wx.showToast({ title: '数据格式错误', icon: 'none' }); return
        }
        // 让用户选覆盖还是合并
        wx.showActionSheet({
          itemList: ['合并（保留现有 + 导入）', '覆盖（清空后恢复）'],
          success(choice) {
            const mode = choice.tapIndex === 0 ? 'merge' : 'overwrite'
            const result = familyBackup.importAll(data, mode)
            if (!result.ok) { wx.showToast({ title: result.reason, icon: 'none' }); return }
            wx.showToast({ title: '导入 ' + result.count + ' 位家人', icon: 'success' })
            setTimeout(function () { wx.reLaunch({ url: '/pages/index/index' }) }, 900)
          }
        })
      }
    })
  }
})
