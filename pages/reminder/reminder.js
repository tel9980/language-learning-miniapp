const theme = require('../../utils/theme')
const storage = require('../../utils/storage')

const KEY_REMINDER = 'lp_reminder_v1'
// 订阅消息模板 id：零后端项目没有申请，留空即表示「只能记偏好、推不出去」。
// 将来接了微信云开发拿到模板 id，填在这里即可让页面自动改口。
const TM_PLID = ''

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
    // 有没有订阅消息能力，只能看「后台有没有申请到模板 id」，不是看 API 存不存在。
    // 本项目零后端、没有模板 id，所以这里恒为 false —— 页面据此说明「收不到通知」的原因。
    const supported = !!(wx.requestSubscribeMessage && TM_PLID)
    this.setData({ enabled: r.enabled, time: r.time, supported })
  },
  toggle() {
    const v = !this.data.enabled
    // 以前这里有 wx.requestSubscribeMessage({ tmplIds: [] })：
    // 模板 id 不能为空，这个调用必然失败，每次开提醒都会在控制台报一次错，
    // 而 complete 里照样写偏好 —— 等于「调用只为报错」。没有模板 id 就干脆不调。
    write({ enabled: v, time: this.data.time })
    this.setData({ enabled: v })
    wx.showToast({ title: v ? '已记录提醒偏好' : '已关闭', icon: 'none' })
  },
  changeTime(e) {
    const time = e.detail.value
    const r = read(); r.time = time; write(r)
    this.setData({ time })
  }
})
