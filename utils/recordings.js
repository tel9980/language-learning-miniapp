// 录音持久化：把录音临时文件保存到本地永久文件，存元数据到 Storage。
// 注意：音频文件用 wx.saveFile 落盘（不进 Storage，避免 base64 撑爆 10MB）。
//
// 容量口径（微信平台限制，与手机剩余空间无关）：
//   · 本地文件目录（wx.saveFile / wx.env.USER_DATA_PATH）每个小程序每个用户 10MB
//   · Storage（wx.setStorageSync）每个小程序每个用户 10MB
// 这份 10MB 是和发音缓存（utils/tts-cache.js）共用的一份空间，额度分配见 utils/file-budget.js。
// 录音是 16kHz 单声道 mp3，60 秒约 200KB；30 条上限 ≈ 6MB，正好等于分到的 6MB 额度，
// 通常是先撞条数而不是体积 —— 但两条线都留着更稳：有人反复录满 60 秒时体积会先到线。
const KEY = 'lp_recordings_v1'
const MAX_KEEP = 30
const budget = require('./file-budget')
const MAX_BYTES = budget.RECORDINGS_BYTES
const profile = require('./profile')

function read() {
  try {
    const v = wx.getStorageSync(profile.nsKey(KEY))
    return v ? JSON.parse(v) : []
  } catch (e) { return [] }
}
function write(list) {
  try { wx.setStorageSync(profile.nsKey(KEY), JSON.stringify(list)) } catch (e) {}
}

// 取文件体积（拿不到就当 0，不影响保存流程）
function fileSize(path) {
  return new Promise((resolve) => {
    if (!path || typeof wx.getFileInfo !== 'function') return resolve(0)
    wx.getFileInfo({
      filePath: path,
      success(res) { resolve(res.size || 0) },
      fail() { resolve(0) }
    })
  })
}

// 双重淘汰：先按条数，再按总体积；都从最旧的删。
// 返回 { keep, dropped }，真正删文件由调用方做（便于测试）。
function trim(list) {
  const keep = list.slice(0, MAX_KEEP)
  const dropped = list.slice(MAX_KEEP)
  let total = keep.reduce((sum, e) => sum + (e.size || 0), 0)
  while (keep.length > 1 && total > MAX_BYTES) {
    const last = keep.pop()
    dropped.push(last)
    total -= (last.size || 0)
  }
  return { keep, dropped }
}

function removeFiles(list) {
  list.forEach(old => { if (old.filePath) wx.removeSavedFile({ filePath: old.filePath, fail() {} }) })
}

// 保存一条录音：tempFilePath 是 RecorderManager.onStop 给的临时路径
// meta: { itemId, label, cn, kind, score?, recognized?, q? }
// retried：内部用，表示已经删掉最旧一条并重试过
// freed：内部用，表示已经压过发音缓存（不再重复压）
function save(tempFilePath, meta, retried, freed) {
  if (!tempFilePath) return Promise.resolve(null)
  const entry = Object.assign({
    id: 'r_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    createdAt: Date.now()
  }, meta || {})
  return new Promise((resolve) => {
    wx.saveFile({
      tempFilePath,
      success(res) {
        entry.filePath = res.savedFilePath
        fileSize(res.savedFilePath).then((size) => {
          entry.size = size
          const list = read()
          list.unshift(entry)
          const result = trim(list)
          write(result.keep)
          removeFiles(result.dropped)
          resolve(entry)
        })
      },
      fail(err) {
        // wx.saveFile 会「移动」临时文件；失败时临时文件还在，但随时会被回收。
        // 腾空间的顺序是「先删自己最旧的一条录音，再压发音缓存，最后放弃」：
        // 录音是用户自己录的资产，发音缓存随时能重新下载，所以先牺牲后者。
        // 两个模块共用一个 10MB 文件配额，额度分配见 utils/file-budget.js。
        const list = read()
        const oldest = list[list.length - 1]
        if (!retried && oldest && oldest.filePath) {
          console.warn('[recordings] 落盘失败，删最旧一条后重试', oldest.id, err && err.errMsg)
          wx.removeSavedFile({ filePath: oldest.filePath, fail() {} })
          write(list.slice(0, -1))
          resolve(save(tempFilePath, meta, true, freed))
          return
        }
        if (!freed) {
          // 录音那边已经腾过了（或者本来就没有可删的），去压发音缓存：只保留四分之一额度。
          let dropped = 0
          try { dropped = require('./tts-cache').trim(budget.TTS_BYTES >> 2) } catch (e) {}
          console.warn('[recordings] 落盘失败，清理发音缓存 ' + dropped + ' 条后重试', err && err.errMsg)
          resolve(save(tempFilePath, meta, true, true))
          return
        }
        console.error('[recordings] 落盘失败，录音未保存', tempFilePath, err)
        resolve(null)
      }
    })
  })
}

function list() { return read() }

function remove(id) {
  const list = read()
  const target = list.find(x => x.id === id)
  if (target && target.filePath) wx.removeSavedFile({ filePath: target.filePath, fail() {} })
  write(list.filter(x => x.id !== id))
}

function clear() {
  removeFiles(read())
  write([])
}

module.exports = { save, list, remove, clear, trim, MAX_KEEP, MAX_BYTES }
