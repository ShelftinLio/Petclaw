你好，我需要你在这个 Petclaw 桌面宠物项目中创建一个首次运行配置向导（Setup Wizard）。

## 项目背景
这是一个 Electron 桌面AI宠物应用，用户安装后经常遇到配置问题：语音不播报、Gateway连不上、歌词不显示等。我们需要一个引导式的配置向导。

## 向导角色：小K
向导的引导人是'小K'，一个萌妹风格的AI助手。引导词要用可爱的口吻，带颜文字，例如：
- '你好呀～我是小K！(｡♥‿♥｡)'
- '找到啦！✧*。٩(ˊᗜˋ*)و✧*。'
- '诶？好像没找到呢 (◔_◔)'
- '搞定✨'

## 6步向导流程

### Step 1 — OpenClaw Gateway 连接
- 自动检测 localhost:18789
- 自动读取 ~/.openclaw/openclaw.json 里的 gateway.auth.token
- 检测失败则提供手动输入 Token 的输入框
- 小K台词：'让我找找你的Gateway...' → '找到啦！连接成功！'

### Step 2 — 消息渠道选择
- 显示常见渠道（feishu/telegram/discord/web/wecom）
- 每个渠道独立配置：语音播报(voice) / 桌面歌词(lyrics)
- 用 toggle 开关控制
- 保存到 pet-config.json 的 channels 字段

### Step 3 — TTS 语音引擎
- 优先级排序展示：
  1. MiniMax Speech 2.8 HD (最佳音质，需API Key)
  2. MiniMax Speech 2.5 Turbo (性价比高，需API Key) ← 推荐
  3. CosyVoice (阿里云，需API Key)
  4. Edge TTS (免费，无需配置，兜底)
- 选择引擎后输入API Key
- 提供试听按钮

### Step 4 — Agent 语音播报配置
- 自动将 desktop-bridge.js 复制到 OpenClaw workspace（~/.openclaw/ 或用户指定目录）
- 向 AGENTS.md 追加语音播报规则：每次回复前调用 `node desktop-bridge.js agent-response "播报内容"`
- 规则要包含：收到消息立即播报确认、执行中播报进度、完成播报结��
- 提供测试按钮验证播报链路

### Step 5 — 桌面显示设置
- 桌面歌词开关
- 开机自启动
- 球体置顶

### Step 6 — 完成 + 全链路测试
- 依次测试：Gateway → TTS → 播报 → 歌词
- 全部通过后显示庆祝动画
- 小K台词：'全部配置好啦！！！ ✧*。ヾ(｡>﹏<｡)ﾉﾞ✧*。'

## 技术要求

### 新增文件：
1. setup-wizard.html — 向导界面（对话气泡式UI，粉白渐变背景，圆角卡片）
2. setup-wizard.js — 后端逻辑（IPC handlers for 检测、配置、测试）
3. setup-preload.js — IPC 桥接（exposeInMainWorld）

### 修改文件：
1. main.js — 启动时检测 pet-config.json 是否有 setupComplete:true，没有则打开向导窗口
2. pet-config.js — 添加 isConfigComplete() 方法（检查 setupComplete 字段）

### UI风格：
- 粉白渐变背景 (#fff5f5 → #ffe8e8)
- 左侧小K头像用 🦞 emoji
- 对话气泡样式，文字有打字机效果逐字显示
- 底部进度指示器 ○ ● ○ ○ ○ ○
- 按钮用圆角粉色 (#ff6b9d)
- 整体风格：温暖、可爱、沉浸感
- 窗口大小：700x550

### pet-config.json 新增字段：
```json
{
  "setupComplete": true,
  "channels": {
    "feishu": { "voice": true, "lyrics": true },
    "telegram": { "voice": true, "lyrics": true },
    "discord": { "voice": false, "lyrics": true },
    "web": { "voice": false, "lyrics": false },
    "wecom": { "voice": true, "lyrics": true }
  }
}
```

请开始实现！创建所有需要的文件，修改需要改的文件。向导要完整可运行。确保小K的引导词在每一步都有，风格统一：萌妹、颜文字、亲切。
