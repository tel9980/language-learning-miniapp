// 录音持久化：把录音临时文件保存到本地永久文件，存元数据到 Storage。
// 注意：音频文件用 wx.saveFile 落盘（不进 Storage，避免 base64 撑爆 10MB）。
// 只保留最近 N 条，超出删除最旧文件，防止占满小程序 200MB 本地空间。

const KEY = 'lp_recordings_v1'
const MAX_KEEP = 30
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

// 保存一条录音：tempFilePath 是 RecorderManager.onStop 给的临时路径
// meta: { itemId, label, cn, kind, score?, recognized?, q? }
function save(tempFilePath, meta) {
  if (!tempFilePath) return null
  const entry = Object.assign({
    id: 'r_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    createdAt: Date.now()
  }, meta || {})
  return new Promise((resolve) => {
    wx.saveFile({
      tempFilePath,
      success(res) {
        entry.filePath = res.savedFilePath
        const list = read()
        list.unshift(entry)
        const keep = list.slice(0, MAX_KEEP)
        write(keep)
        // 删除超出的旧文件
        list.slice(MAX_KEEP).forEach(old => {
          if (old.filePath) wx.removeSavedFile({ filePath: old.filePath, fail() {} })
        })
        resolve(entry)
      },
      fail() { resolve(null) }
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
  read().forEach(x => { if (x.filePath) wx.removeSavedFile({ filePath: x.filePath, fail() {} }) })
  write([])
}

module.exports = { save, list, remove, clear, MAX_KEEP }
