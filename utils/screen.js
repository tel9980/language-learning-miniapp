// 屏幕常亮（第十一轮）
//
// 为什么需要：全项目之前 0 处 setKeepScreenOn。口语页跟读一段长句、
// 听写页想 20 秒，都是「手不动、眼在看」的场景，最容易被系统判成无操作而息屏。
// 息屏的后果不是「暗一下」——录音会中断、播放会停，用户回来发现白练了。
//
// 只在这两个页面开（口语、听写），其它页面不开，省电。
function on() {
  if (typeof wx === 'undefined' || typeof wx.setKeepScreenOn !== 'function') return
  try { wx.setKeepScreenOn({ keepScreenOn: true }) } catch (e) {}
}

function off() {
  if (typeof wx === 'undefined' || typeof wx.setKeepScreenOn !== 'function') return
  try { wx.setKeepScreenOn({ keepScreenOn: false }) } catch (e) {}
}

// 页面卸载/隐藏时一定要关，否则用户离开后手机一直亮着（很耗电，也招人烦）
module.exports = { on: on, off: off }