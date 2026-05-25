const SAMPLE_TEXT: Record<string, string> = {
  "30 Mins &nbsp; | &nbsp; 1 Serving": "30 分钟 &nbsp; | &nbsp; 1 人份",
  "0x7A2C8B9F": "校验码",
  "1012 mbar": "1012 毫巴",
  "21 °C": "21 摄氏度",
  "23 °C": "23 摄氏度",
  "8 Km/h": "8 公里/小时",
  AQI: "空气质量指数",
  Actions: "操作",
  Awesome: "精彩",
  BACK: "返回",
  Back: "返回",
  "Back to Top": "返回顶部",
  B: "按",
  ball: "球",
  Bread: "面包",
  Button: "按钮",
  BUTTON: "按钮",
  "Buy Now": "立即购买",
  "Card title": "卡片标题",
  "Card Title": "卡片标题",
  Checkbox: "选择框",
  "Checkbox 1": "选择框一",
  "Checkbox 2": "选择框二",
  "Checkbox 3": "选择框三",
  "Checkbox 4": "选择框四",
  "Check me": "选中我",
  Cheese: "奶酪",
  Clone: "克隆",
  Code: "代码",
  Colloborators: "协作者",
  Coffee: "咖啡",
  "Continue Application": "继续申请",
  Cryptocurrency: "加密货币",
  "Create, share, and use beautiful custom elements made with CSS": "创建、分享和使用精美的样式自定义元素",
  Delete: "删除",
  Discord: "社区",
  Docs: "文档",
  Download: "下载",
  "Dunmore, Ireland": "邓莫尔，爱尔兰",
  Earn: "收益",
  Edit: "编辑",
  Ethereum: "以太坊",
  Facebook: "脸书",
  "FLIP CARD": "翻转卡片",
  "Follow me": "关注我",
  "Generate Site": "生成站点",
  "Get started": "开始使用",
  Github: "代码库",
  GLITCH: "故障",
  Game: "游戏",
  "HELLO !": "你好！",
  "Here are the details of the card": "这里是卡片的详细信息",
  Healthy: "健康",
  Hello: "你好",
  "Hover Me": "悬停查看",
  "Hover me": "悬停查看",
  "Hover Over": "悬停查看",
  "HOVER OVER :D": "悬停查看",
  "HOVER ME": "悬停查看",
  Humidity: "湿度",
  Instagram: "照片墙",
  "Learn More": "了解更多",
  "Leave Me": "离开我",
  Like: "喜欢",
  Likes: "喜欢",
  "Magic Link": "魔法链接",
  Logout: "退出",
  "Lorem Ipsum": "示例文案",
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.":
    "这是一段用于展示卡片排版的示例说明文案，可替换为真实业务内容。",
  MENU: "菜单",
  MikeAndrewDesigner: "设计师麦克",
  Morning: "早晨",
  "More info": "更多信息",
  "Modern Button": "现代按钮",
  "Neon Checkbox": "霓虹选择框",
  N: "钮",
  "New Transaction": "新交易",
  O: "键",
  "P L A Y": "播放",
  "PLAY NOW": "立即播放",
  "Popular this month": "本月热门",
  Pasta: "意面",
  Pay: "支付",
  "Powered By": "技术支持",
  "Press me": "点击我",
  Pressure: "气压",
  "Real Feel": "体感温度",
  Register: "注册",
  Send: "发送",
  "Shop now": "立即购买",
  SPACE: "空格",
  "STATUS: IDLE [0x4F]": "状态：待机",
  "SYNCH: PENDING": "同步：等待中",
  "SYSTEM ACTIVATED": "系统已激活",
  "SYSTEM DEACTIVATED": "系统已停用",
  Save: "保存",
  "Spaguetti Bolognese": "肉酱意面",
  to: "到",
  top: "顶部",
  T: "钮",
  Twitter: "推特",
  U: "钮",
  "UIVERSE (3D UI)": "界面宇宙（三维界面）",
  "UI / EX Designer": "界面体验设计师",
  Uiverse: "界面库",
  "Unlock Pro": "解锁专业版",
  "View more": "查看更多",
  "QUANTUM VERIFY: 82.6%": "量子校验：82.6%",
  "universe of ui": "界面宇宙",
  "uiverse.io": "界面库",
  like: "喜欢",
  Wind: "风速",
  "look mom,": "看这里，",
  "mouse hover tracker": "鼠标悬停追踪",
  "no JS": "不用脚本",
  "now!": "现在！",
  play: "播放",
  "|{f[4": "动效",
  "&nbsp;uiverse&nbsp;": "&nbsp;界面&nbsp;"
};

const LOCALIZED_ATTRIBUTES = ["aria-label", "alt", "data-label", "data-text", "title"];

function localizedSample(value: string): string {
  return SAMPLE_TEXT[value.trim()] ?? value;
}

export function localizeWorkEasyHtml(html: string): string {
  // 保留文本节点首尾空白，避免相邻 inline 元素粘连
  let localized = html.replace(/>([^<>]*[A-Za-z][^<>]*)</g, (_match, text: string) => {
    const leading = text.match(/^\s*/)?.[0] ?? "";
    const trailing = text.match(/\s*$/)?.[0] ?? "";
    const core = text.slice(leading.length, text.length - trailing.length);
    const translated = SAMPLE_TEXT[core.trim()] ?? core;
    return `>${leading}${translated}${trailing}<`;
  });

  for (const attribute of LOCALIZED_ATTRIBUTES) {
    localized = localized.replace(
      new RegExp(`\\b${attribute}="([^"]*[A-Za-z][^"]*)"`, "g"),
      (_match, value: string) => {
        return `${attribute}="${localizedSample(value)}"`;
      }
    );
  }

  return localized;
}

export function localizeWorkEasyCss(css: string): string {
  return css.replace(/content:\s*(["'])(.*?)\1/g, (_match, quote: string, value: string) => {
    return `content: ${quote}${localizedSample(value)}${quote}`;
  });
}
