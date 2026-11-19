// 进度表分片的 key 命名规则。
// 单独一个模块是为了让「谁需要碰这些 key」都能引同一份定义：
// storage.js 读写、profile.js 删档案要清、family-backup.js 导出要合并成整表。
// 分片数改成别的值时，老数据会被 loadProgress 重新合并后按新分片重写一次。
const SHARDS = 8

function shardIndexOf(id) {
  const k = String(id)
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) & 0xffff
  return h % SHARDS
}

// 以「未加档案命名空间」的形态给出，调用方自己过 profile.nsKey()
function shardKeyAt(i) { return 'lp_progress_v1_s' + i }

function shardKeys() {
  const out = []
  for (let i = 0; i < SHARDS; i++) out.push(shardKeyAt(i))
  return out
}

module.exports = { SHARDS, shardIndexOf, shardKeyAt, shardKeys }
