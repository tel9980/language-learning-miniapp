// 统一跳转：tabBar 页面只能用 wx.switchTab（navigateTo 会静默失败），
// 而 switchTab 又不支持 query 参数，所以用「意图」暂存的方式跨 tab 传参。
const INTENT_KEY = 'lp_nav_intent_v1'

// 意图的有效期（第十四轮）：以前只在「目标页正好取走」时才删，目标页没被打开
// （switchTab 失败、用户中途改主意）时这个意图会永久留着——很久以后用户进那个 tab，
// 会突然跳到一个陌生词，完全没有上下文。超过这个时间就当没说过。
const INTENT_TTL = 60 * 1000

// 必须在 app.json tabBar.list 里
const TAB_PAGES = [
  'pages/index/index',
  'pages/speak/speak',
  'pages/learn/learn',
  'pages/quiz/quiz',
  'pages/stats/stats'
]

function normalize(url) {
  return String(url || '').split('?')[0].replace(/^\//, '')
}

function isTabPage(url) {
  return TAB_PAGES.indexOf(normalize(url)) >= 0
}

// 跳转。url 可带 ?query（仅非 tabBar 页生效）；intent = { page, ... } 用于跨 tab 传参
function go(url, intent) {
  if (!url) return
  const path = normalize(url)
  if (isTabPage(url)) {
    if (intent) {
      try {
        intent.page = path
        intent.ts = Date.now()
        wx.setStorageSync(INTENT_KEY, intent)
      } catch (e) {}
    }
    wx.switchTab({ url: '/' + path })
    return
  }
  wx.navigateTo({ url: url })
}

// 目标页在 onShow 里调用：取走属于自己的意图（只看一次，取完即删）
function takeIntent(page) {
  const key = String(page || '').replace(/^\//, '')
  try {
    const v = wx.getStorageSync(INTENT_KEY)
    if (!v) return null
    const intent = typeof v === 'string' ? JSON.parse(v) : v
    if (!intent) return null
    // 过期的（或者压根不是给我的）顺手清掉，免得一直躺在 storage 里
    if (intent.ts && Date.now() - intent.ts > INTENT_TTL) {
      wx.removeStorageSync(INTENT_KEY)
      return null
    }
    if (intent.page !== key) return null
    wx.removeStorageSync(INTENT_KEY)
    return intent
  } catch (e) {
    return null
  }
}

// 兼容：不带意图的普通跳转
function to(url) { go(url, null) }

module.exports = { go, to, takeIntent, isTabPage, TAB_PAGES, INTENT_KEY, INTENT_TTL }
