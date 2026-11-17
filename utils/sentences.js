// 口语素材库：句子跟读 + 情景对话（脱离单词级别，练连贯表达）
// 统一条目结构：{ id, text, cn, scene, role? }
//   scene 场景名；role 可空，情景对话里区分 A/B 角色

const SENTENCES = {
  en: [
    { id: 's001', text: 'Could you help me with this, please?', cn: '你能帮我一下吗？', scene: '日常求助' },
    { id: 's002', text: 'I would like a cup of coffee, please.', cn: '我想要一杯咖啡。', scene: '点餐' },
    { id: 's003', text: 'Excuse me, how can I get to the nearest station?', cn: '打扰一下，最近的车站怎么走？', scene: '问路' },
    { id: 's004', text: 'Nice to meet you. My name is Li Ming.', cn: '很高兴认识你，我叫李明。', scene: '自我介绍' },
    { id: 's005', text: 'I am really looking forward to the weekend.', cn: '我非常期待周末。', scene: '日常闲聊' },
    { id: 's006', text: 'Sorry, I did not catch that. Could you say it again?', cn: '抱歉，我没听清，能再说一遍吗？', scene: '沟通澄清' },
    { id: 's007', text: 'It is a great idea, but I have a small concern.', cn: '这是个好主意，但我有点小顾虑。', scene: '表达观点' },
    { id: 's008', text: 'Thank you so much for your help today.', cn: '非常感谢你今天的帮助。', scene: '表达感谢' },
    { id: 's009', text: 'I usually go jogging in the early morning.', cn: '我通常一大早去慢跑。', scene: '生活习惯' },
    { id: 's010', text: 'Let us discuss the details after lunch.', cn: '我们午饭后讨论细节吧。', scene: '工作沟通' },
    { id: 's011', text: 'The weather is lovely today, is not it?', cn: '今天天气真好，不是吗？', scene: '日常闲聊' },
    { id: 's012', text: 'I am afraid I cannot make it on time.', cn: '恐怕我没法准时到了。', scene: '沟通澄清' },
    { id: 's013', text: 'Could I have the bill, please?', cn: '可以给我账单吗？', scene: '点餐' },
    { id: 's014', text: 'This is the best movie I have seen this year.', cn: '这是我今年看过最好的电影。', scene: '日常闲聊' },
    { id: 's015', text: 'Can you recommend a good place to visit here?', cn: '你能推荐这里一个好玩的地方吗？', scene: '日常求助' },
    { id: 's016', text: 'I completely understand how you feel.', cn: '我完全理解你的感受。', scene: '表达观点' },
    { id: 's017', text: 'Please let me know if you need anything else.', cn: '如果还需要别的请告诉我。', scene: '工作沟通' },
    { id: 's018', text: 'I would rather stay in and read a book.', cn: '我更想待在家里看书。', scene: '生活习惯' },
    { id: 's019', text: 'Hold on a second, I will be right back.', cn: '稍等一下，我马上回来。', scene: '日常求助' },
    { id: 's020', text: 'That sounds wonderful. Count me in!', cn: '听起来太棒了，算我一个！', scene: '日常闲聊' }
  ],
  ja: [
    { id: 'js001', text: 'こんにちは、はじめまして。', cn: '你好，初次见面。', scene: '自我介绍' },
    { id: 'js002', text: 'これをください。', cn: '请给我这个。', scene: '点餐' }
  ]
}

// 情景对话：每条是一个场景，lines 是按顺序的台词
const DIALOGUES = {
  en: [
    {
      id: 'd001', scene: '咖啡店点餐',
      lines: [
        { id: 'd001_1', role: '店员', text: 'Good morning! What can I get for you?', cn: '早上好！您需要点什么？' },
        { id: 'd001_2', role: '顾客', text: 'I would like a medium latte, please.', cn: '我想要一杯中杯拿铁。' },
        { id: 'd001_3', role: '店员', text: 'Would you like anything else?', cn: '还需要别的吗？' },
        { id: 'd001_4', role: '顾客', text: 'No, thank you. That is all.', cn: '不用了，谢谢，就这些。' }
      ]
    },
    {
      id: 'd002', scene: '问路',
      lines: [
        { id: 'd002_1', role: '游客', text: 'Excuse me, is this the way to the city museum?', cn: '打扰一下，这是去市博物馆的路吗？' },
        { id: 'd002_2', role: '路人', text: 'Yes, just go straight for two blocks.', cn: '是的，直走两个街区就到。' },
        { id: 'd002_3', role: '游客', text: 'Thank you very much!', cn: '非常感谢！' }
      ]
    },
    {
      id: 'd003', scene: '初次见面',
      lines: [
        { id: 'd003_1', role: 'A', text: 'Hi, I do not think we have met. I am Wang Lin.', cn: '你好，我们好像没见过，我叫王林。' },
        { id: 'd003_2', role: 'B', text: 'Nice to meet you, I am Emma.', cn: '很高兴认识你，我是艾玛。' },
        { id: 'd003_3', role: 'A', text: 'Nice to meet you too. Where are you from?', cn: '我也很高兴认识你，你来自哪里？' }
      ]
    },
    {
      id: 'd004', scene: '约会时间',
      lines: [
        { id: 'd004_1', role: 'A', text: 'Are we still on for dinner tomorrow?', cn: '我们明天晚饭还照常吗？' },
        { id: 'd004_2', role: 'B', text: 'Yes, but can we make it seven instead?', cn: '照常，不过能改到七点吗？' },
        { id: 'd004_3', role: 'A', text: 'Sure, seven works for me.', cn: '当然，七点我可以。' }
      ]
    },
    {
      id: 'd005', scene: '购物退货',
      lines: [
        { id: 'd005_1', role: '顾客', text: 'Hello, I would like to return this item.', cn: '你好，我想退这件商品。' },
        { id: 'd005_2', role: '店员', text: 'Do you have the receipt with you?', cn: '您带收据了吗？' },
        { id: 'd005_3', role: '顾客', text: 'Yes, here it is.', cn: '带了，给你。' }
      ]
    }
  ],
  ja: []
}

function getSentences(lang) { return SENTENCES[lang] || SENTENCES.en }
function getDialogues(lang) { return DIALOGUES[lang] || DIALOGUES.en }
function getScenes(lang) {
  const set = {}
  getSentences(lang).forEach(s => { if (s.scene) set[s.scene] = true })
  return Object.keys(set)
}
// 把一条台词/句子转成可跟读的统一对象（id 带前缀避免与单词 id 冲突）
function toItem(raw, prefix) {
  return {
    id: (prefix || 'sp') + '_' + raw.id,
    word: raw.text,
    phonetic: '',
    meaning: raw.cn,
    example: raw.text,
    exampleCn: raw.cn,
    scene: raw.scene || raw.role || '',
    role: raw.role || '',
    kind: 'sentence'
  }
}
// 取所有句子条目（含对话台词，平铺），供跟读队列使用
function getAllItems(lang) {
  const list = []
  getSentences(lang).forEach(s => list.push(toItem(s, 'st')))
  getDialogues(lang).forEach(d => d.lines.forEach(l => list.push(toItem(Object.assign({ scene: d.scene }, l), 'dl'))))
  return list
}

module.exports = { SENTENCES, DIALOGUES, getSentences, getDialogues, getScenes, getAllItems, toItem }
