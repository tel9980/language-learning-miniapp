// 语言元信息：不依赖词库数据，谁都能引（首页只需要这个，不必为了国旗解析 94KB 词库）
//
// tts  ：微信同声传译插件用的语种码（en-US），连字符
// voice：有道 / 百度 / 本地音频那条链用的语种码（en_US），下划线
// 两者格式不同，别混用。
const LANGS = {
  en: { name: '英语', flag: '🇬🇧', tts: 'en-US', voice: 'en_US' },
  ja: { name: '日语', flag: '🇯🇵', tts: 'ja-JP', voice: 'ja_JP' },
  // 越南语没有任何可用的在线合成（有道/百度都没越南语音色、同声传译只支持中英文），
  // 全部发音走预生成 mp3（utils/local-audio.js），所以 tts 字段实际上用不到，
  // 留着只是为了结构统一。
  vi: { name: '越南语', flag: '🇻🇳', tts: 'vi-VN', voice: 'vi_VN' },
  // 韩语：单词能用有道（必须带 le=ko，不带返回 0.1 秒空音），整句有道 500、百度失败，
  // 所以句子全部走预生成 mp3。同声传译只支持中英文，tts 字段实际用不到。
  ko: { name: '韩语', flag: '🇰🇷', tts: 'ko-KR', voice: 'ko_KR' }
}

const LANG_KEYS = Object.keys(LANGS)

function getLangMeta(lang) {
  return LANGS[lang] || LANGS.en
}

// 把任意值收成受支持的语种码（未知一律当英语）
function normalizeLang(lang) {
  return LANGS[lang] ? lang : 'en'
}

module.exports = { LANGS, LANG_KEYS, getLangMeta, normalizeLang }
