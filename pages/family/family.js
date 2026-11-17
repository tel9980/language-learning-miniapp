const theme = require('../../utils/theme')
const family = require('../../utils/family')

Page({
  behaviors: [theme],
  data: { rows: [], sortKey: 'todaySpeak' },
  onShow() { this.syncTheme(); this.refresh() },
  refresh() { this.setData({ rows: family.leaderboard() }) },
  setSort(e) {
    const key = e.currentTarget.dataset.key
    const rows = family.leaderboard()
    rows.sort(function (a, b) { return (b[key] - a[key]) || (b.streak - a.streak) })
    rows.forEach(function (r, i) { r.rank = i + 1 })
    this.setData({ rows, sortKey: key })
  }
})
