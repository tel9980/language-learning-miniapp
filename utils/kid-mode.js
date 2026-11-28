// 儿童模式的边界集中在这里，页面只问一句「要不要」：
//   1. 分类只留适龄的（四级/六级/考研/雅思托福/财务/工作/科技 藏起来）
//   2. 到点该不该提醒休息（15 / 30 分钟两档，具体怎么弹见 utils/practice-timer.js）
// 为什么单独一个文件：这些取舍会随家长反馈变，散落在各页面就会改一处漏两处。

// 藏掉的分类：全是考试/职场向，8 岁孩子用不上，放进去只会把新词流量带偏
const KID_HIDE = ['四级', '六级', '考研', '雅思托福', '财务', '工作', '科技']
// 儿童模式默认落在「日常」而不是「全部分类」：否则一进来就是 abandon / accommodate
const KID_DEFAULT_CAT = '日常'

// 休息提醒节点（分钟）
const REST_STEPS = [15, 30]

function filterCategories(cats) {
  return (cats || []).filter(function (c) { return KID_HIDE.indexOf(c.name) < 0 })
}

function hideCategory(name) {
  return KID_HIDE.indexOf(name) >= 0
}

// 页面统一走这里拿词：儿童模式下只返回适龄分类。
// 上次只过滤了学习页和测验，漏了听写、今日待练和学习页的总数，
// 「只留基础分类」就成了空话——所以收敛成一个函数，新页面照抄不会漏。
function allowedWords(words, isKid) {
  const list = words || []
  if (!isKid) return list
  return list.filter(function (w) { return w && !hideCategory(w.category) })
}

// 从页面推断当前是不是儿童模式（页面都有 theme behavior 给的 isKid）
function isKidOf(page) {
  return !!(page && page.data && page.data.isKid)
}

module.exports = {
  KID_HIDE: KID_HIDE,
  KID_DEFAULT_CAT: KID_DEFAULT_CAT,
  REST_STEPS: REST_STEPS,
  filterCategories: filterCategories,
  hideCategory: hideCategory,
  allowedWords: allowedWords,
  isKidOf: isKidOf
}
