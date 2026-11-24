const theme = require('../../utils/theme')
const storage = require('../../utils/storage')

// 声纹授权协议页。
//
// 为什么单独做一页而不是一个弹窗：微信审核明确要求「增加独立的《声纹授权协议》」，
// 弹窗容易被判定为「未提供独立协议」；而且用户事后要能随时回来查看、撤回。
//
// 授权结果落在 settings.voiceprintAgreed，口语页在真正开录音之前检查它。
// 撤回授权只影响录音，不影响学单词/查词/听写/测验这些不用麦克风的功能。
Page({
  behaviors: [theme],
  data: {
    agreed: false,
    agreedAt: '',
    from: ''        // 'record' 表示是从口语页「要录音了」跳过来的，同意后自动返回
  },
  onLoad(q) {
    this.setData({ from: (q && q.from) || '' })
  },
  onShow() {
    this.syncTheme()
    const s = storage.getSettings()
    this.setData({ agreed: !!s.voiceprintAgreed, agreedAt: s.voiceprintAgreedAt || '' })
  },
  agree() {
    storage.setVoiceprintAgreed(true)
    this.setData({ agreed: true, agreedAt: storage.getSettings().voiceprintAgreedAt || '' })
    wx.showToast({ title: '已同意，可以录音了', icon: 'success' })
    const that = this
    setTimeout(function () {
      // 从录音入口跳过来的，同意完直接退回口语页，省一次手动返回
      if (that.data.from === 'record' && getCurrentPages().length > 1) wx.navigateBack()
    }, 600)
  },
  revoke() {
    wx.showModal({
      title: '撤回声纹授权',
      content: '撤回后不再采集录音，已经存在本机的录音也可以一并删除。其它功能不受影响。',
      confirmText: '撤回',
      success(res) {
        if (!res.confirm) return
        storage.setVoiceprintAgreed(false)
        wx.showToast({ title: '已撤回授权', icon: 'none' })
      }
    })
  },
  deleteRecordings() {
    wx.showModal({
      title: '删除全部录音',
      content: '会删掉这台手机上保存的所有跟读录音，删了不能恢复。',
      confirmText: '删除',
      confirmColor: '#E45C5C',
      success(res) {
        if (!res.confirm) return
        const recordings = require('../../utils/recordings')
        recordings.clear()
        wx.showToast({ title: '录音已删除', icon: 'success' })
      }
    })
  }
})
