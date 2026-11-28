// 原生外观（第十四轮）：底部 tabBar 与窗口背景是**原生层**，不吃 wxss。
// app.json 里的 tabBar.backgroundColor / window.backgroundColor / page{background}
// 都是静态值，所以深色模式以前只管页面内部——页面全黑、底栏一条白、下拉回弹闪浅灰。
//
// 为什么放在这里而不是只放 app.js 的 applyTheme：
// onLaunch 时 tabBar 可能还没建好，那时调 setTabBarStyle 有概率不生效；
// 页面每次 onShow 都会走 theme Behavior 的 syncTheme，从这里再兜一次最稳。
// 用 _applied 记住上次的值，重复调用直接返回，不会每页都发一次跨线程调用。
const DARK_BG = '#1A1F2B'   // 与 app.wxss 的 .theme-dark 底色一致
const LIGHT_BG = '#F5F7FB'  // 与 app.json 的 window.backgroundColor / page 背景一致
const DARK_ON = '#8FA8FF'   // #4A6CF7 压在 #1A1F2B 上对比度只有 3.13，深色下提亮
const LIGHT_ON = '#4A6CF7'

let _applied = null

function apply(dark) {
  const on = !!dark
  if (_applied === on) return
  _applied = on
  if (typeof wx === 'undefined') return
  if (typeof wx.setTabBarStyle === 'function') {
    try {
      wx.setTabBarStyle({
        backgroundColor: on ? DARK_BG : '#FFFFFF',
        color: '#8A94A6',
        selectedColor: on ? DARK_ON : LIGHT_ON,
        borderStyle: 'black'
      })
    } catch (e) {}
  }
  if (typeof wx.setBackgroundColor === 'function') {
    const bg = on ? DARK_BG : LIGHT_BG
    try {
      // backgroundColorTop/Bottom 要一起给，iOS 下拉回弹露出的是这两个
      wx.setBackgroundColor({ backgroundColor: bg, backgroundColorTop: bg, backgroundColorBottom: bg })
    } catch (e) {}
  }
}

// 测试用：清掉缓存，让下一次 apply 真的发调用
function reset() { _applied = null }

module.exports = { apply, reset, DARK_BG, LIGHT_BG, DARK_ON, LIGHT_ON }
