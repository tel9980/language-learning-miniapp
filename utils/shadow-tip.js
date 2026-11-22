// 影子跟读的时长判断：只比「说了多久」，不比音色。
//
// 为什么只比时长：小程序这一侧拿不到录音的频谱，程序判断不了 /θ/ 读得对不对，
// 但「比标准音慢了 0.9 秒」是算得出来的，而且正好对应初学者最常犯的两个毛病——
// 卡顿和吞音。所以这里只输出节奏结论，音准交给自评 / 智聆 / AI 听音。
const TOLERANCE = 0.15   // ±15% 以内算节奏对得上
const MIN_STD = 400      // 标准音短于 0.4 秒时（单个单词），比值没有意义

function tip(stdMs, recMs) {
  const std = stdMs || 0
  const mine = recMs || 0
  if (!std || !mine || std < MIN_STD) return '先跟住节奏，再抠发音。'
  const diff = Math.abs(mine - std)
  const stdS = (std / 1000).toFixed(1)
  const mineS = (mine / 1000).toFixed(1)
  if (diff / std <= TOLERANCE) {
    return '节奏对得上（标准音 ' + stdS + 's / 你 ' + mineS + 's），可以开始抠发音了。'
  }
  if (mine > std) {
    return '你比标准音慢了 ' + (diff / 1000).toFixed(1) + 's（' + stdS + 's / ' + mineS + 's），中间卡顿了，先顺一遍再提速。'
  }
  return '你比标准音快了 ' + (diff / 1000).toFixed(1) + 's（' + stdS + 's / ' + mineS + 's），注意别吞音，尤其词尾辅音。'
}

module.exports = { tip, TOLERANCE, MIN_STD }
