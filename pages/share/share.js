const theme = require('../../utils/theme')
const profile = require('../../utils/profile')
const storage = require('../../utils/storage')
const shareCopy = require('../../utils/share-copy')

Page({
  behaviors: [theme],
  data: { myName: '我', inviteTitle: '', inviteDesc: '' },
  onShow() {
    this.syncTheme()
    const p = profile.currentProfile() || { name: '我' }
    this.setData({
      myName: p.name,
      inviteTitle: shareCopy.title({ lang: storage.getCurrentLang() }),
      inviteDesc: shareCopy.invite({ lang: storage.getCurrentLang(), name: p.name })
    })
  },
  onShareAppMessage() {
    return {
      title: this.data.inviteTitle,
      path: '/pages/index/index',
      imageUrl: ''
    }
  },
  copyInvite() {
    wx.setClipboardData({
      data: this.data.inviteDesc + '\n小程序搜索「语伴」或从我分享的卡片点进来即可。',
      success() { wx.showToast({ title: '邀请文案已复制', icon: 'success' }) }
    })
  }
})
