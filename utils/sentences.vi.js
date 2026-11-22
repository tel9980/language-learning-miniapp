// 越南语口语素材：句子跟读 + 情景对话（自动拆分自 sentences.js，改内容直接改这里）
// 每条句子：{ id, text, cn, scene, level }；每组对话：{ id, scene, level, lines: [{ id, role, text, cn }] }

const sentences = [
  {
    "id": "vs001",
    "text": "Xin chào, tôi tên là Lý Minh.",
    "cn": "你好，我叫李明。",
    "scene": "自我介绍",
    "level": "A1"
  },
  {
    "id": "vs002",
    "text": "Rất vui được gặp bạn.",
    "cn": "很高兴认识你。",
    "scene": "自我介绍",
    "level": "A1"
  },
  {
    "id": "vs003",
    "text": "Tôi đến từ Trung Quốc.",
    "cn": "我来自中国。",
    "scene": "自我介绍",
    "level": "A1"
  },
  {
    "id": "vs004",
    "text": "Tôi đang học tiếng Việt.",
    "cn": "我在学越南语。",
    "scene": "自我介绍",
    "level": "A1"
  },
  {
    "id": "vs005",
    "text": "Tôi học tiếng Việt được ba tháng.",
    "cn": "我学越南语三个月了。",
    "scene": "自我介绍",
    "level": "A2"
  },
  {
    "id": "vs006",
    "text": "Hôm nay trời đẹp quá.",
    "cn": "今天天气真好。",
    "scene": "日常闲聊",
    "level": "A1"
  },
  {
    "id": "vs007",
    "text": "Cuối tuần bạn làm gì?",
    "cn": "周末你做什么？",
    "scene": "日常闲聊",
    "level": "A1"
  },
  {
    "id": "vs008",
    "text": "Chúng ta đi uống cà phê nhé.",
    "cn": "我们去喝咖啡吧。",
    "scene": "日常闲聊",
    "level": "A2"
  },
  {
    "id": "vs009",
    "text": "Dạo này bạn có bận không?",
    "cn": "最近你忙吗？",
    "scene": "日常闲聊",
    "level": "A2"
  },
  {
    "id": "vs010",
    "text": "Hẹn gặp lại ngày mai.",
    "cn": "明天见。",
    "scene": "日常闲聊",
    "level": "A1"
  },
  {
    "id": "vs011",
    "text": "Cho tôi một bát phở.",
    "cn": "给我一碗河粉。",
    "scene": "点餐",
    "level": "A1"
  },
  {
    "id": "vs012",
    "text": "Cho tôi xem thực đơn.",
    "cn": "给我看一下菜单。",
    "scene": "点餐",
    "level": "A1"
  },
  {
    "id": "vs013",
    "text": "Món này có cay không?",
    "cn": "这道菜辣吗？",
    "scene": "点餐",
    "level": "A1"
  },
  {
    "id": "vs014",
    "text": "Làm ơn tính tiền cho tôi.",
    "cn": "请给我结账。",
    "scene": "点餐",
    "level": "A2"
  },
  {
    "id": "vs015",
    "text": "Cái này bao nhiêu tiền?",
    "cn": "这个多少钱？",
    "scene": "购物",
    "level": "A1"
  },
  {
    "id": "vs016",
    "text": "Đắt quá, bớt một chút được không?",
    "cn": "太贵了，能便宜一点吗？",
    "scene": "购物",
    "level": "A2"
  },
  {
    "id": "vs017",
    "text": "Tôi lấy cái này.",
    "cn": "我要这个。",
    "scene": "购物",
    "level": "A1"
  },
  {
    "id": "vs018",
    "text": "Có màu khác không?",
    "cn": "有别的颜色吗？",
    "scene": "购物",
    "level": "A2"
  },
  {
    "id": "vs019",
    "text": "Xin lỗi, nhà ga ở đâu?",
    "cn": "不好意思，车站在哪里？",
    "scene": "问路",
    "level": "A1"
  },
  {
    "id": "vs020",
    "text": "Đi thẳng rồi rẽ trái.",
    "cn": "直走然后左转。",
    "scene": "问路",
    "level": "A1"
  },
  {
    "id": "vs021",
    "text": "Chỗ này cách trung tâm bao xa?",
    "cn": "这里离市中心多远？",
    "scene": "问路",
    "level": "A2"
  },
  {
    "id": "vs022",
    "text": "Bạn có thể nói chậm hơn không?",
    "cn": "你能说慢一点吗？",
    "scene": "沟通澄清",
    "level": "A2"
  },
  {
    "id": "vs023",
    "text": "Xin lỗi, tôi không hiểu.",
    "cn": "抱歉，我不懂。",
    "scene": "沟通澄清",
    "level": "A1"
  },
  {
    "id": "vs024",
    "text": "Bạn nói lại lần nữa được không?",
    "cn": "你能再说一遍吗？",
    "scene": "沟通澄清",
    "level": "A2"
  },
  {
    "id": "vs025",
    "text": "Cảm ơn bạn rất nhiều.",
    "cn": "非常感谢你。",
    "scene": "表达感谢",
    "level": "A1"
  },
  {
    "id": "vs026",
    "text": "Không có gì, đó là việc nên làm.",
    "cn": "不客气，这是应该的。",
    "scene": "表达感谢",
    "level": "A1"
  },
  {
    "id": "vs027",
    "text": "Theo tôi, kế hoạch này hợp lý.",
    "cn": "我认为这个计划合理。",
    "scene": "表达观点",
    "level": "A2"
  },
  {
    "id": "vs028",
    "text": "Tôi nghĩ chúng ta cần thêm thời gian.",
    "cn": "我觉得我们需要更多时间。",
    "scene": "表达观点",
    "level": "A2"
  },
  {
    "id": "vs029",
    "text": "Buổi sáng tôi thường chạy bộ.",
    "cn": "早上我通常跑步。",
    "scene": "生活习惯",
    "level": "A2"
  },
  {
    "id": "vs030",
    "text": "Tôi dậy lúc sáu giờ mỗi ngày.",
    "cn": "我每天六点起床。",
    "scene": "生活习惯",
    "level": "A1"
  },
  {
    "id": "vs031",
    "text": "Tối nào tôi cũng đọc sách.",
    "cn": "我每晚都看书。",
    "scene": "生活习惯",
    "level": "A2"
  },
  {
    "id": "vs032",
    "text": "Cuộc họp bắt đầu lúc chín giờ.",
    "cn": "会议九点开始。",
    "scene": "工作沟通",
    "level": "A1"
  },
  {
    "id": "vs033",
    "text": "Tôi sẽ gửi tài liệu cho bạn tối nay.",
    "cn": "我今晚把资料发给你。",
    "scene": "工作沟通",
    "level": "A2"
  },
  {
    "id": "vs034",
    "text": "Ngày mai tôi xin nghỉ phép.",
    "cn": "明天我请假。",
    "scene": "工作沟通",
    "level": "A2"
  },
  {
    "id": "vs035",
    "text": "Tôi muốn đặt một phòng.",
    "cn": "我想订一间房。",
    "scene": "出行",
    "level": "A2"
  },
  {
    "id": "vs036",
    "text": "Chuyến bay mấy giờ khởi hành?",
    "cn": "航班几点起飞？",
    "scene": "出行",
    "level": "A2"
  },
  {
    "id": "vs037",
    "text": "Cho tôi mua hai vé.",
    "cn": "我买两张票。",
    "scene": "出行",
    "level": "A1"
  },
  {
    "id": "vs038",
    "text": "Mai tôi sẽ đến muộn một chút.",
    "cn": "明天我会稍微晚到一点。",
    "scene": "日常求助",
    "level": "A2"
  },
  {
    "id": "vs039",
    "text": "Tôi bị sốt và đau đầu.",
    "cn": "我发烧而且头疼。",
    "scene": "看医生",
    "level": "A1"
  },
  {
    "id": "vs040",
    "text": "Bạn có thể giúp tôi một chút không?",
    "cn": "你能帮我一下吗？",
    "scene": "日常求助",
    "level": "A1"
  },
  {
    "id": "vs041",
    "text": "Tôi có hẹn lúc ba giờ chiều.",
    "cn": "我下午三点有约。",
    "scene": "时间约定",
    "level": "A1"
  },
  {
    "id": "vs042",
    "text": "Hôm nay là thứ mấy?",
    "cn": "今天星期几？",
    "scene": "时间约定",
    "level": "A2"
  },
  {
    "id": "vs043",
    "text": "Bây giờ là mấy giờ?",
    "cn": "现在几点了？",
    "scene": "时间约定",
    "level": "A1"
  },
  {
    "id": "vs044",
    "text": "Tôi sẽ đến đó trong mười lăm phút.",
    "cn": "我十五分钟后到那儿。",
    "scene": "时间约定",
    "level": "A2"
  },
  {
    "id": "vs045",
    "text": "Trời mưa to, nhớ mang áo mưa nhé.",
    "cn": "雨很大，记得带雨衣。",
    "scene": "天气",
    "level": "A2"
  },
  {
    "id": "vs046",
    "text": "Mùa này Hà Nội thường có sương mù vào buổi sáng.",
    "cn": "这个季节河内早上常有雾。",
    "scene": "天气",
    "level": "B1"
  },
  {
    "id": "vs047",
    "text": "Gia đình tôi có bốn người.",
    "cn": "我家有四口人。",
    "scene": "家庭",
    "level": "A1"
  },
  {
    "id": "vs048",
    "text": "Mẹ tôi nấu ăn rất ngon.",
    "cn": "我妈妈做饭很好吃。",
    "scene": "家庭",
    "level": "A2"
  },
  {
    "id": "vs049",
    "text": "Anh trai tôi đang làm việc ở Thành phố Hồ Chí Minh.",
    "cn": "我哥哥在胡志明市工作。",
    "scene": "家庭",
    "level": "B1"
  },
  {
    "id": "vs050",
    "text": "Tôi bị đau bụng từ sáng.",
    "cn": "我从早上开始肚子疼。",
    "scene": "看医生",
    "level": "A2"
  },
  {
    "id": "vs051",
    "text": "Bác sĩ dặn tôi uống nhiều nước.",
    "cn": "医生嘱咐我多喝水。",
    "scene": "看医生",
    "level": "A2"
  },
  {
    "id": "vs052",
    "text": "Tôi cố gắng ngủ đủ tám tiếng mỗi ngày.",
    "cn": "我尽量每天睡够八小时。",
    "scene": "健康",
    "level": "B1"
  },
  {
    "id": "vs053",
    "text": "Tôi không ăn được đồ cay.",
    "cn": "我不能吃辣的。",
    "scene": "饮食",
    "level": "A1"
  },
  {
    "id": "vs054",
    "text": "Tôi thích uống cà phê sữa đá.",
    "cn": "我喜欢喝冰奶咖啡。",
    "scene": "饮食",
    "level": "A2"
  },
  {
    "id": "vs055",
    "text": "Ở Việt Nam, bữa ăn thường có canh và rau sống.",
    "cn": "在越南，一顿饭常有汤和生菜。",
    "scene": "饮食",
    "level": "B1"
  },
  {
    "id": "vs056",
    "text": "Làm ơn gọi giúp tôi một chiếc taxi.",
    "cn": "请帮我叫一辆出租车。",
    "scene": "交通",
    "level": "A2"
  },
  {
    "id": "vs057",
    "text": "Xe buýt này có đi đến sân bay không?",
    "cn": "这路公交到机场吗？",
    "scene": "交通",
    "level": "A1"
  },
  {
    "id": "vs058",
    "text": "Kẹt xe giờ cao điểm khiến tôi đến muộn.",
    "cn": "高峰期堵车让我迟到了。",
    "scene": "交通",
    "level": "B1"
  },
  {
    "id": "vs059",
    "text": "Tôi muốn đổi một ít tiền Việt.",
    "cn": "我想换一些越南盾。",
    "scene": "银行",
    "level": "A2"
  },
  {
    "id": "vs060",
    "text": "Tôi cần gửi bưu phẩm này đi Trung Quốc.",
    "cn": "我要把这个包裹寄到中国。",
    "scene": "邮局",
    "level": "B1"
  },
  {
    "id": "vs061",
    "text": "Phòng này có máy lạnh không?",
    "cn": "这间房有空调吗？",
    "scene": "住宿",
    "level": "A2"
  },
  {
    "id": "vs062",
    "text": "Tiền điện và tiền nước tính riêng hay gồm trong giá thuê?",
    "cn": "水电费另算还是含在房租里？",
    "scene": "住宿",
    "level": "B1"
  },
  {
    "id": "vs063",
    "text": "Từ này nghĩa là gì?",
    "cn": "这个词是什么意思？",
    "scene": "学习",
    "level": "A1"
  },
  {
    "id": "vs064",
    "text": "Bạn viết lại giúp tôi được không?",
    "cn": "你能帮我写一遍吗？",
    "scene": "学习",
    "level": "A2"
  },
  {
    "id": "vs065",
    "text": "Tôi học tiếng Việt mỗi tối khoảng một tiếng.",
    "cn": "我每晚学大约一小时越南语。",
    "scene": "学习",
    "level": "B1"
  },
  {
    "id": "vs066",
    "text": "Tôi đã nhận được email của bạn.",
    "cn": "我收到你的邮件了。",
    "scene": "工作沟通",
    "level": "A2"
  },
  {
    "id": "vs067",
    "text": "Xin lỗi, tôi cần dời cuộc họp sang thứ năm.",
    "cn": "抱歉，我需要把会议改到周四。",
    "scene": "工作沟通",
    "level": "B1"
  },
  {
    "id": "vs068",
    "text": "Báo cáo này cần hoàn thành trước cuối tuần.",
    "cn": "这份报告要在周末前完成。",
    "scene": "工作沟通",
    "level": "B1"
  },
  {
    "id": "vs069",
    "text": "Tôi rất vui vì được gặp lại bạn.",
    "cn": "我很高兴又见到你。",
    "scene": "情绪表达",
    "level": "A2"
  },
  {
    "id": "vs070",
    "text": "Tôi hơi lo về kết quả kỳ thi.",
    "cn": "我有点担心考试结果。",
    "scene": "情绪表达",
    "level": "A2"
  },
  {
    "id": "vs071",
    "text": "Đừng lo, mọi chuyện sẽ ổn thôi.",
    "cn": "别担心，一切都会好的。",
    "scene": "情绪表达",
    "level": "B1"
  },
  {
    "id": "vs072",
    "text": "Làm ơn giúp tôi, tôi bị mất ví rồi.",
    "cn": "请帮我，我钱包丢了。",
    "scene": "紧急求助",
    "level": "A2"
  },
  {
    "id": "vs073",
    "text": "Tôi cần gọi cảnh sát, ở đây vừa bị trộm.",
    "cn": "我需要报警，这里刚被偷了。",
    "scene": "紧急求助",
    "level": "B1"
  },
  {
    "id": "vs074",
    "text": "Xin lỗi vì đã để bạn chờ lâu.",
    "cn": "抱歉让你久等了。",
    "scene": "道歉",
    "level": "A2"
  },
  {
    "id": "vs075",
    "text": "Cuối tuần này bạn có rảnh đi ăn tối không?",
    "cn": "这个周末你有空去吃晚饭吗？",
    "scene": "邀请",
    "level": "A2"
  },
  {
    "id": "vs076",
    "text": "Tôi rất muốn mời bạn đến nhà chơi.",
    "cn": "我很想邀请你来家里玩。",
    "scene": "邀请",
    "level": "B1"
  },
  {
    "id": "vs077",
    "text": "Tôi có thể trả bằng thẻ không?",
    "cn": "我可以用卡付吗？",
    "scene": "付款",
    "level": "A2"
  },
  {
    "id": "vs078",
    "text": "Cho tôi xin hoá đơn.",
    "cn": "请给我发票。",
    "scene": "付款",
    "level": "A1"
  },
  {
    "id": "vs079",
    "text": "Chuyển khoản hay tiền mặt đều được.",
    "cn": "转账或现金都可以。",
    "scene": "付款",
    "level": "B1"
  },
  {
    "id": "vs080",
    "text": "Tôi đồng ý với ý kiến của bạn.",
    "cn": "我同意你的意见。",
    "scene": "表达观点",
    "level": "A2"
  },
  {
    "id": "vs081",
    "text": "Tôi hiểu ý bạn, nhưng tôi nghĩ khác.",
    "cn": "我明白你的意思，但我的看法不同。",
    "scene": "表达观点",
    "level": "B1"
  },
  {
    "id": "vs082",
    "text": "Nói chung tôi tán thành, chỉ có điều thời gian hơi gấp.",
    "cn": "总的来说我赞成，只是时间有点紧。",
    "scene": "表达观点",
    "level": "B2"
  },
  {
    "id": "vs083",
    "text": "Hành lý của tôi bị thất lạc.",
    "cn": "我的行李丢了。",
    "scene": "机场",
    "level": "A2"
  },
  {
    "id": "vs084",
    "text": "Tôi được mang bao nhiêu ki-lô-gam hành lý?",
    "cn": "我可以带多少公斤行李？",
    "scene": "机场",
    "level": "B1"
  },
  {
    "id": "vs085",
    "text": "Món này bị nguội rồi, làm ơn đổi giúp tôi.",
    "cn": "这道菜凉了，请帮我换一份。",
    "scene": "点餐",
    "level": "A2"
  },
  {
    "id": "vs086",
    "text": "Bạn chụp giúp tôi một tấm ảnh nhé.",
    "cn": "帮我拍张照吧。",
    "scene": "旅行",
    "level": "A1"
  },
  {
    "id": "vs087",
    "text": "Chỗ này nổi tiếng vì cảnh hoàng hôn rất đẹp.",
    "cn": "这里因为日落很美而闻名。",
    "scene": "旅行",
    "level": "B1"
  },
  {
    "id": "vs088",
    "text": "Tết Nguyên Đán là dịp sum họp gia đình.",
    "cn": "春节是家庭团聚的日子。",
    "scene": "节日",
    "level": "A2"
  },
  {
    "id": "vs089",
    "text": "Vào ngày lễ, đường phố rất đông người.",
    "cn": "节日时街上人非常多。",
    "scene": "节日",
    "level": "B1"
  },
  {
    "id": "vs090",
    "text": "Tôi thích màu xanh hơn.",
    "cn": "我更喜欢蓝色（绿色）。",
    "scene": "比较",
    "level": "A1"
  },
  {
    "id": "vs091",
    "text": "Cái này đắt hơn nhưng chất lượng tốt hơn.",
    "cn": "这个贵一些，但质量更好。",
    "scene": "比较",
    "level": "B1"
  },
  {
    "id": "vs092",
    "text": "Năm sau tôi định đi Đà Nẵng du lịch.",
    "cn": "明年我打算去岘港旅游。",
    "scene": "计划",
    "level": "B1"
  },
  {
    "id": "vs093",
    "text": "Nếu có thời gian, tôi sẽ học thêm tiếng Anh.",
    "cn": "如果有时间，我会再学英语。",
    "scene": "计划",
    "level": "B1"
  },
  {
    "id": "vs094",
    "text": "Hồi nhỏ tôi sống ở nông thôn.",
    "cn": "小时候我住在农村。",
    "scene": "回忆",
    "level": "B1"
  },
  {
    "id": "vs095",
    "text": "Trước đây tôi chưa từng nói tiếng Việt với người bản xứ.",
    "cn": "以前我从没跟本地人说过越南语。",
    "scene": "回忆",
    "level": "B2"
  },
  {
    "id": "vs096",
    "text": "Nếu bạn luyện mỗi ngày, phát âm sẽ tốt lên nhanh.",
    "cn": "如果你每天练，发音会很快变好。",
    "scene": "建议",
    "level": "B2"
  },
  {
    "id": "vs097",
    "text": "Bạn nên thử cách này, có lẽ hiệu quả hơn.",
    "cn": "你该试试这个方法，可能更有效。",
    "scene": "建议",
    "level": "B2"
  },
  {
    "id": "vs098",
    "text": "Cô ấy nói rằng ngày mai cô ấy sẽ đến sớm.",
    "cn": "她说她明天会早到。",
    "scene": "转述",
    "level": "B2"
  },
  {
    "id": "vs099",
    "text": "Anh ấy hỏi tôi có muốn đi cùng không.",
    "cn": "他问我愿不愿意一起去。",
    "scene": "转述",
    "level": "B2"
  },
  {
    "id": "vs100",
    "text": "Cảm ơn lời mời của bạn, nhưng hôm đó tôi bận mất rồi.",
    "cn": "谢谢你的邀请，但那天我实在有事。",
    "scene": "委婉拒绝",
    "level": "B2"
  }
]

const dialogues = [
  {
    "id": "vd001",
    "scene": "咖啡店点单",
    "level": "A1",
    "lines": [
      {
        "id": "vd001_1",
        "role": "Nhân viên",
        "text": "Chào bạn, bạn dùng gì ạ?",
        "cn": "你好，您要什么？"
      },
      {
        "id": "vd001_2",
        "role": "Khách",
        "text": "Cho tôi một cà phê sữa.",
        "cn": "给我一杯奶咖啡。"
      },
      {
        "id": "vd001_3",
        "role": "Nhân viên",
        "text": "Bạn uống nóng hay đá?",
        "cn": "您要热的还是冰的？"
      },
      {
        "id": "vd001_4",
        "role": "Khách",
        "text": "Cho tôi cà phê đá. Bao nhiêu tiền?",
        "cn": "我要冰咖啡。多少钱？"
      },
      {
        "id": "vd001_5",
        "role": "Nhân viên",
        "text": "Ba mươi nghìn đồng.",
        "cn": "三万盾。"
      }
    ]
  },
  {
    "id": "vd002",
    "scene": "问路",
    "level": "A1",
    "lines": [
      {
        "id": "vd002_1",
        "role": "Khách",
        "text": "Xin lỗi, nhà ga ở đâu?",
        "cn": "不好意思，车站在哪里？"
      },
      {
        "id": "vd002_2",
        "role": "Người qua đường",
        "text": "Bạn đi thẳng, rồi rẽ phải.",
        "cn": "你直走，然后右转。"
      },
      {
        "id": "vd002_3",
        "role": "Khách",
        "text": "Có xa không?",
        "cn": "远吗？"
      },
      {
        "id": "vd002_4",
        "role": "Người qua đường",
        "text": "Không xa, khoảng năm phút.",
        "cn": "不远，大概五分钟。"
      },
      {
        "id": "vd002_5",
        "role": "Khách",
        "text": "Cảm ơn bạn nhiều.",
        "cn": "非常感谢你。"
      }
    ]
  },
  {
    "id": "vd003",
    "scene": "初次见面",
    "level": "A1",
    "lines": [
      {
        "id": "vd003_1",
        "role": "Nam",
        "text": "Chào bạn, mình tên Nam. Còn bạn?",
        "cn": "你好，我叫南。你呢？"
      },
      {
        "id": "vd003_2",
        "role": "Lý Minh",
        "text": "Mình là Lý Minh, người Trung Quốc.",
        "cn": "我是李明，中国人。"
      },
      {
        "id": "vd003_3",
        "role": "Nam",
        "text": "Rất vui được gặp bạn. Bạn học gì ở đây?",
        "cn": "很高兴认识你。你在这里学什么？"
      },
      {
        "id": "vd003_4",
        "role": "Lý Minh",
        "text": "Mình học tiếng Việt.",
        "cn": "我学越南语。"
      },
      {
        "id": "vd003_5",
        "role": "Nam",
        "text": "Tiếng Việt khó không?",
        "cn": "越南语难吗？"
      },
      {
        "id": "vd003_6",
        "role": "Lý Minh",
        "text": "Hơi khó, nhưng mình rất thích.",
        "cn": "有点难，但我很喜欢。"
      }
    ]
  },
  {
    "id": "vd004",
    "scene": "看病",
    "level": "A2",
    "lines": [
      {
        "id": "vd004_1",
        "role": "Bác sĩ",
        "text": "Bạn bị sao?",
        "cn": "你怎么了？"
      },
      {
        "id": "vd004_2",
        "role": "Bệnh nhân",
        "text": "Tôi bị sốt và đau đầu.",
        "cn": "我发烧而且头疼。"
      },
      {
        "id": "vd004_3",
        "role": "Bác sĩ",
        "text": "Bạn bị sốt từ hôm qua à?",
        "cn": "你从昨天开始发烧吗？"
      },
      {
        "id": "vd004_4",
        "role": "Bệnh nhân",
        "text": "Vâng, từ tối hôm qua.",
        "cn": "是的，从昨晚开始。"
      },
      {
        "id": "vd004_5",
        "role": "Bác sĩ",
        "text": "Bạn uống thuốc này, nghỉ ngơi hai ngày.",
        "cn": "你吃这个药，休息两天。"
      }
    ]
  },
  {
    "id": "vd005",
    "scene": "打车",
    "level": "A2",
    "lines": [
      {
        "id": "vd005_1",
        "role": "Khách",
        "text": "Chào anh, anh đưa tôi đến chợ Bến Thành nhé.",
        "cn": "你好，请把我送到濱城市场。"
      },
      {
        "id": "vd005_2",
        "role": "Tài xế",
        "text": "Vâng, khoảng hai mươi phút là đến.",
        "cn": "好的，大概二十分钟到。"
      },
      {
        "id": "vd005_3",
        "role": "Khách",
        "text": "Đi đường này có bị kẹt xe không?",
        "cn": "走这条路会堵车吗？"
      },
      {
        "id": "vd005_4",
        "role": "Tài xế",
        "text": "Giờ này hơi đông, tôi đi đường khác cho nhanh.",
        "cn": "这个点有点堵，我走另一条路快一些。"
      },
      {
        "id": "vd005_5",
        "role": "Khách",
        "text": "Được, bao nhiêu tiền vậy anh?",
        "cn": "好的，多少钱呢？"
      },
      {
        "id": "vd005_6",
        "role": "Tài xế",
        "text": "Tám mươi nghìn, tôi tính theo đồng hồ.",
        "cn": "八万，我按计价器算。"
      }
    ]
  },
  {
    "id": "vd006",
    "scene": "银行换钱",
    "level": "A2",
    "lines": [
      {
        "id": "vd006_1",
        "role": "Nhân viên",
        "text": "Chào anh, anh cần giúp gì ạ?",
        "cn": "你好，需要什么帮助？"
      },
      {
        "id": "vd006_2",
        "role": "Khách",
        "text": "Tôi muốn đổi tiền nhân dân tệ sang đồng Việt Nam.",
        "cn": "我想把人民币换成越南盾。"
      },
      {
        "id": "vd006_3",
        "role": "Nhân viên",
        "text": "Anh đổi bao nhiêu ạ? Hôm nay tỉ giá là một ăn ba nghìn năm.",
        "cn": "您换多少？今天汇率是一比三千五。"
      },
      {
        "id": "vd006_4",
        "role": "Khách",
        "text": "Tôi đổi một nghìn tệ. Có mất phí không?",
        "cn": "我换一千。要手续费吗？"
      },
      {
        "id": "vd006_5",
        "role": "Nhân viên",
        "text": "Không mất phí, anh cho tôi xem hộ chiếu nhé.",
        "cn": "不收手续费，请给我看一下护照。"
      }
    ]
  },
  {
    "id": "vd007",
    "scene": "看房租房",
    "level": "B1",
    "lines": [
      {
        "id": "vd007_1",
        "role": "Người thuê",
        "text": "Chị ơi, phòng này còn trống không ạ?",
        "cn": "你好，这间房还空着吗？"
      },
      {
        "id": "vd007_2",
        "role": "Chủ nhà",
        "text": "Còn, phòng mới sửa lại, có ban công.",
        "cn": "还空着，房间刚翻修过，有阳台。"
      },
      {
        "id": "vd007_3",
        "role": "Người thuê",
        "text": "Giá thuê bao nhiêu một tháng? Có gồm tiền điện nước không?",
        "cn": "一个月租金多少？包含水电费吗？"
      },
      {
        "id": "vd007_4",
        "role": "Chủ nhà",
        "text": "Sáu triệu một tháng, điện nước tính riêng theo hoá đơn.",
        "cn": "一个月六百万，水电按账单另算。"
      },
      {
        "id": "vd007_5",
        "role": "Người thuê",
        "text": "Tôi cần đặt cọc trước bao lâu?",
        "cn": "我需要提前多久交押金？"
      },
      {
        "id": "vd007_6",
        "role": "Chủ nhà",
        "text": "Đặt cọc một tháng, hợp đồng tối thiểu sáu tháng.",
        "cn": "押一个月，合同最少六个月。"
      }
    ]
  },
  {
    "id": "vd008",
    "scene": "办手机卡",
    "level": "A1",
    "lines": [
      {
        "id": "vd008_1",
        "role": "Nhân viên",
        "text": "Chào bạn, bạn cần gì ạ?",
        "cn": "你好，你需要什么？"
      },
      {
        "id": "vd008_2",
        "role": "Khách",
        "text": "Tôi muốn mua một sim điện thoại có 4G.",
        "cn": "我想买一张有 4G 的手机卡。"
      },
      {
        "id": "vd008_3",
        "role": "Nhân viên",
        "text": "Sim này một tháng có ba mươi gigabyte, giá một trăm nghìn.",
        "cn": "这张卡一个月 30GB，价格十万。"
      },
      {
        "id": "vd008_4",
        "role": "Khách",
        "text": "Tôi dùng một tháng thôi, có gói ngắn hơn không?",
        "cn": "我只用一个月，有更短的套餐吗？"
      },
      {
        "id": "vd008_5",
        "role": "Nhân viên",
        "text": "Có gói mười lăm ngày, sáu mươi nghìn.",
        "cn": "有十五天的套餐，六万。"
      },
      {
        "id": "vd008_6",
        "role": "Khách",
        "text": "Vậy lấy gói đó, cảm ơn bạn.",
        "cn": "那就要那个，谢谢。"
      }
    ]
  }
]

module.exports = { sentences, dialogues }
