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
    { id: 'js002', text: 'これをください。', cn: '请给我这个。', scene: '点餐', level: 'A1' },
    { id: 'js003', text: 'はじめまして、李と申します。', cn: '初次见面，我姓李。', scene: '自我介绍', level: 'A1' },
    { id: 'js004', text: '私は中国から来ました。', cn: '我来自中国。', scene: '自我介绍', level: 'A1' },
    { id: 'js005', text: '日本語を勉強して一年になります。', cn: '我学日语已经一年了。', scene: '自我介绍', level: 'A2' },
    { id: 'js006', text: '趣味は音楽を聞くことです。', cn: '我的爱好是听音乐。', scene: '自我介绍', level: 'B1' },
    { id: 'js007', text: '今日はいい天気ですね。', cn: '今天天气真好。', scene: '日常闲聊', level: 'A1' },
    { id: 'js008', text: '週末は何をしますか。', cn: '周末你做什么？', scene: '日常闲聊', level: 'A2' },
    { id: 'js009', text: '一緒に映画を見に行きませんか。', cn: '要不要一起去看电影？', scene: '日常闲聊', level: 'A2' },
    { id: 'js010', text: '最近忙しくて、ゆっくり休む時間がありません。', cn: '最近很忙，没时间好好休息。', scene: '日常闲聊', level: 'B1' },
    { id: 'js011', text: 'また明日会いましょう。', cn: '明天再见。', scene: '日常闲聊', level: 'B1' },
    { id: 'js012', text: 'コーヒーを一杯ください。', cn: '请给我一杯咖啡。', scene: '点餐', level: 'A1' },
    { id: 'js013', text: 'メニューを見せてください。', cn: '请给我看菜单。', scene: '点餐', level: 'A1' },
    { id: 'js014', text: 'おすすめは何ですか。', cn: '有什么推荐的？', scene: '点餐', level: 'A2' },
    { id: 'js015', text: 'お会計をお願いします。', cn: '请结账。', scene: '点餐', level: 'A2' },
    { id: 'js016', text: 'とてもおいしいです。', cn: '非常好吃。', scene: '点餐', level: 'A2' },
    { id: 'js017', text: 'すみません、駅はどこですか。', cn: '请问车站在哪里？', scene: '问路', level: 'A1' },
    { id: 'js018', text: 'まっすぐ行ってください。', cn: '请直走。', scene: '问路', level: 'A1' },
    { id: 'js019', text: 'ここから歩いて十分ぐらいです。', cn: '从这里走大约十分钟。', scene: '问路', level: 'A2' },
    { id: 'js020', text: 'この電車は新宿に行きますか。', cn: '这趟电车到新宿吗？', scene: '问路', level: 'A2' },
    { id: 'js021', text: '道に迷ってしまったので、地図を見せてもらえますか。', cn: '我迷路了，能给我看看地图吗？', scene: '问路', level: 'B1' },
    { id: 'js022', text: 'もう一度言ってください。', cn: '请再说一遍。', scene: '沟通澄清', level: 'A1' },
    { id: 'js023', text: 'ゆっくり話してください。', cn: '请说慢一点。', scene: '沟通澄清', level: 'A2' },
    { id: 'js024', text: '日本語があまり上手ではありません。', cn: '我日语不太好。', scene: '沟通澄清', level: 'A2' },
    { id: 'js025', text: 'すみません、聞き取れなかったので、もう一度お願いします。', cn: '抱歉没听清，请再说一次。', scene: '沟通澄清', level: 'B1' },
    { id: 'js026', text: 'この言葉はどういう意味ですか。', cn: '这个词是什么意思？', scene: '沟通澄清', level: 'B1' },
    { id: 'js027', text: 'ありがとうございます。', cn: '谢谢您。', scene: '表达感谢', level: 'A1' },
    { id: 'js028', text: '手伝ってくれてありがとう。', cn: '谢谢你帮我。', scene: '表达感谢', level: 'A2' },
    { id: 'js029', text: '今日は本当に助かりました。', cn: '今天真是帮了我大忙。', scene: '表达感谢', level: 'B1' },
    { id: 'js030', text: '私はそう思いません。', cn: '我不这么认为。', scene: '表达观点', level: 'A2' },
    { id: 'js031', text: 'いいアイデアだと思いますが、少し心配な点もあります。', cn: '我觉得是个好主意，但也有一些担心的地方。', scene: '表达观点', level: 'B1' },
    { id: 'js032', text: '私はこちらのほうが好きです。', cn: '我更喜欢这个。', scene: '表达观点', level: 'B1' },
    { id: 'js033', text: 'この計画にはもう少し時間が必要だと思います。', cn: '我认为这个计划需要更多时间。', scene: '表达观点', level: 'B2' },
    { id: 'js034', text: '毎朝七時に起きます。', cn: '我每天早上七点起床。', scene: '生活习惯', level: 'A1' },
    { id: 'js035', text: '毎日日本語を三十分勉強しています。', cn: '我每天学三十分钟日语。', scene: '生活习惯', level: 'A2' },
    { id: 'js036', text: '夜は早く寝るようにしています。', cn: '我尽量早睡。', scene: '生活习惯', level: 'A2' },
    { id: 'js037', text: '休みの日は家で本を読むことが多いです。', cn: '休息日我常在家看书。', scene: '生活习惯', level: 'B1' },
    { id: 'js038', text: '会議は三時からです。', cn: '会议三点开始。', scene: '工作沟通', level: 'A2' },
    { id: 'js039', text: '資料を送っていただけますか。', cn: '能把资料发给我吗？', scene: '工作沟通', level: 'B1' },
    { id: 'js040', text: 'この件は明日までに確認します。', cn: '这件事我明天之前确认。', scene: '工作沟通', level: 'B1' },
    { id: 'js041', text: '申し訳ありませんが、会議を来週に変更できますか。', cn: '很抱歉，会议能改到下周吗？', scene: '工作沟通', level: 'B2' },
    { id: 'js042', text: 'ご意見をいただければ幸いです。', cn: '若能听听您的意见就太好了。', scene: '工作沟通', level: 'B2' },
    { id: 'js043', text: '切符はどこで買えますか。', cn: '在哪里能买票？', scene: '出行', level: 'A1' },
    { id: 'js044', text: '次の駅で降ります。', cn: '我在下一站下车。', scene: '出行', level: 'A2' },
    { id: 'js045', text: '空港までどのくらいかかりますか。', cn: '到机场要多久？', scene: '出行', level: 'A2' },
    { id: 'js046', text: '新幹線の席を予約したいのですが。', cn: '我想预订新干线的座位。', scene: '出行', level: 'B1' },
    { id: 'js047', text: '台風の影響で、電車が遅れているそうです。', cn: '听说是受台风影响，电车晚点了。', scene: '出行', level: 'B2' },
    { id: 'js048', text: 'ちょっと手伝ってもらえますか。', cn: '能帮我一下吗？', scene: '日常求助', level: 'A1' },
    { id: 'js049', text: 'トイレはどこにありますか。', cn: '洗手间在哪里？', scene: '日常求助', level: 'A2' },
    { id: 'js050', text: '窓を開けてもいいですか。', cn: '可以开窗吗？', scene: '日常求助', level: 'B1' },
    { id: 'js051', text: 'これを日本語に翻訳してもらえますか。', cn: '能帮我把这个翻译成日语吗？', scene: '日常求助', level: 'B1' },
    { id: 'js052', text: 'これはいくらですか。', cn: '这个多少钱？', scene: '购物', level: 'A1' },
    { id: 'js053', text: 'もう少し安くなりませんか。', cn: '能再便宜一点吗？', scene: '购物', level: 'A2' },
    { id: 'js054', text: '試着してもいいですか。', cn: '可以试穿吗？', scene: '购物', level: 'A2' },
    { id: 'js055', text: '別の色はありますか。', cn: '有别的颜色吗？', scene: '购物', level: 'B1' },
    { id: 'js056', text: 'これを返品したいのですが。', cn: '我想退这个。', scene: '购物', level: 'B1' },
    { id: 'js057', text: '頭が痛いです。', cn: '我头疼。', scene: '看医生', level: 'A2' },
    { id: 'js058', text: '昨夜から熱があります。', cn: '从昨晚开始发烧。', scene: '看医生', level: 'B1' },
    { id: 'js059', text: 'この薬は一日三回飲んでください。', cn: '这个药请一天吃三次。', scene: '看医生', level: 'B2' },
    { id: 'js060', text: 'とても嬉しいです。', cn: '非常高兴。', scene: '情绪表达', level: 'A2' },
    { id: 'js061', text: '少し疲れました。', cn: '有点累了。', scene: '情绪表达', level: 'B1' },
    { id: 'js062', text: '心配しないでください。', cn: '请别担心。', scene: '情绪表达', level: 'B1' },
    { id: 'js063', text: '明日は晴れだそうです。', cn: '听说明天是晴天。', scene: '天气', level: 'A2' },
    { id: 'js064', text: '今日はとても暑いですね。', cn: '今天真热啊。', scene: '天气', level: 'A1' },
    { id: 'js065', text: '雨が降っているので、傘を持って行きます。', cn: '因为在下雨，我带伞去。', scene: '天气', level: 'A2' },
    { id: 'js066', text: '雪が降ると、道が滑りやすいです。', cn: '一下雪路就容易滑。', scene: '天气', level: 'B1' },
    { id: 'js067', text: '家族は四人です。', cn: '我家有四口人。', scene: '家庭', level: 'A1' },
    { id: 'js068', text: '父は会社員で、母は教師です。', cn: '父亲是公司职员，母亲是教师。', scene: '家庭', level: 'A2' },
    { id: 'js069', text: '週末は家族と一緒に食事をします。', cn: '周末和家人一起吃饭。', scene: '家庭', level: 'A1' },
    { id: 'js070', text: '兄は大阪で働いていて、年に二回帰ってきます。', cn: '哥哥在大阪工作，一年回来两次。', scene: '家庭', level: 'B1' },
    { id: 'js071', text: '朝ごはんはいつもパンと卵です。', cn: '早饭总是面包和鸡蛋。', scene: '生活习惯', level: 'A1' },
    { id: 'js072', text: '週に三回ジムへ行っています。', cn: '我每周去三次健身房。', scene: '生活习惯', level: 'A2' },
    { id: 'js073', text: '寝る前に少しだけ本を読みます。', cn: '睡前会读一点书。', scene: '生活习惯', level: 'A2' },
    { id: 'js074', text: '休みの日は家でゆっくりしています。', cn: '休息日在家悠闲度过。', scene: '生活习惯', level: 'A2' },
    { id: 'js075', text: '熱が三十八度あります。', cn: '发烧到三十八度。', scene: '看医生', level: 'A2' },
    { id: 'js076', text: '三日ぐらい前から咳が出ます。', cn: '大概三天前开始咳嗽。', scene: '看医生', level: 'A2' },
    { id: 'js077', text: 'ここが痛くて、歩くとつらいです。', cn: '这里疼，走路很难受。', scene: '看医生', level: 'B1' },
    { id: 'js078', text: '薬は食後に飲んでください。', cn: '药请饭后服用。', scene: '看医生', level: 'A2' },
    { id: 'js079', text: 'これを一つください。', cn: '请给我一个这个。', scene: '购物', level: 'A1' },
    { id: 'js080', text: 'カードで払えますか。', cn: '可以刷卡吗？', scene: '购物', level: 'A1' },
    { id: 'js081', text: '袋はいりますか。', cn: '需要袋子吗？', scene: '购物', level: 'A1' },
    { id: 'js082', text: '別のサイズはありますか。', cn: '有别的尺码吗？', scene: '购物', level: 'A2' },
    { id: 'js083', text: 'これを返品したいのですが、レシートは必要ですか。', cn: '我想退这个，需要小票吗？', scene: '购物', level: 'B1' },
    { id: 'js084', text: '資料を確認してから、ご連絡します。', cn: '我确认资料后再联系您。', scene: '工作沟通', level: 'A2' },
    { id: 'js085', text: '明日の会議は何時からですか。', cn: '明天的会议几点开始？', scene: '工作沟通', level: 'A1' },
    { id: 'js086', text: '今日は少し残業になりそうです。', cn: '今天可能要加班。', scene: '工作沟通', level: 'A2' },
    { id: 'js087', text: 'この件については、来週もう一度話し合いましょう。', cn: '这件事下周再讨论一次吧。', scene: '工作沟通', level: 'B1' },
    { id: 'js088', text: 'すみません、この漢字が読めません。', cn: '不好意思，这个汉字我不认识。', scene: '沟通澄清', level: 'A1' },
    { id: 'js089', text: 'もう少しゆっくり話していただけますか。', cn: '能再慢一点说吗？', scene: '沟通澄清', level: 'A2' },
    { id: 'js090', text: '「もったいない」は中国語でどう言いますか。', cn: '「もったいない」用中文怎么说？', scene: '沟通澄清', level: 'B1' },
    { id: 'js091', text: '新幹線で大阪まで行きます。', cn: '坐新干线去大阪。', scene: '出行', level: 'A1' },
    { id: 'js092', text: 'ホテルは駅の前に予約しました。', cn: '我在车站前订了酒店。', scene: '出行', level: 'A2' },
    { id: 'js093', text: '何時に出発すればいいですか。', cn: '几点出发比较好？', scene: '出行', level: 'A1' },
    { id: 'js094', text: '飛行機が遅れて、乗り継ぎに間に合いませんでした。', cn: '飞机晚点，没赶上转机。', scene: '出行', level: 'B2' },
    { id: 'js095', text: 'この先は工事中なので、回り道をしてください。', cn: '前面在施工，请绕行。', scene: '出行', level: 'B2' },
    { id: 'js096', text: '財布をなくしてしまいました。', cn: '我把钱包弄丢了。', scene: '日常求助', level: 'A2' },
    { id: 'js097', text: 'エレベーターが止まっているようです。', cn: '电梯好像停了。', scene: '日常求助', level: 'B1' },
    { id: 'js098', text: 'それは残念ですね。', cn: '那真遗憾。', scene: '情绪表达', level: 'A1' },
    { id: 'js099', text: '合格したと聞いて、とても嬉しいです。', cn: '听说你及格了，我很高兴。', scene: '情绪表达', level: 'A2' },
    { id: 'js100', text: '少し疲れたので、早めに休みます。', cn: '有点累了，我早点休息。', scene: '情绪表达', level: 'A1' }
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
  ja: [
    {
      id: 'jd001', scene: '便利店购物', level: 'A2',
      lines: [
        { id: 'jd001_1', role: '店員', text: 'いらっしゃいませ。', cn: '欢迎光临。' },
        { id: 'jd001_2', role: '客', text: 'すみません、このおにぎりはいくらですか。', cn: '请问这个饭团多少钱？' },
        { id: 'jd001_3', role: '店員', text: '百二十円です。', cn: '一百二十日元。' },
        { id: 'jd001_4', role: '客', text: 'じゃあ、これを二つください。', cn: '那请给我两个。' }
      ]
    },
    {
      id: 'jd002', scene: '问路', level: 'A2',
      lines: [
        { id: 'jd002_1', role: '観光客', text: 'すみません、駅へはどう行けばいいですか。', cn: '请问去车站怎么走？' },
        { id: 'jd002_2', role: '通行人', text: 'この道をまっすぐ行って、二つ目の角を右です。', cn: '沿这条路直走，第二个路口右转。' },
        { id: 'jd002_3', role: '観光客', text: 'ありがとうございます。歩いてどのくらいですか。', cn: '谢谢。走路要多久？' },
        { id: 'jd002_4', role: '通行人', text: '五分ぐらいですよ。', cn: '大概五分钟。' }
      ]
    },
    {
      id: 'jd003', scene: '初次见面', level: 'A2',
      lines: [
        { id: 'jd003_1', role: 'A', text: 'はじめまして、王と申します。', cn: '初次见面，我姓王。' },
        { id: 'jd003_2', role: 'B', text: 'はじめまして、田中です。どうぞよろしく。', cn: '初次见面，我是田中，请多关照。' },
        { id: 'jd003_3', role: 'A', text: 'こちらこそ、よろしくお願いします。', cn: '也请您多关照。' }
      ]
    },
    {
      id: 'jd004', scene: '餐厅点餐', level: 'B1',
      lines: [
        { id: 'jd004_1', role: '店員', text: 'ご注文はお決まりですか。', cn: '您决定点什么了吗？' },
        { id: 'jd004_2', role: '客', text: 'はい、天ぷら定食をお願いします。', cn: '是的，请给我天妇罗套餐。' },
        { id: 'jd004_3', role: '店員', text: 'お飲み物はいかがですか。', cn: '饮料需要什么？' },
        { id: 'jd004_4', role: '客', text: 'お水でいいです。あとでお会計をお願いします。', cn: '水就好。之后麻烦结账。' }
      ]
    },
    {
      id: 'jd005', scene: '电车问询', level: 'B1',
      lines: [
        { id: 'jd005_1', role: '客', text: 'すみません、この電車は東京駅に止まりますか。', cn: '请问这趟电车停东京站吗？' },
        { id: 'jd005_2', role: '駅員', text: 'いいえ、この電車は快速なので止まりません。', cn: '不，这是快车，不停。' },
        { id: 'jd005_3', role: '客', text: 'では、どの電車に乗ればいいですか。', cn: '那我该坐哪趟？' },
        { id: 'jd005_4', role: '駅員', text: '三番線の各駅停車に乗ってください。', cn: '请坐三号站台的各站停车。' }
      ]
    },
    {
      id: 'jd006', scene: '看医生', level: 'B2',
      lines: [
        { id: 'jd006_1', role: '医者', text: 'どうしましたか。', cn: '怎么了？' },
        { id: 'jd006_2', role: '患者', text: '昨日から喉が痛くて、熱もあります。', cn: '从昨天开始喉咙痛，还发烧。' },
        { id: 'jd006_3', role: '医者', text: '咳は出ますか。', cn: '咳嗽吗？' },
        { id: 'jd006_4', role: '患者', text: '少し出ます。薬をいただけますか。', cn: '有一点。能给我开点药吗？' }
      ]
    },
    {
      id: 'jd007', scene: '打电话约见面', level: 'A2',
      lines: [
        { id: 'jd007_1', role: '田中', text: 'もしもし、田中さんのお宅ですか。', cn: '喂，是田中先生家吗？' },
        { id: 'jd007_2', role: '本人', text: 'はい、田中ですが。', cn: '是的，我是田中。' },
        { id: 'jd007_3', role: '田中', text: '明日の午後、空いていますか。', cn: '明天下午有空吗？' },
        { id: 'jd007_4', role: '本人', text: '午後三時以降なら大丈夫です。', cn: '三点以后可以。' },
        { id: 'jd007_5', role: '田中', text: 'じゃあ、駅前で会いましょう。', cn: '那我们车站前见吧。' }
      ]
    },
    {
      id: 'jd008', scene: '公司请假', level: 'B1',
      lines: [
        { id: 'jd008_1', role: '社員', text: '課長、明日は休ませていただけませんか。', cn: '课长，明天可以让我请假吗？' },
        { id: 'jd008_2', role: '課長', text: 'どうかしましたか。', cn: '怎么了？' },
        { id: 'jd008_3', role: '社員', text: '熱があって、病院へ行きたいんです。', cn: '我发烧了，想去医院。' },
        { id: 'jd008_4', role: '課長', text: 'わかりました。お大事に。', cn: '知道了。保重身体。' },
        { id: 'jd008_5', role: '社員', text: 'すみません、明日の資料は今晩送ります。', cn: '抱歉，明天的资料我今晚发。' }
      ]
    }
  ]
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
  getSentences, getDialogues, getLevels, getAllItems, toItem
}
