// 本地文件配额账本
//
// 微信给的本地文件空间是「每个小程序 × 每个微信账号」一份，合计 10MB，不能扩容：
//   · wx.saveFile 落盘的录音            → utils/recordings.js
//   · USER_DATA_PATH 里的发音缓存       → utils/tts-cache.js
//   · 从代码包复制出来的离线音频        → utils/pkg-audio.js
// 三者共用同一份空间。
//
// 以前各模块各自按「整份 10MB 都归我」来算（录音 8MB + 缓存 3MB = 11MB），
// 超出的那部分谁后写谁失败，而且失败是静默的 —— 用户只会看到「录音存不下来」
// 或者「这句突然没声音」，很难联想到是另一块在占地方。
//
// 现在统一在这里分配：各模块都从这里取上限，加起来不超过可用额度。
// 再加一层兜底：录音写失败时会主动去清发音缓存（见 recordings.js 的 fail 分支），
// 因为「录音是用户自己产生的内容，缓存随时可以重新下载」，牺牲顺序就此确定。
const TOTAL_BYTES = 10 * 1024 * 1024        // 平台硬上限
const RESERVE_BYTES = 1.5 * 1024 * 1024     // 留给临时文件与系统回收的余量
const USABLE_BYTES = TOTAL_BYTES - RESERVE_BYTES
const RECORDINGS_BYTES = 5 * 1024 * 1024    // 录音：用户资产，给大头
const PKG_AUDIO_BYTES = 2 * 1024 * 1024     // 代码包音频的副本：可重建
const TTS_BYTES = USABLE_BYTES - RECORDINGS_BYTES - PKG_AUDIO_BYTES   // 在线发音缓存：1.5MB

module.exports = { TOTAL_BYTES, RESERVE_BYTES, USABLE_BYTES, RECORDINGS_BYTES, PKG_AUDIO_BYTES, TTS_BYTES }
