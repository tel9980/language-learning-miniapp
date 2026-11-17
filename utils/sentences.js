// 口语素材库：句子跟读 + 情景对话（脱离单词级别，练连贯表达）
// 统一条目结构：{ id, text, cn, scene, level, role? }
//   scene 场景名；level CEFR 等级（A1/A2/B1/B2）；role 可空，情景对话里区分角色

const SENTENCES = {
  en: [
    { id: 's001', text: 'Could you help me with this, please?', cn: '你能帮我一下吗？', scene: '日常求助', level: 'A2' },
    { id: 's002', text: 'I would like a cup of coffee, please.', cn: '我想要一杯咖啡。', scene: '点餐', level: 'A1' },
    { id: 's003', text: 'Excuse me, how can I get to the nearest station?', cn: '打扰一下，最近的车站怎么走？', scene: '问路', level: 'A2' },
    { id: 's004', text: 'Nice to meet you. My name is Li Ming.', cn: '很高兴认识你，我叫李明。', scene: '自我介绍', level: 'A1' },
    { id: 's005', text: 'I am really looking forward to the weekend.', cn: '我非常期待周末。', scene: '日常闲聊', level: 'B1' },
    { id: 's006', text: 'Sorry, I did not catch that. Could you say it again?', cn: '抱歉，我没听清，能再说一遍吗？', scene: '沟通澄清', level: 'A2' },
    { id: 's007', text: 'It is a great idea, but I have a small concern.', cn: '这是个好主意，但我有点小顾虑。', scene: '表达观点', level: 'B1' },
    { id: 's008', text: 'Thank you so much for your help today.', cn: '非常感谢你今天的帮助。', scene: '表达感谢', level: 'A2' },
    { id: 's009', text: 'I usually go jogging in the early morning.', cn: '我通常一大早去慢跑。', scene: '生活习惯', level: 'A2' },
    { id: 's010', text: 'Let us discuss the details after lunch.', cn: '我们午饭后讨论细节吧。', scene: '工作沟通', level: 'B1' },
    { id: 's011', text: 'The weather is lovely today, is not it?', cn: '今天天气真好，不是吗？', scene: '日常闲聊', level: 'A2' },
    { id: 's012', text: 'I am afraid I cannot make it on time.', cn: '恐怕我没法准时到了。', scene: '沟通澄清', level: 'B1' },
    { id: 's013', text: 'Could I have the bill, please?', cn: '可以给我账单吗？', scene: '点餐', level: 'A1' },
    { id: 's014', text: 'This is the best movie I have seen this year.', cn: '这是我今年看过最好的电影。', scene: '日常闲聊', level: 'B1' },
    { id: 's015', text: 'Can you recommend a good place to visit here?', cn: '你能推荐这里一个好玩的地方吗？', scene: '日常求助', level: 'B1' },
    { id: 's016', text: 'I completely understand how you feel.', cn: '我完全理解你的感受。', scene: '表达观点', level: 'B1' },
    { id: 's017', text: 'Please let me know if you need anything else.', cn: '如果还需要别的请告诉我。', scene: '工作沟通', level: 'B1' },
    { id: 's018', text: 'I would rather stay in and read a book.', cn: '我更想待在家里看书。', scene: '生活习惯', level: 'B1' },
    { id: 's019', text: 'Hold on a second, I will be right back.', cn: '稍等一下，我马上回来。', scene: '日常求助', level: 'A2' },
    { id: 's020', text: 'That sounds wonderful. Count me in!', cn: '听起来太棒了，算我一个！', scene: '日常闲聊', level: 'A2' },
    { id: 's021', text: 'My name is Wang Lin. Nice to meet you.', cn: '我叫王林，很高兴认识你。', scene: '自我介绍', level: 'A1' },
    { id: 's022', text: 'I would like to book a table for two.', cn: '我想订一张两人桌。', scene: '点餐', level: 'A2' },
    { id: 's023', text: 'Where is the nearest subway station?', cn: '最近的地铁站在哪里？', scene: '问路', level: 'A1' },
    { id: 's024', text: 'Turn left at the traffic lights.', cn: '在红绿灯处左转。', scene: '问路', level: 'A1' },
    { id: 's025', text: 'I get up at seven every morning.', cn: '我每天早上七点起床。', scene: '生活习惯', level: 'A1' },
    { id: 's026', text: 'Could you speak a little more slowly?', cn: '你能说慢一点吗？', scene: '沟通澄清', level: 'A2' },
    { id: 's027', text: 'I think this plan needs more time.', cn: '我觉得这个计划需要更多时间。', scene: '表达观点', level: 'B1' },
    { id: 's028', text: 'I really appreciate your help with this.', cn: '非常感谢你在这件事上的帮助。', scene: '表达感谢', level: 'B2' },
    { id: 's029', text: 'Let me get back to you on that tomorrow.', cn: '这件事我明天再答复你。', scene: '工作沟通', level: 'B2' },
    { id: 's030', text: 'I have been learning English for three years.', cn: '我学英语已经三年了。', scene: '自我介绍', level: 'B1' },
    { id: 's031', text: 'Would you mind opening the window?', cn: '你介意开一下窗吗？', scene: '日常求助', level: 'B1' },
    { id: 's032', text: 'The train leaves at half past eight.', cn: '火车八点半出发。', scene: '出行', level: 'A1' },
    { id: 's033', text: 'I am sorry, but I have to cancel our meeting.', cn: '很抱歉，我得取消我们的会议。', scene: '工作沟通', level: 'B2' },
    { id: 's034', text: 'This soup tastes a bit too salty to me.', cn: '我觉得这汤有点太咸了。', scene: '点餐', level: 'A2' },
    { id: 's035', text: 'I often listen to music while working.', cn: '我经常边工作边听音乐。', scene: '生活习惯', level: 'B1' },
    { id: 's036', text: 'Could you tell me where the restroom is?', cn: '你能告诉我洗手间在哪里吗？', scene: '问路', level: 'A2' },
    { id: 's037', text: 'That is exactly what I was thinking.', cn: '这正是我在想的。', scene: '表达观点', level: 'B2' },
    { id: 's038', text: 'Please feel free to ask me any questions.', cn: '有任何问题尽管问我。', scene: '工作沟通', level: 'B1' },
    { id: 's039', text: 'I am going to visit my grandparents this weekend.', cn: '这周末我打算去看望祖父母。', scene: '日常闲聊', level: 'A2' },
    { id: 's040', text: 'Thanks for letting me know. I will be there.', cn: '谢谢你告诉我，我会去的。', scene: '表达感谢', level: 'B1' },
    { id: 's041', text: 'Could you give me a hand with these bags?', cn: '能帮我拿一下这些包吗？', scene: '日常求助', level: 'A2' },
    { id: 's042', text: 'I am not feeling well today.', cn: '我今天不太舒服。', scene: '看医生', level: 'A1' },
    { id: 's043', text: 'You should see a doctor about that cough.', cn: '你那个咳嗽应该去看看医生。', scene: '看医生', level: 'B1' },
    { id: 's044', text: 'Take this medicine twice a day after meals.', cn: '这药一天两次，饭后吃。', scene: '看医生', level: 'B1' },
    { id: 's045', text: 'My phone battery is about to die.', cn: '我手机电池快没电了。', scene: '日常求助', level: 'A2' },
    { id: 's046', text: 'Can I borrow your charger for a moment?', cn: '能借你的充电器用一下吗？', scene: '日常求助', level: 'A2' },
    { id: 's047', text: 'I would like to check in, please.', cn: '我想办理入住。', scene: '旅行', level: 'A2' },
    { id: 's048', text: 'Here is my passport and booking confirmation.', cn: '这是我的护照和预订确认单。', scene: '旅行', level: 'B1' },
    { id: 's049', text: 'What time is check-out tomorrow?', cn: '明天几点退房？', scene: '旅行', level: 'A2' },
    { id: 's050', text: 'I would like to fly to Shanghai on Monday.', cn: '我想周一飞上海。', scene: '旅行', level: 'A2' },
    { id: 's051', text: 'Is this seat taken?', cn: '这个座位有人吗？', scene: '出行', level: 'A1' },
    { id: 's052', text: 'Could you keep an eye on my luggage?', cn: '能帮我看一下行李吗？', scene: '旅行', level: 'B1' },
    { id: 's053', text: 'I am here on business.', cn: '我是来出差的。', scene: '旅行', level: 'B1' },
    { id: 's054', text: 'The flight has been delayed by an hour.', cn: '航班延误了一小时。', scene: '旅行', level: 'B1' },
    { id: 's055', text: 'I would like a window seat, please.', cn: '我想要一个靠窗的座位。', scene: '旅行', level: 'A2' },
    { id: 's056', text: 'Let me introduce you to my colleague.', cn: '让我把你介绍给我的同事。', scene: '自我介绍', level: 'B1' },
    { id: 's057', text: 'I have heard a lot about you.', cn: '我听说过你很多事。', scene: '自我介绍', level: 'B1' },
    { id: 's058', text: 'We have met before, at the conference.', cn: '我们以前见过，在会议上。', scene: '自我介绍', level: 'B2' },
    { id: 's059', text: 'Please call me by my first name.', cn: '请直呼我的名字就好。', scene: '自我介绍', level: 'B1' },
    { id: 's060', text: 'It is a pleasure to work with you.', cn: '和你共事很愉快。', scene: '工作沟通', level: 'B2' },
    { id: 's061', text: 'Could we schedule a call for tomorrow?', cn: '我们能把电话会议定在明天吗？', scene: '工作沟通', level: 'B1' },
    { id: 's062', text: 'I will send you the files by email.', cn: '我会把文件通过邮件发给你。', scene: '工作沟通', level: 'A2' },
    { id: 's063', text: 'Can you walk me through the process?', cn: '你能带我过一遍流程吗？', scene: '工作沟通', level: 'B2' },
    { id: 's064', text: 'Let us take a short break.', cn: '我们休息一下吧。', scene: '工作沟通', level: 'A2' },
    { id: 's065', text: 'I would like to extend the deadline by a week.', cn: '我想把截止日期延长一周。', scene: '工作沟通', level: 'B2' },
    { id: 's066', text: 'That is not quite what I had in mind.', cn: '这和我想的不太一样。', scene: '表达观点', level: 'B2' },
    { id: 's067', text: 'I see your point, but I disagree.', cn: '我明白你的意思，但我不同意。', scene: '表达观点', level: 'B2' },
    { id: 's068', text: 'From my point of view, it is worth a try.', cn: '在我看来，值得一试。', scene: '表达观点', level: 'B2' },
    { id: 's069', text: 'I am not sure I follow you.', cn: '我不太确定我听懂了。', scene: '沟通澄清', level: 'B1' },
    { id: 's070', text: 'Could you explain that in a different way?', cn: '你能换种方式解释一下吗？', scene: '沟通澄清', level: 'B1' },
    { id: 's071', text: 'Let me make sure I understand correctly.', cn: '让我确认一下我理解得对不对。', scene: '沟通澄清', level: 'B2' },
    { id: 's072', text: 'Just to clarify, we meet at six, right?', cn: '确认一下，我们六点见面，对吧？', scene: '沟通澄清', level: 'B1' },
    { id: 's073', text: 'I owe you one. Thank you!', cn: '我欠你一个人情，谢谢！', scene: '表达感谢', level: 'B1' },
    { id: 's074', text: 'You are very welcome. It was my pleasure.', cn: '不客气，这是我的荣幸。', scene: '表达感谢', level: 'B1' },
    { id: 's075', text: 'I really appreciate you taking the time.', cn: '非常感谢你抽时间。', scene: '表达感谢', level: 'B2' },
    { id: 's076', text: 'Thanks a lot, that helped a great deal.', cn: '太感谢了，帮了大忙。', scene: '表达感谢', level: 'B1' },
    { id: 's077', text: 'I am sorry for the inconvenience.', cn: '很抱歉带来不便。', scene: '道歉', level: 'B1' },
    { id: 's078', text: 'It was my mistake, I apologize.', cn: '是我的错，我道歉。', scene: '道歉', level: 'B1' },
    { id: 's079', text: 'Please forgive me for being late.', cn: '请原谅我迟到了。', scene: '道歉', level: 'B2' },
    { id: 's080', text: 'No worries, these things happen.', cn: '没关系，这种事难免。', scene: '道歉', level: 'B1' },
    { id: 's081', text: 'I accept your apology. Let us move on.', cn: '我接受你的道歉，我们继续吧。', scene: '道歉', level: 'B2' },
    { id: 's082', text: 'How was your weekend?', cn: '你周末过得怎么样？', scene: '日常闲聊', level: 'A2' },
    { id: 's083', text: 'I am planning to learn a new language.', cn: '我打算学一门新语言。', scene: '日常闲聊', level: 'B1' },
    { id: 's084', text: 'Long time no see! How have you been?', cn: '好久不见！你还好吗？', scene: '日常闲聊', level: 'B1' },
    { id: 's085', text: 'I am looking forward to our trip.', cn: '我很期待我们的旅行。', scene: '日常闲聊', level: 'B1' },
    { id: 's086', text: 'That is really kind of you.', cn: '你真是太好了。', scene: '日常闲聊', level: 'B1' },
    { id: 's087', text: 'I could not agree with you more.', cn: '我完全同意你。', scene: '表达观点', level: 'B2' },
    { id: 's088', text: 'Let us agree to disagree on this one.', cn: '这件事我们就各持己见吧。', scene: '表达观点', level: 'B2' },
    { id: 's089', text: 'I try to exercise at least three times a week.', cn: '我尽量每周至少锻炼三次。', scene: '生活习惯', level: 'B1' },
    { id: 's090', text: 'I usually have breakfast before work.', cn: '我通常上班前吃早餐。', scene: '生活习惯', level: 'A1' },
    { id: 's091', text: 'I go to bed around eleven at night.', cn: '我晚上十一点左右睡觉。', scene: '生活习惯', level: 'A1' },
    { id: 's092', text: 'I am trying to cut down on sugar.', cn: '我在尽量减少吃糖。', scene: '生活习惯', level: 'B1' },
    { id: 's093', text: 'Reading helps me relax before sleep.', cn: '阅读能帮我在睡前放松。', scene: '生活习惯', level: 'B1' },
    { id: 's094', text: 'Can you recommend a good restaurant nearby?', cn: '你能推荐附近一家好餐厅吗？', scene: '点餐', level: 'B1' },
    { id: 's095', text: 'I am allergic to peanuts.', cn: '我对花生过敏。', scene: '点餐', level: 'B1' },
    { id: 's096', text: 'Could we get the check, please?', cn: '能给我们结账吗？', scene: '点餐', level: 'A2' },
    { id: 's097', text: 'This dish is not what I ordered.', cn: '这道菜不是我点的。', scene: '点餐', level: 'B1' },
    { id: 's098', text: 'I would like the same as him, please.', cn: '我要和他一样的，谢谢。', scene: '点餐', level: 'A2' },
    { id: 's099', text: 'Do you have any vegetarian options?', cn: '你们有素食选项吗？', scene: '点餐', level: 'B1' },
    { id: 's100', text: 'It is a bit cold in here, is not it?', cn: '这里有点冷，不是吗？', scene: '日常闲聊', level: 'A2' },
    { id: 's101', text: 'Could you turn down the music a little?', cn: '你能把音乐调小声点吗？', scene: '日常求助', level: 'B1' },
    { id: 's102', text: 'I need to use the restroom urgently.', cn: '我急需用洗手间。', scene: '日常求助', level: 'A2' },
    { id: 's103', text: 'Would you like some help with that?', cn: '你需要帮忙吗？', scene: '日常求助', level: 'A2' },
    { id: 's104', text: 'I am looking for the nearest ATM.', cn: '我在找最近的取款机。', scene: '问路', level: 'A2' },
    { id: 's105', text: 'It is about a ten-minute walk from here.', cn: '从这里走大约十分钟。', scene: '问路', level: 'A2' },
    { id: 's106', text: 'Sorry, I am a stranger here myself.', cn: '抱歉，我对这里也不熟。', scene: '问路', level: 'B1' },
    { id: 's107', text: 'Go straight and turn right at the corner.', cn: '直走，在拐角处右转。', scene: '问路', level: 'A1' },
    { id: 's108', text: 'I have been looking forward to this for weeks.', cn: '我好几周都在盼着这个。', scene: '日常闲聊', level: 'B2' },
    { id: 's109', text: 'That is a great question.', cn: '这是个好问题。', scene: '表达观点', level: 'B1' },
    { id: 's110', text: 'Let me think about it for a second.', cn: '让我想一下。', scene: '沟通澄清', level: 'A2' },
    { id: 's111', text: 'I will get back to you as soon as possible.', cn: '我会尽快回复你。', scene: '工作沟通', level: 'B1' },
    { id: 's112', text: 'Please do not hesitate to contact me.', cn: '请随时联系我。', scene: '工作沟通', level: 'B2' }
  ],
  ja: [
    { id: 'js001', text: 'こんにちは、はじめまして。', cn: '你好，初次见面。', scene: '自我介绍', level: 'A1' },
    { id: 'js002', text: 'これをください。', cn: '请给我这个。', scene: '点餐', level: 'A1' }
  ]
}

// 情景对话：每条是一个场景，lines 是按顺序的台词
const DIALOGUES = {
  en: [
    {
      id: 'd001', scene: '咖啡店点餐', level: 'A2',
      lines: [
        { id: 'd001_1', role: '店员', text: 'Good morning! What can I get for you?', cn: '早上好！您需要点什么？' },
        { id: 'd001_2', role: '顾客', text: 'I would like a medium latte, please.', cn: '我想要一杯中杯拿铁。' },
        { id: 'd001_3', role: '店员', text: 'Would you like anything else?', cn: '还需要别的吗？' },
        { id: 'd001_4', role: '顾客', text: 'No, thank you. That is all.', cn: '不用了，谢谢，就这些。' }
      ]
    },
    {
      id: 'd002', scene: '问路', level: 'A2',
      lines: [
        { id: 'd002_1', role: '游客', text: 'Excuse me, is this the way to the city museum?', cn: '打扰一下，这是去市博物馆的路吗？' },
        { id: 'd002_2', role: '路人', text: 'Yes, just go straight for two blocks.', cn: '是的，直走两个街区就到。' },
        { id: 'd002_3', role: '游客', text: 'Thank you very much!', cn: '非常感谢！' }
      ]
    },
    {
      id: 'd003', scene: '初次见面', level: 'A2',
      lines: [
        { id: 'd003_1', role: 'A', text: 'Hi, I do not think we have met. I am Wang Lin.', cn: '你好，我们好像没见过，我叫王林。' },
        { id: 'd003_2', role: 'B', text: 'Nice to meet you, I am Emma.', cn: '很高兴认识你，我是艾玛。' },
        { id: 'd003_3', role: 'A', text: 'Nice to meet you too. Where are you from?', cn: '我也很高兴认识你，你来自哪里？' }
      ]
    },
    {
      id: 'd004', scene: '约会时间', level: 'B1',
      lines: [
        { id: 'd004_1', role: 'A', text: 'Are we still on for dinner tomorrow?', cn: '我们明天晚饭还照常吗？' },
        { id: 'd004_2', role: 'B', text: 'Yes, but can we make it seven instead?', cn: '照常，不过能改到七点吗？' },
        { id: 'd004_3', role: 'A', text: 'Sure, seven works for me.', cn: '当然，七点我可以。' }
      ]
    },
    {
      id: 'd005', scene: '购物退货', level: 'B1',
      lines: [
        { id: 'd005_1', role: '顾客', text: 'Hello, I would like to return this item.', cn: '你好，我想退这件商品。' },
        { id: 'd005_2', role: '店员', text: 'Do you have the receipt with you?', cn: '您带收据了吗？' },
        { id: 'd005_3', role: '顾客', text: 'Yes, here it is.', cn: '带了，给你。' }
      ]
    },
    {
      id: 'd006', scene: '机场值机', level: 'B1',
      lines: [
        { id: 'd006_1', role: '旅客', text: 'Good afternoon. I would like to check in for flight CA123.', cn: '下午好，我想办理 CA123 航班的值机。' },
        { id: 'd006_2', role: '地勤', text: 'May I see your passport, please?', cn: '可以看一下您的护照吗？' },
        { id: 'd006_3', role: '旅客', text: 'Here you are. I have one bag to check.', cn: '给你。我有一件行李要托运。' },
        { id: 'd006_4', role: '地勤', text: 'Thank you. Your seat is 24A, boarding at 9:40.', cn: '谢谢。您的座位是 24A，9:40 登机。' }
      ]
    },
    {
      id: 'd007', scene: '看医生', level: 'B2',
      lines: [
        { id: 'd007_1', role: '医生', text: 'What seems to be the problem today?', cn: '今天哪里不舒服？' },
        { id: 'd007_2', role: '患者', text: 'I have had a headache since yesterday evening.', cn: '我从昨天晚上开始头疼。' },
        { id: 'd007_3', role: '医生', text: 'Do you have any other symptoms, like a fever?', cn: '还有其他症状吗，比如发烧？' },
        { id: 'd007_4', role: '患者', text: 'No, just the headache. It is getting worse.', cn: '没有，只是头疼，而且越来越严重。' }
      ]
    },
    {
      id: 'd008', scene: '电话预约', level: 'B2',
      lines: [
        { id: 'd008_1', role: '接待员', text: 'Good morning, how may I help you?', cn: '早上好，有什么可以帮您？' },
        { id: 'd008_2', role: '来电者', text: 'I would like to make an appointment with Dr. Smith.', cn: '我想约史密斯医生。' },
        { id: 'd008_3', role: '接待员', text: 'Would Thursday afternoon at three work for you?', cn: '周四下午三点您方便吗？' },
        { id: 'd008_4', role: '来电者', text: 'That would be perfect. Thank you.', cn: '那太好了，谢谢。' }
      ]
    }
  ],
  ja: []
}

const LEVELS = ['A1', 'A2', 'B1', 'B2']

function getSentences(lang, level) {
  let list = SENTENCES[lang] || SENTENCES.en
  try {
    const od = require('./online-data').getOverride()
    if (od && od.sentences && od.sentences[lang] && od.sentences[lang].length) list = od.sentences[lang]
  } catch (e) {}
  return level ? list.filter(function (s) { return s.level === level }) : list
}
function getDialogues(lang, level) {
  let list = DIALOGUES[lang] || DIALOGUES.en
  try {
    const od = require('./online-data').getOverride()
    if (od && od.dialogues && od.dialogues[lang] && od.dialogues[lang].length) list = od.dialogues[lang]
  } catch (e) {}
  return level ? list.filter(function (d) { return d.level === level }) : list
}
function getLevels() { return LEVELS.slice() }
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
    level: raw.level || '',
    kind: 'sentence'
  }
}
// 取所有句子条目（含对话台词，平铺），供跟读队列使用
function getAllItems(lang) {
  const list = []
  getSentences(lang).forEach(s => list.push(toItem(s, 'st')))
  getDialogues(lang).forEach(d => d.lines.forEach(l => list.push(toItem(Object.assign({ scene: d.scene, level: d.level }, l), 'dl'))))
  return list
}

module.exports = {
  SENTENCES, DIALOGUES, LEVELS,
  getSentences, getDialogues, getLevels, getScenes, getAllItems, toItem
}
