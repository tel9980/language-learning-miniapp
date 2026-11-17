const theme = require('../../utils/theme')
const profile = require('../../utils/profile')

Page({
  behaviors: [theme],
  data: { myName: '我', inviteTitle: '', inviteDesc: '' },
  onShow() {
    this.syncTheme()
    const p = profile.currentProfile() || { name: '我' }
    this.setData({
      myName: p.name,
      inviteTitle: '来和我一起练口语｜语伴',
      inviteDesc: p.name + '邀请你一起用「语伴」练英语口语，点开就能试，免费～'
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
