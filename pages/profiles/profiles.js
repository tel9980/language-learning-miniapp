const theme = require('../../utils/theme')
const profile = require('../../utils/profile')
const storage = require('../../utils/storage')

const MODE_NAMES = { normal: '标准', kid: '儿童', elder: '长辈' }

Page({
  behaviors: [theme],
  data: {
    profiles: [],
    currentId: '',
    modes: [],
    modeNames: MODE_NAMES
  },

  onShow() {
    this.syncTheme()
    this.refresh()
  },

  noop() {},

  refresh() {
    const cur = profile.current()
    const modes = Object.keys(profile.modes()).map(k => ({ key: k, name: MODE_NAMES[k] || k }))
    const profiles = profile.list().map(p => {
      let stats = {}
      try {
        stats = JSON.parse(wx.getStorageSync(profile.nsKey('lp_stats_v1', p.id)) || '{}')
      } catch (e) {}
      return Object.assign({}, p, {
        modeName: MODE_NAMES[p.mode] || '标准',
        streak: stats.streak || 0,
        learned: stats.totalLearned || 0,
        isCurrent: p.id === cur
      })
    })
    this.setData({ profiles, currentId: cur, modes })
  },

  choose(e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.currentId) return
    if (!profile.switchTo(id)) return
    wx.showToast({ title: '已切换档案', icon: 'success' })
    setTimeout(function () { wx.reLaunch({ url: '/pages/index/index' }) }, 600)
  },

  addProfile() {
    const that = this
    wx.showModal({
      title: '新增档案',
      content: '给家人起个名字（最多 12 个字）',
      editable: true,
      placeholderText: '例如：妈妈',
      success(res) {
        if (!res.confirm || !res.content || !res.content.trim()) return
        that._newName = res.content.trim()
        wx.showActionSheet({
          itemList: ['标准模式', '儿童模式（字大、简单）', '长辈模式（超大字）'],
          success(r) {
            const mode = ['normal', 'kid', 'elder'][r.tapIndex] || 'normal'
            const id = profile.add(that._newName, mode)
            profile.switchTo(id)
            wx.showToast({ title: '已创建并切换', icon: 'success' })
            setTimeout(function () { wx.reLaunch({ url: '/pages/index/index' }) }, 600)
          }
        })
      }
    })
  },

  rename(e) {
    const id = e.currentTarget.dataset.id
    const p = profile.get(id)
    if (!p) return
    const that = this
    wx.showModal({
      title: '重命名档案',
      content: p.name,
      editable: true,
      placeholderText: p.name,
      success(res) {
        if (res.confirm && res.content && res.content.trim()) {
          profile.rename(id, res.content.trim())
          that.refresh()
          wx.showToast({ title: '已保存', icon: 'success' })
        }
      }
    })
  },

  changeMode(e) {
    const id = e.currentTarget.dataset.id
    const p = profile.get(id)
    if (!p) return
    const that = this
    wx.showActionSheet({
      itemList: ['标准模式', '儿童模式（字大、简单）', '长辈模式（超大字）'],
      success(r) {
        const mode = ['normal', 'kid', 'elder'][r.tapIndex] || 'normal'
        profile.setMode(id, mode)
        that.refresh()
        wx.showToast({ title: '已设为' + MODE_NAMES[mode], icon: 'none' })
      }
    })
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    const p = profile.get(id)
    if (!p) return
    const that = this
    wx.showModal({
      title: '删除档案',
      content: '确定删除「' + p.name + '」吗？该档案的进度、统计和录音都会一起删除，无法恢复。',
      confirmText: '删除',
      confirmColor: '#E5484D',
      success(res) {
        if (!res.confirm) return
        const r = profile.remove(id)
        if (!r.ok) { wx.showToast({ title: r.reason, icon: 'none' }); return }
        that.refresh()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  }
})
