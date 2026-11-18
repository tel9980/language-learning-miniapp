// 列表增量渲染工具：小程序 setData 传大数组会明显卡顿（尤其是低端机），
// 统一改成「先渲染前 N 条，下滑再追加」，页面只持有已渲染的部分。
//
// 设计要点：total 由 reset() 记住，hasMore / more() 都基于 total 自洽，
// 不依赖调用方先调 slice()，避免出现「忘记 slice 导致无限加载」。
//
// 用法：
//   const pager = require('../../utils/pager')
//   const p = pager.create(30)       // 每页 30 条
//   p.reset(list.length)             // 新查询：回到第一页
//   p.slice(list)                    // 取当前该渲染的片段
//   p.more()                         // 加载更多（false = 没有更多了）
//   p.hasMore                        // 是否还有更多
const DEFAULT_PAGE_SIZE = 30

function create(pageSize) {
  const size = Math.max(1, pageSize || DEFAULT_PAGE_SIZE)
  return {
    size: size,
    count: size,
    total: 0,
    get hasMore() { return this.total > this.count },
    // 新一次查询：重置到第一页并记住总量
    reset(total) {
      this.total = Math.max(0, total || 0)
      this.count = size
      return this.count
    },
    // 取当前应渲染的片段（不改状态）
    slice(list) {
      return (list || []).slice(0, this.count)
    },
    // 加载更多：没有更多时返回 false（状态自洽，可安全循环调用）
    more() {
      if (!this.hasMore) return false
      this.count += size
      return true
    }
  }
}

module.exports = { create, DEFAULT_PAGE_SIZE }
