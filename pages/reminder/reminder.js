const theme = require('../../utils/theme')
const storage = require('../../utils/storage')

const KEY_REMINDER = 'lp_reminder_v1'

function read() {
  try { return wx.getStorageSync(KEY_REMINDER) || { enabled: false, time: '20:00' } } catch (e) { return { enabled: false, time: '20:00' } }
}
function write(v) { try { wx.setStorageSync(KEY_REMINDER, v) } catch (e) {} }

Page({
  behaviors: [theme],
  data: { enabled: false, time: '20:00', supported: false },
  onShow() {
    this.syncTheme()
    const r = read()
    // 订阅消息能力：真机且基础库支持
    let supported = false
    try { supported = !!(wx.requestSubscribeMessage) } catch (e) {}
    this.setData({ enabled: r.enabled, time: r.time, supported })
  },
  toggle() {
    const that = this
    const v = !this.data.enabled
    if (v && this.data.supported) {
      // 尝试申请一次订阅授权；真正定时推送需后端+模板id（见页面说明）
      try {
        wx.requestSubscribeMessage({
          tmplIds: [],
          success() {},
          fail() {},
          complete() {
            write({ enabled: v, time: that.data.time })
            that.setData({ enabled: v })
            wx.showToast({ title: v ? '已记录提醒偏好' : '已关闭', icon: 'none' })
          }
        })
      } catch (e) {
        write({ enabled: v, time: that.data.time }); that.setData({ enabled: v })
      }
    } else {
      write({ enabled: v, time: that.data.time })
      this.setData({ enabled: v })
      wx.showToast({ title: v ? '已记录提醒偏好' : '已关闭', icon: 'none' })
    }
  },
  changeTime(e) {
    const time = e.detail.value
    const r = read(); r.time = time; write(r)
    this.setData({ time })
  }
})
