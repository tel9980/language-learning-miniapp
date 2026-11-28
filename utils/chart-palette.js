// 图表配色（第十一轮）
//
// 为什么单独一个模块：console 画的 canvas 完全不知道主题 —— 之前两个绘图函数里
// 颜色全是写死的浅色，切深色后网格变刺眼白线、折线又不达标。
//
// 实测对比度（WCAG，相对卡片底色）：
//                 浅色底 #FFFFFF   深色底 #262D3D
//   #EEF1FB 网格      1.13（看不见）   12.2（刺眼白线）
//   #B7BFCC 轴标      1.85            7.43
//   #4A6CF7 折线      4.39            3.13（低于 AA 4.5）
// 下面这两组是重新选的：浅色下网格能看见但不抢，深色下折线够亮。
function palette(dark) {
  if (dark) {
    return {
      grid: '#3B455C',      // 网格：深底上略亮一点，看得出分格又不刺眼
      label: '#9AA3B5',     // 轴刻度 / 日期：与 .muted 同色，统一
      line: '#8FA8FF',      // 折线 / 数据点 / 数值：与 .stage-word 深色同色
      barTop: '#A9BCFF',    // 柱子渐变顶
      barBottom: '#8FA8FF'  // 柱子渐变底
    }
  }
  return {
    grid: '#E1E7F5',
    label: '#6B7688',
    line: '#4A6CF7',
    barTop: '#6E8BFF',
    barBottom: '#4A6CF7'
  }
}

module.exports = { palette: palette }