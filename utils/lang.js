// 语言元信息：不依赖词库数据，谁都能引（首页只需要这个，不必为了国旗解析 94KB 词库）
//
// tts  ：微信同声传译插件用的语种码（en-US），连字符
// voice：有道 / 百度 / 本地音频那条链用的语种码（en_US），下划线
// 两者格式不同，别混用。
const LANGS = {
  en: { name: '英语', flag: '🇬🇧', tts: 'en-US', voice: 'en_US' },
  ja: { name: '日语', flag: '🇯🇵', tts: 'ja-JP', voice: 'ja_JP' }
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
