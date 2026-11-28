// 统一的音频上下文工厂（第十三轮）
//
// 为什么单独一个模块：iOS 侧边的「静音开关」默认会把 InnerAudioContext 一起静音。
// 表现是「点了播放、按钮动画走了、一点声音都没有」，而且**不报错**、不触发 onError，
// 降级链（本地 → 流播 → 在线源 → 插件）走的全是这个被静音的通道，连日志都抓不到。
// 静音开关常开是很多人的默认状态（开会、上班、通勤），对学习类 app 这是致命的：
// 用户只会认为「这个 app 的发音坏了」，然后卸载。
//
// 所以全项目统一从这里创建上下文，统一设 obeyMuteSwitch = false ——
// 只忽略静音开关，音量键仍然有效，取舍跟词典 / 播客 / 音乐类 app 一致。
//
// 以后加新的播放点请用它，不要直接调 wx.createInnerAudioContext()。
// （tests/run-tests.js 有一条守门断言：除本文件外不应再出现裸的 createInnerAudioContext）
function create() {
  const ctx = wx.createInnerAudioContext()
  // 部分老基础库不认这个属性，赋值不生效但也不报错；包一层 try 只为极端环境
  try { ctx.obeyMuteSwitch = false } catch (e) {}
  return ctx
}

module.exports = { create: create }
