// 儿童模式的两条边界集中在这里，页面只问一句「要不要」：
//   1. 分类只留适龄的（四级/六级/考研/雅思托福/财务/工作/科技 藏起来）
//   2. 练习时长与休息提醒（15 分钟一次、30 分钟一次，每天各弹一次）
// 为什么单独一个文件：这些取舍会随家长反馈变，散落在各页面就会改一处漏两处。
const storage = require('./storage')

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

// 练了这么久，要不要提醒休息？返回要弹的分钟数（0 = 不用弹）
function restDue() {
  const mins = Math.floor(storage.getPracticeSeconds() / 60)
  for (let i = 0; i < REST_STEPS.length; i++) {
    const step = REST_STEPS[i]
    if (mins >= step && !storage.kidRestSeen(String(step))) {
      storage.markKidRestSeen(String(step))
      return step
    }
  }
  return 0
}

module.exports = {
  KID_HIDE: KID_HIDE,
  KID_DEFAULT_CAT: KID_DEFAULT_CAT,
  REST_STEPS: REST_STEPS,
  filterCategories: filterCategories,
  hideCategory: hideCategory,
  restDue: restDue
}
