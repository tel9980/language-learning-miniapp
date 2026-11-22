// 离线音频清单（自动生成，不要手改）
//
// 生成：node tools/dump-items.js ja /tmp/ja_items.json
//       python3 tools/gen-audio.py --lang ja --items /tmp/ja_items.json --out audio-src/ja
//       node tools/gen-local-audio.js
//
// 为什么不走在线合成：日语整句找不到可靠的免费源——有道 dictvoice 只对单词有效
// （且必须带 le=jap），百度 lan=jap 返回 403，同声传译 textToSpeech 只列中英文。
// 英语虽然有在线源，但学英语最常练，预生成音频能保证首句秒开、不被网络抖动影响。
//
// mp3 不进代码包（真机读不到包内文件），只放仓库 audio-src/，由 CI 铺到 Cloudflare Pages；
// 这里只维护「哪个 id 有音频、CDN 地址是什么」，见 remoteFor()。

const REGION = {
  ja: {
    remote: 'https://yb.qy663.de5.net/audio/',
    count: 353,
    bytes: 1912840,
    ids: 'ja_001 ja_001_ex ja_002 ja_002_ex ja_003 ja_003_ex ja_004 ja_004_ex ja_005 ja_005_ex ja_006 ' +
      'ja_006_ex ja_007 ja_007_ex ja_008 ja_008_ex ja_009 ja_009_ex ja_010 ja_010_ex ja_011 ja_011_ex ' +
      'ja_012 ja_012_ex ja_013 ja_013_ex ja_014 ja_014_ex ja_015 ja_015_ex ja_016 ja_016_ex ja_017 ' +
      'ja_017_ex ja_018 ja_018_ex ja_019 ja_019_ex ja_020 ja_020_ex ja_021 ja_021_ex ja_022 ja_022_ex ' +
      'ja_023 ja_023_ex ja_024 ja_024_ex ja_025 ja_025_ex ja_026 ja_026_ex ja_027 ja_027_ex ja_028 ' +
      'ja_028_ex ja_029 ja_029_ex ja_030 ja_030_ex ja_031 ja_031_ex ja_032 ja_032_ex ja_033 ja_033_ex ' +
      'ja_034 ja_034_ex ja_035 ja_035_ex ja_036 ja_036_ex ja_037 ja_037_ex ja_038 ja_038_ex ja_039 ' +
      'ja_039_ex ja_040 ja_040_ex ja_041 ja_041_ex ja_042 ja_042_ex ja_043 ja_043_ex ja_044 ja_044_ex ' +
      'ja_045 ja_045_ex ja_046 ja_046_ex ja_047 ja_047_ex ja_048 ja_048_ex ja_049 ja_049_ex ja_050 ' +
      'ja_050_ex ja_051 ja_051_ex ja_052 ja_052_ex ja_053 ja_053_ex ja_054 ja_054_ex ja_055 ja_055_ex ' +
      'ja_056 ja_056_ex ja_057 ja_057_ex ja_058 ja_058_ex ja_059 ja_059_ex ja_060 ja_060_ex ja_061 ' +
      'ja_061_ex ja_062 ja_062_ex ja_063 ja_063_ex ja_064 ja_064_ex ja_065 ja_065_ex ja_066 ja_066_ex ' +
      'ja_067 ja_067_ex ja_068 ja_068_ex ja_069 ja_069_ex ja_070 ja_070_ex ja_071 ja_071_ex ja_072 ' +
      'ja_072_ex ja_073 ja_073_ex ja_074 ja_074_ex ja_075 ja_075_ex ja_076 ja_076_ex ja_077 ja_077_ex ' +
      'ja_078 ja_078_ex ja_079 ja_079_ex ja_080 ja_080_ex ja_081 ja_081_ex ja_082 ja_082_ex ja_083 ' +
      'ja_083_ex ja_084 ja_084_ex ja_085 ja_085_ex ja_086 ja_086_ex ja_087 ja_087_ex ja_088 ja_088_ex ' +
      'ja_089 ja_089_ex ja_090 ja_090_ex ja_091 ja_091_ex ja_092 ja_092_ex ja_093 ja_093_ex ja_094 ' +
      'ja_094_ex ja_095 ja_095_ex ja_096 ja_096_ex ja_097 ja_097_ex ja_098 ja_098_ex ja_099 ja_099_ex ' +
      'ja_100 ja_100_ex ja_101 ja_101_ex ja_102 ja_102_ex ja_103 ja_103_ex ja_104 ja_104_ex ja_105 ' +
      'ja_105_ex ja_106 ja_106_ex ja_107 ja_107_ex ja_108 ja_108_ex ja_109 ja_109_ex ja_110 ja_110_ex ' +
      'jd001_1 jd001_2 jd001_3 jd001_4 jd002_1 jd002_2 jd002_3 jd002_4 jd003_1 jd003_2 jd003_3 jd004_1 ' +
      'jd004_2 jd004_3 jd004_4 jd005_1 jd005_2 jd005_3 jd005_4 jd006_1 jd006_2 jd006_3 jd006_4 jd007_1 ' +
      'jd007_2 jd007_3 jd007_4 jd007_5 jd008_1 jd008_2 jd008_3 jd008_4 jd008_5 js001 js002 js003 js004 ' +
      'js005 js006 js007 js008 js009 js010 js011 js012 js013 js014 js015 js016 js017 js018 js019 js020 ' +
      'js021 js022 js023 js024 js025 js026 js027 js028 js029 js030 js031 js032 js033 js034 js035 js036 ' +
      'js037 js038 js039 js040 js041 js042 js043 js044 js045 js046 js047 js048 js049 js050 js051 js052 ' +
      'js053 js054 js055 js056 js057 js058 js059 js060 js061 js062 js063 js064 js065 js066 js067 js068 ' +
      'js069 js070 js071 js072 js073 js074 js075 js076 js077 js078 js079 js080 js081 js082 js083 js084 ' +
      'js085 js086 js087 js088 js089 js090 js091 js092 js093 js094 js095 js096 js097 js098 js099 js100'
  },
  en: {
    remote: 'https://yb.qy663.de5.net/audio-en/',
    count: 148,
    bytes: 967208,
    ids: 'd001_1 d001_2 d001_3 d001_4 d002_1 d002_2 d002_3 d003_1 d003_2 d003_3 d004_1 d004_2 d004_3 d005_1 ' +
      'd005_2 d005_3 d006_1 d006_2 d006_3 d006_4 d007_1 d007_2 d007_3 d007_4 d008_1 d008_2 d008_3 d008_4 ' +
      's001 s002 s003 s004 s005 s006 s007 s008 s009 s010 s011 s012 s013 s014 s015 s016 s017 s018 s019 s020 ' +
      's021 s022 s023 s024 s025 s026 s027 s028 s029 s030 s031 s032 s033 s034 s035 s036 s037 s038 s039 s040 ' +
      's041 s042 s043 s044 s045 s046 s047 s048 s049 s050 s051 s052 s053 s054 s055 s056 s057 s058 s059 s060 ' +
      's061 s062 s063 s064 s065 s066 s067 s068 s069 s070 s071 s072 s073 s074 s075 s076 s077 s078 s079 s080 ' +
      's081 s082 s083 s084 s085 s086 s087 s088 s089 s090 s091 s092 s093 s094 s095 s096 s097 s098 s099 s100 ' +
      's101 s102 s103 s104 s105 s106 s107 s108 s109 s110 s111 s112 s113 s114 s115 s116 s117 s118 s119 s120'
  },
  vi: {
    remote: 'https://yb.qy663.de5.net/audio-vi/',
    count: 304,
    bytes: 1545608,
    ids: 'vd001_1 vd001_2 vd001_3 vd001_4 vd001_5 vd002_1 vd002_2 vd002_3 vd002_4 vd002_5 vd003_1 vd003_2 ' +
      'vd003_3 vd003_4 vd003_5 vd003_6 vd004_1 vd004_2 vd004_3 vd004_4 vd004_5 vd005_1 vd005_2 vd005_3 ' +
      'vd005_4 vd005_5 vd005_6 vd006_1 vd006_2 vd006_3 vd006_4 vd006_5 vd007_1 vd007_2 vd007_3 vd007_4 ' +
      'vd007_5 vd007_6 vd008_1 vd008_2 vd008_3 vd008_4 vd008_5 vd008_6 vi_001 vi_001_ex vi_002 vi_002_ex ' +
      'vi_003 vi_003_ex vi_004 vi_004_ex vi_005 vi_005_ex vi_006 vi_006_ex vi_007 vi_007_ex vi_008 ' +
      'vi_008_ex vi_009 vi_009_ex vi_010 vi_010_ex vi_011 vi_011_ex vi_012 vi_012_ex vi_013 vi_013_ex ' +
      'vi_014 vi_014_ex vi_015 vi_015_ex vi_016 vi_016_ex vi_017 vi_017_ex vi_018 vi_018_ex vi_019 ' +
      'vi_019_ex vi_020 vi_020_ex vi_021 vi_021_ex vi_022 vi_022_ex vi_023 vi_023_ex vi_024 vi_024_ex ' +
      'vi_025 vi_025_ex vi_026 vi_026_ex vi_027 vi_027_ex vi_028 vi_028_ex vi_029 vi_029_ex vi_030 ' +
      'vi_030_ex vi_031 vi_031_ex vi_032 vi_032_ex vi_033 vi_033_ex vi_034 vi_034_ex vi_035 vi_035_ex ' +
      'vi_036 vi_036_ex vi_037 vi_037_ex vi_038 vi_038_ex vi_039 vi_039_ex vi_040 vi_040_ex vi_041 ' +
      'vi_041_ex vi_042 vi_042_ex vi_043 vi_043_ex vi_044 vi_044_ex vi_045 vi_045_ex vi_046 vi_046_ex ' +
      'vi_047 vi_047_ex vi_048 vi_048_ex vi_049 vi_049_ex vi_050 vi_050_ex vi_051 vi_051_ex vi_052 ' +
      'vi_052_ex vi_053 vi_053_ex vi_054 vi_054_ex vi_055 vi_055_ex vi_056 vi_056_ex vi_057 vi_057_ex ' +
      'vi_058 vi_058_ex vi_059 vi_059_ex vi_060 vi_060_ex vi_061 vi_061_ex vi_062 vi_062_ex vi_063 ' +
      'vi_063_ex vi_064 vi_064_ex vi_065 vi_065_ex vi_066 vi_066_ex vi_067 vi_067_ex vi_068 vi_068_ex ' +
      'vi_069 vi_069_ex vi_070 vi_070_ex vi_071 vi_071_ex vi_072 vi_072_ex vi_073 vi_073_ex vi_074 ' +
      'vi_074_ex vi_075 vi_075_ex vi_076 vi_076_ex vi_077 vi_077_ex vi_078 vi_078_ex vi_079 vi_079_ex ' +
      'vi_080 vi_080_ex vs001 vs002 vs003 vs004 vs005 vs006 vs007 vs008 vs009 vs010 vs011 vs012 vs013 vs014 ' +
      'vs015 vs016 vs017 vs018 vs019 vs020 vs021 vs022 vs023 vs024 vs025 vs026 vs027 vs028 vs029 vs030 ' +
      'vs031 vs032 vs033 vs034 vs035 vs036 vs037 vs038 vs039 vs040 vs041 vs042 vs043 vs044 vs045 vs046 ' +
      'vs047 vs048 vs049 vs050 vs051 vs052 vs053 vs054 vs055 vs056 vs057 vs058 vs059 vs060 vs061 vs062 ' +
      'vs063 vs064 vs065 vs066 vs067 vs068 vs069 vs070 vs071 vs072 vs073 vs074 vs075 vs076 vs077 vs078 ' +
      'vs079 vs080 vs081 vs082 vs083 vs084 vs085 vs086 vs087 vs088 vs089 vs090 vs091 vs092 vs093 vs094 ' +
      'vs095 vs096 vs097 vs098 vs099 vs100'
  }
}

// ---- 运行时接口（下面这段被 tools/gen-local-audio.js 原样拼进 utils/local-audio.js）----

// 跟读队列里的素材 id 是「前缀_原始id」（句子 st_s001、对话台词 dl_d003_1），
// 而音频文件名用的是原始 id（s001 / d003_1）。两种都认，否则对话台词永远命中不了。
const ID_PREFIXES = ['st_', 'dl_', 'sp_']
function idCandidates(id) {
  const out = [id]
  for (let i = 0; i < ID_PREFIXES.length; i++) {
    const p = ID_PREFIXES[i]
    if (id.length > p.length && id.indexOf(p) === 0) out.push(id.slice(p.length))
  }
  return out
}

// ids 是「空格分隔的整串」，查表用 indexOf（前后补空格避免 vi_01 命中 vi_010）。
// 这样 722 个 id 的清单只占一个字符串字面量，不用在启动时构建 722 键的对象。
function padded(r) {
  if (!r._pad) r._pad = ' ' + r.ids + ' '
  return r._pad
}
function hasId(r, id) {
  return padded(r).indexOf(' ' + id + ' ') >= 0
}

// 素材 id 属于哪个语种；没有返回空串
function langOf(id) {
  if (!id) return ''
  const langs = Object.keys(REGION)
  const ids = idCandidates(id)
  for (let li = 0; li < langs.length; li++) {
    for (let ii = 0; ii < ids.length; ii++) {
      if (hasId(REGION[langs[li]], ids[ii])) return langs[li]
    }
  }
  return ''
}

// 音频在 CDN 上的地址（Pages 部署时会把 audio-src/ 原样铺成 /audio/ 与 /audio-en/）。
// mp3 不进代码包：真机上 FileSystemManager 读不到分包内的文件、InnerAudioContext 也不允许
// 直接播包内 mp3（日志「[pkg-audio] 读不到代码包内的音频」「operateAudio:fail:access denied」），
// 所以随包音频的唯一可用路径就是这条 CDN 流播。
function remoteFor(id) {
  if (!id) return ''
  const langs = Object.keys(REGION)
  const ids = idCandidates(id)
  for (let li = 0; li < langs.length; li++) {
    const r = REGION[langs[li]]
    if (!r.remote) continue
    for (let ii = 0; ii < ids.length; ii++) {
      if (hasId(r, ids[ii])) return r.remote + ids[ii] + '.mp3'
    }
  }
  return ''
}

// 这个 id 有没有现成音频（本地缓存或 CDN 都算）
function has(id) { return !!remoteFor(id) }

function countOf(lang) { return REGION[lang] ? REGION[lang].count : 0 }
function stats() {
  const out = {}
  Object.keys(REGION).forEach(function (k) {
    out[k] = { count: REGION[k].count, bytes: REGION[k].bytes }
  })
  return out
}

const count = Object.keys(REGION).reduce(function (a, k) { return a + REGION[k].count }, 0)

module.exports = {
  REGION: REGION,
  idCandidates: idCandidates,
  remoteFor: remoteFor,
  has: has,
  langOf: langOf,
  countOf: countOf,
  stats: stats,
  count: count
}
