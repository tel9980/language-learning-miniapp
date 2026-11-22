// 线上日志：真机上 console.error 只有在开了 vConsole 或接着调试器时才看得见。
// 用户白屏不会专门来告诉你，所以必须有地方把错误留下来。
//
// 走微信自带的「实时日志」：日志进小程序后台 → 运维中心 → 实时日志，
// 不需要自己的服务器、不需要域名备案，也不占本地存储（保留 7 天，每天有配额）。
// 基础库 2.7.3+ 才有这个 API，老版本自动退化成只有 console，不影响功能。
const MAX_LEN = 400
let _lm = null

function lm() {
  if (_lm !== null) return _lm
  try {
    _lm = (wx.getRealtimeLogManager && wx.getRealtimeLogManager()) || false
  } catch (e) {
    _lm = false
  }
  return _lm
}

// 日志参数可能是 Error、对象、数组：一次只能传字符串，所以先拼成一行
function flatten(args) {
  const out = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    let s
    if (a instanceof Error) s = a.message + (a.stack ? ' | ' + a.stack.split('\n').slice(0, 3).join(' ') : '')
    else if (typeof a === 'string') s = a
    else {
      try { s = JSON.stringify(a) } catch (e) { s = String(a) }
    }
    out.push(s === undefined ? '' : String(s))
  }
  const line = out.join(' ')
  return line.length > MAX_LEN ? line.slice(0, MAX_LEN) + '…' : line
}

function write(level, args) {
  const line = flatten(args)
  try {
    if (typeof console !== 'undefined' && console[level]) console[level].apply(console, args)
  } catch (e) {}
  const m = lm()
  if (!m) return
  try {
    const fn = m[level] || m.info
    if (typeof fn === 'function') fn.call(m, line)
  } catch (e) {}
}

function info() { write('info', Array.prototype.slice.call(arguments)) }
function warn() { write('warn', Array.prototype.slice.call(arguments)) }
function error() { write('error', Array.prototype.slice.call(arguments)) }

// 给每条日志带上页面路径：后台里一堆「未捕获错误」时，先要知道是哪个页面
function withPage(page, msg) {
  return (page ? '[' + page + '] ' : '') + msg
}

module.exports = { info, warn, error, withPage, available: function () { return !!lm() } }
