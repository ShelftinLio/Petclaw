# Petclaw 项目说明文档

> 本文以 `Petclaw-git` 当前代码为准，重点说明 Petclaw 相对 kkclaw 的新增改动与最新版宠物功能。
> 当前 `package.json` 标记版本为 `3.7.1`，但本地代码已经包含宠物工作室、四种初始自定义宠物、文件收纳 Inbox、专注冒险、宠物成长、技能卡、记忆水晶、亲密度和羁绊物品等后续开发内容。

## 目录

- [1. 项目定位](#1-项目定位)
- [2. Petclaw 相对 kkclaw 的主要改动](#2-petclaw-相对-kkclaw-的主要改动)
- [3. 最新版宠物系统](#3-最新版宠物系统)
- [4. 桌面 AI 伴侣功能](#4-桌面-ai-伴侣功能)
- [5. 技术实现与目录结构](#5-技术实现与目录结构)
- [6. 本地运行与常用命令](#6-本地运行与常用命令)
- [7. 配置、数据与安全边界](#7-配置数据与安全边界)
- [8. 测试覆盖](#8-测试覆盖)
- [9. kkclaw 原有功能背景](#9-kkclaw-原有功能背景)
- [10. 后续文档与配图建议](#10-后续文档与配图建议)

## 1. 项目定位

Petclaw 是一个基于 Electron 的桌面 AI 伴侣应用。它把 OpenClaw 或 Hermes 这类兼容后端包装成一个有可视化宠物、语音播报、桌面字幕、模型切换、Gateway 守护、文件收纳和成长系统的桌面入口。

它的重点不是再做一个普通聊天窗口，而是让 AI 后端具备持续在桌面上的存在感：

- 看得见：桌面宠物浮窗、四种初始宠物、状态动画、宠物工作室、专注冒险窗口。
- 听得到：MiniMax、Edge TTS、DashScope、CosyVoice 等语音链路与桌面字幕。
- 管得住：Gateway 启动、状态诊断、日志、异常检测、自动恢复。
- 可成长：专注 XP、宠物等级、能力树、技能卡、记忆水晶、亲密度、羁绊物品。
- 能接物：本地 Inbox 收纳文件、图片、剪贴板文本和链接。

> 配图占位：项目总览图，可放一张桌面宠物 + 字幕窗口 + 工具栏 + Gateway 终端/状态页的组合截图。

## 2. Petclaw 相对 kkclaw 的主要改动

如果把 kkclaw 理解为早期桌面 AI 伴侣基础版本，Petclaw 的重点不是重复说明“桌面宠物能聊天、能播报”这类基础能力，而是强调它在产品完整度、个性化、长期陪伴和桌面工作流上的升级。

### 2.1 改动总览

| 改动方向 | kkclaw 基础 | Petclaw 当前变化 |
| --- | --- | --- |
| 项目命名与入口 | `openclaw-kkclaw`、`kkclaw` CLI、KKClaw Desktop Pet | `openclaw-petclaw`、`petclaw` CLI、Petclaw Desktop Pet |
| 宠物形态 | 以 67px 流体玻璃球和表情系统为核心 | 四种初始自定义宠物 + spritesheet 多状态动画 + 宠物工作室 |
| 自定义宠物 | 主要是视觉与配置层面的自定义 | 支持内置宠物切换、本地图片导入、AI 生成 spritesheet、宠物 manifest 管理 |
| 长期成长 | 以陪伴、播报和基础互动为主 | 增加专注冒险、宠物等级、能力树、技能卡、记忆水晶 |
| 关系系统 | 点击、表情和情绪反馈 | 增加亲密度 XP、每日上限、亲密等级、羁绊物品 |
| 桌面工作流 | 工具栏含截图上传等快捷入口 | 新增本地 Inbox 收纳文件、图片、剪贴板文本和链接 |
| 后端兼容 | OpenClaw / Hermes 兼容已有基础 | 明确 `openclaw` / `hermes` / `auto` 模式，启动选择和诊断更完整 |
| 稳定性 | Gateway 守护、日志、诊断、自动恢复 | 继续强化健康评分、异常检测、进程归属、日志尾读和状态展示 |
| 安全边界 | 已有 IPC、配置和日志安全能力 | 新增功能继续走 IPC 白名单、本地配置隔离和敏感日志脱敏 |
| 测试覆盖 | 覆盖基础配置、Gateway、日志、CLI | 新增宠物外观、图片生成、专注冒险、技能、亲密度、Inbox、preload 白名单测试 |

> 配图占位：Petclaw 与 kkclaw 对比图，可做成两列：左侧 kkclaw 流体球体，右侧 Petclaw 四种宠物 + 成长/Inbox。

### 2.2 命名与发布入口升级

Petclaw 已经从 kkclaw 命名体系迁移到新的产品入口：

- `package.json` 包名从 `openclaw-kkclaw` 变为 `openclaw-petclaw`。
- CLI 入口从 `bin/kkclaw.js` 变为 `bin/petclaw.js`。
- 构建产物名从 `KKClaw Desktop Pet` 变为 `Petclaw Desktop Pet`。
- Windows / macOS 打包配置、桌面快捷方式名称和文档链接也切换到 Petclaw。

这说明 Petclaw 不只是 kkclaw 的小补丁，而是面向新品牌和新功能集合的升级版。

### 2.3 宠物形态从“球体”升级为“多宠物”

kkclaw 的辨识点是流体玻璃球、14 种情绪颜色、眼睛表情和气泡/呼吸/点击反馈。Petclaw 当前最新版把主形态改造成宠物 manifest + spritesheet 系统，默认提供四种初始宠物：

- Cow Cat
- Chaos Devon Rex
- Chinese Village Dog
- Lobster

每只内置宠物都使用 `8 列 x 10 行` spritesheet，单格尺寸为 `192 x 208`，覆盖 `idle`、`happy`、`talking`、`thinking`、`sleepy`、`surprised`、`focused`、`offline`、`sad`、`walking` 十种状态。

### 2.4 宠物工作室与 AI 生成

Petclaw 新增宠物工作室相关能力，用户可以在同一个入口里管理宠物形态：

- 切换四种内置宠物。
- 从本地图片导入自定义宠物。
- 通过 OpenAI 兼容图片接口生成新的宠物 spritesheet。
- 保存自定义宠物记录、manifest、缩略图和生成任务信息。
- 支持不同 renderer：`spritesheet`、`image`、`frames`、`dom-cow-cat`。

相关文件：

- `pet-appearance.js`
- `pet-image-generator.js`
- `pet-studio.html`
- `assets/pets/`
- `tests/__tests__/pet-appearance.test.js`
- `tests/__tests__/pet-image-generator.test.js`
- `tests/__tests__/pet-studio-thumbnail.test.js`

> 配图占位：宠物工作室截图，可展示内置宠物列表、当前选中宠物、本地导入和 AI 生成入口。

### 2.5 从陪伴工具升级为成长型桌面伙伴

Petclaw 新增专注冒险和成长系统，把用户的专注工作转化为宠物成长：

- 专注任务可以选择标题、时长、意图类型和完成状态。
- 完成后获得 `focusXp`、`abilityFragments`、`stardust`、记忆水晶和技能种子。
- 宠物等级根据 `focusXp` 自动计算。
- 能力树通过等级和能力碎片逐步解锁。
- 可复用工作流可以生成技能种子，再学习为技能卡。

相关文件：

- `focus-adventure.js`
- `pet-progress.js`
- `pet-abilities.js`
- `pet-skills.js`
- `pet-game-window.html`

### 2.6 新增亲密度和羁绊物品

最新版 Petclaw 增加了独立于工作成长线的亲密度系统。它表达的是用户和宠物之间的关系温度，不会惩罚用户，也不会因为离开而下降。

亲密度来源包括点击宠物、发送文本消息、语音互动、完成专注冒险、填写专注总结和生成记忆水晶。亲密度升级后会解锁羁绊物品：

- Small Toy
- Bond Sticker
- Cozy Nest
- Bond Badge

相关文件：

- `pet-affinity.js`
- `pet-progress.js`
- `tests/__tests__/pet-affinity.test.js`

### 2.7 新增本地 Inbox 收纳

Petclaw 最新代码把桌面工具栏中的一部分工作流升级为本地 Inbox 收纳能力。Inbox 不删除、不移动原文件，而是把文件复制到用户文档目录下，形成桌面 AI 入口旁边的轻量素材收纳箱。

默认路径：

```text
Documents/Petclaw Inbox/YYYY-MM-DD/<type>/
```

支持：

- 文件选择器添加文件。
- 拖入文件到宠物或收纳面板。
- 手动收纳剪贴板图片。
- 手动收纳剪贴板文本或链接。
- 查看最近记录。
- 打开 Inbox 根目录。
- 打开、定位、移除记录。
- 从 Inbox 记录卡片拖出文件副本。

相关文件：

- `inbox-system.js`
- `main.js` 中的 `inbox-*` IPC handler
- `preload.js` 中的 `inbox-*` 白名单
- `index.html` 中的收纳面板 UI
- `tests/__tests__/inbox-system.test.js`

> 配图占位：Inbox 收纳面板截图，可展示最近记录、分类、打开目录按钮和拖入状态。

## 3. 最新版宠物系统

### 3.1 四种初始宠物

| 宠物 ID | 展示名称 | 当前定位 | renderer | 资源目录 |
| --- | --- | --- | --- | --- |
| `cow-cat` | Cow Cat | 轻量、亲近、适合作为默认陪伴形态 | `spritesheet` | `assets/pets/cow-cat/` |
| `chaos-devon-rex` | Chaos Devon Rex | 大耳朵德文卷毛猫，动感更强 | `spritesheet` | `assets/pets/chaos-devon-rex/` |
| `chinese-village-dog` | Chinese Village Dog | 温暖、可靠、偏长期陪伴感 | `spritesheet` | `assets/pets/chinese-village-dog/` |
| `lobster` | Lobster | 保留项目早期龙虾识别度 | `spritesheet` | `assets/pets/lobster/` |

每只内置宠物都有 `pet.json` 和 `spritesheet.svg`。内置宠物被标记为 `locked: true`，避免被普通编辑流程误删。

> 配图占位：四种初始宠物横向展示图。建议每只宠物取 `idle` 状态第一帧，并标注名称。

### 3.2 宠物状态动画

当前内置宠物统一使用 `8 x 10` spritesheet。每一行对应一种状态，每行 8 帧：

| 状态 | 用途 |
| --- | --- |
| `idle` | 默认待机、呼吸和轻微眨眼 |
| `happy` | 点击、奖励、正向反馈 |
| `talking` | 聊天或语音播报时 |
| `thinking` | 等待、处理、专注中 |
| `sleepy` | 困倦、低能量、深夜或休息氛围 |
| `surprised` | 升级、解锁、突发反馈 |
| `focused` | 专注冒险或工作中 |
| `offline` | 后端不可用或低活跃状态 |
| `sad` | 失败、打断或较低情绪反馈 |
| `walking` | 桌面漫游或切换动势 |

这种结构让 Petclaw 可以从早期“用 CSS 改变球体和眼睛”升级到“每只宠物都有完整角色动画表”。

### 3.3 宠物交互

当前宠物交互围绕桌面轻量浮窗展开：

- 宠物窗口常驻桌面并保持置顶。
- 支持拖动位置。
- 内置宠物支持轻量随机漫游。
- 点击宠物触发即时反应，并记录亲密度事件。
- 宠物状态会随聊天、思考、离线、专注和奖励变化。
- 工具栏提供聊天、收纳、语音/设置等入口。
- 字幕窗口保持鼠标穿透，不影响用户操作底层窗口。

相关文件：

- `main.js`
- `index.html`
- `preload.js`
- `lyrics.html`
- `pet-config.js`

### 3.4 宠物工作室

宠物工作室负责管理宠物外观和自定义流程。

主要能力：

- 展示内置宠物和自定义宠物。
- 切换当前 active pet。
- 导入本地图片作为 `image` renderer 宠物。
- 创建 AI 生成宠物请求。
- 保存 `pet.json`、生成提示词、任务记录和 spritesheet。
- 对生成或导入失败给出错误状态。

图片生成相关环境变量：

| 变量 | 用途 |
| --- | --- |
| `PETCLAW_IMAGE_API_KEY` | 图片生成 API Key |
| `OPENAI_API_KEY` | 备用图片生成 API Key |
| `PETCLAW_IMAGE_BASE_URL` | OpenAI 兼容图片接口 base URL |
| `PETCLAW_IMAGE_API_URL` | 图片编辑接口完整 URL |
| `PETCLAW_IMAGE_GENERATION_API_URL` | 图片生成接口完整 URL |
| `PETCLAW_IMAGE_MODEL` | 图片生成模型 |
| `PETCLAW_IMAGE_SIZE` | 图片生成尺寸 |
| `PETCLAW_IMAGE_QUALITY` | 图片生成质量 |

> 配图占位：AI 生成宠物结果图，可展示生成前的描述输入和生成后的 spritesheet/宠物预览。

### 3.5 专注冒险

专注冒险把一次工作会话包装成宠物成长事件。

支持的任务意图：

```text
Code / Writing / Research / Learning / Planning / Admin / Rest
```

支持的时长预设：

```text
5 / 15 / 25 / 55 分钟
```

结束状态：

```text
completed / partial / interrupted
```

奖励计算会根据实际分钟数、计划分钟数、完成状态、是否填写 summary、是否可生成技能种子来决定：

- `focusXp`
- `abilityFragments`
- `stardust`
- `memoryCrystal`
- `skillSeed`

`interrupted` 也可能因为用户填写总结而生成记忆水晶，但不会获得完成类亲密度奖励。这种设计避免惩罚用户，同时保留完成工作的意义。

> 配图占位：专注冒险窗口截图，可展示任务标题、意图类型、倒计时、完成/部分完成/中断按钮和奖励结果。

### 3.6 宠物等级与能力树

宠物等级由 `focusXp` 自动推导：

| 等级 | XP 阈值 | 阶段 |
| --- | ---: | --- |
| 1 | 0 | Companion |
| 2 | 60 | Observer |
| 3 | 160 | Planner |
| 4 | 320 | Operator |
| 5 | 520 | Skillbearer |

能力树：

| 能力 ID | 名称 | 等级要求 | 碎片消耗 | 说明 |
| --- | --- | ---: | ---: | --- |
| `warm-chat` | Basic Conversation | 1 | 0 | 初始对话能力 |
| `task-echo` | Task Echo | 1 | 1 | 宠物能记住当前专注任务标题 |
| `project-glance` | Project Glance | 2 | 2 | 总结安全的项目级信号 |
| `adventure-journal` | Adventure Journal | 2 | 2 | 完成专注会话后形成记忆水晶 |
| `next-step` | Next Step | 3 | 3 | 专注结束后建议下一步 |
| `workflow-lens` | Workflow Lens | 3 | 3 | 识别可复用工作流 |
| `openclaw-hands` | OpenClaw Hands | 4 | 5 | 请求权限把工作交给 OpenClaw 执行能力 |
| `skill-book` | Skill Book | 5 | 4 | 展示已学和草稿技能卡 |
| `skill-forge` | Skill Forge | 5 | 6 | 将完成的工作流总结变成技能卡草稿 |

### 3.7 技能卡与记忆水晶

Petclaw 把专注会话里的总结转成两类长期资产：

- 记忆水晶：记录一次完成的专注会话，包括标题、意图、状态、总结和奖励。
- 技能种子/技能卡：当总结含有可复用工作流信号时，生成候选技能种子，再学习成技能卡。

技能种子的触发条件包括：

- 用户明确写出“封装”“复用”“技能”等关键词。
- 已解锁 `workflow-lens`，并且总结里有足够明显的步骤、动词和可重复工作流结构。

### 3.8 亲密度与羁绊物品

亲密度系统表示用户与宠物的关系温度，独立于工作成长线。它只增长，不衰减，不惩罚用户。

亲密等级：

| 等级 | 名称 | XP 阈值 | 羁绊物品 |
| --- | --- | ---: | --- |
| 1 | First Meeting | 0 | 无 |
| 2 | Familiar | 40 | Small Toy |
| 3 | Close | 120 | Bond Sticker |
| 4 | Trusted | 260 | Cozy Nest |
| 5 | Bonded | 480 | Bond Badge |

亲密度来源：

| 事件 | XP | 限制 |
| --- | ---: | --- |
| 点击宠物 | 1 | 每日点击 XP 上限 20 |
| 发送文本消息 | 2 | 每日聊天 XP 上限 20 |
| 语音互动 | 3 | 每日语音 XP 上限 15 |
| 专注冒险完成或部分完成 | 8 | 无单独每日上限 |
| 专注总结 | 4 | 专注结束时触发 |
| 生成记忆水晶 | 5 | 记忆生成时触发 |

> 配图占位：亲密度面板截图，可展示当前亲密等级、下一等级进度条和已解锁羁绊物品。

## 4. 桌面 AI 伴侣功能

### 4.1 OpenClaw / Hermes 兼容后端

Petclaw 通过 `utils/backend-compat.js` 统一解析兼容后端。当前支持：

- `openclaw`：强制使用 OpenClaw。
- `hermes`：强制使用 Hermes。
- `auto`：自动选择可用后端。

配置优先级：

1. 环境变量 `PETCLAW_COMPAT_MODE`
2. `pet-config.json` 中的 `compatMode`
3. 自动探测

Hermes 模式会读取 `~/.hermes/.env`，并要求 API server 可用后才允许聊天。若只存在 `~/.hermes` 配置目录但缺少 Hermes CLI，不会被误判为已安装。

### 4.2 Gateway 启动、诊断与守护

Gateway 是 Petclaw 与兼容 AI 后端之间的运行通道。

入口：

- 桌面应用内入口：启动、状态检查、模型调用、日志和诊断。
- CLI 入口：`petclaw gateway`、`petclaw doctor`、`petclaw status`、`petclaw dashboard`。

能力：

- 启动 OpenClaw 或 Hermes Gateway。
- 检查端口、进程归属、健康状态和日志路径。
- 自动拉起、异常检测、健康评分、指标采集。
- Gateway 日志尾读、错误日志查看、重启和停止。
- 后端感知的启动横幅和 Ready Banner。

相关文件：

- `bin/petclaw.js`
- `service-manager.js`
- `gateway-client.js`
- `gateway-guardian.js`
- `utils/gateway-*.js`
- `startup-banner.js`

### 4.3 聊天、语音与字幕

Petclaw 支持把 AI 回复通过桌面语音和字幕表达出来。

主要能力：

- 兼容后端聊天请求。
- MiniMax 音色克隆与预设音色。
- Edge TTS 降级链。
- DashScope 和 CosyVoice 相关检查或引擎文件。
- 情绪感知语气、重复消息过滤、播放队列。
- 桌面歌词窗口，显示打字机式字幕。

需要注意：AI 回复能否被播报，取决于后端或 Agent 是否主动调用桌面桥接能力。单纯产生文字回复并不等于已经触发语音链路。

相关文件：

- `smart-voice.js`
- `voice/`
- `lyrics.html`
- `message-sync.js`
- `templates/desktop-bridge.js`

> 配图占位：语音字幕效果截图，可展示宠物正在说话、字幕逐字出现。

### 4.4 模型管理与热切换

模型系统围绕 `model-switcher.js` 和 `model-settings.*` 实现，支持多个 Provider 和模型的管理。

能力：

- Provider 增删改查。
- 从预设添加模型。
- 模型延迟测速。
- 模型热切换和失败回滚。
- 切换历史、状态机、策略配置。
- CC-Switch 同步。
- 配额查询、Provider 探测和模型拉取。

相关文件：

- `model-switcher.js`
- `model-settings.html`
- `model-settings.css`
- `model-settings.js`
- `utils/model-switch-*.js`
- `utils/switch-history.js`
- `utils/switch-logger.js`
- `utils/cc-switch-sync.js`

### 4.5 文件收纳 Inbox

Inbox 是 Petclaw 最新桌面工作流里非常重要的一部分。它把桌面上的文件、图片、文本和链接收进一个本地归档入口，方便后续交给 AI 或人工继续处理。

分类规则：

| 类型 | 扩展名示例 |
| --- | --- |
| `images` | `.png`、`.jpg`、`.jpeg`、`.gif`、`.bmp`、`.webp`、`.svg` |
| `docs` | `.pdf`、`.doc`、`.docx`、`.rtf` |
| `sheets` | `.xls`、`.xlsx`、`.csv` |
| `slides` | `.ppt`、`.pptx`、`.key` |
| `text` | `.txt`、`.md`、`.json`、`.js`、`.ts`、`.css`、`.html`、`.log` |
| `links` | `.url`、`.webloc` |
| `archives` | `.zip`、`.rar`、`.7z`、`.tar`、`.gz` |
| `other` | 未匹配的其他文件 |

Inbox 最近记录最多保留 100 条。删除记录只移除记录项，不应被理解为删除原始文件。

### 4.6 配置向导与诊断工具

项目提供 RPG 风格的新手配置向导，以及独立诊断工具窗口。

配置向导覆盖：

- Gateway
- 模型
- 消息渠道
- 语音引擎
- 播报设置
- 显示选项
- 全链路测试

诊断工具覆盖：

- Gateway 状态
- TTS 状态
- 模型配置
- 缓存与日志
- 端口和进程
- 自恢复建议

相关文件：

- `setup-wizard.html`
- `setup-wizard.js`
- `setup-preload.js`
- `diagnostic-toolbox.html`
- `docs/CONFIGURATION-GUIDE.md`

> 配图占位：配置向导截图和诊断工具截图各一张。

## 5. 技术实现与目录结构

### 5.1 技术栈

| 领域 | 当前实现 |
| --- | --- |
| 桌面框架 | Electron 28 |
| 运行环境 | Node.js 18+，推荐 Node.js 20+ |
| 主语言 | JavaScript、HTML、CSS |
| 测试 | Jest |
| 打包 | electron-builder |
| AI 后端 | OpenClaw、Hermes，支持 `auto` 兼容模式 |
| 语音 | MiniMax、Edge TTS、DashScope、CosyVoice |
| 图像生成 | OpenAI 兼容图片接口，用于自定义宠物 spritesheet |
| 平台 | Windows 10/11、macOS |

### 5.2 目录结构

```text
.
├── main.js                     # Electron 主进程
├── preload.js                  # 渲染进程安全桥接
├── index.html                  # 桌面宠物主 UI
├── lyrics.html                 # 字幕窗口
├── package.json                # 依赖、脚本、打包配置
├── bin/petclaw.js              # petclaw CLI
├── pet-appearance.js           # 宠物外观 manifest 与内置宠物
├── pet-image-generator.js      # AI 生成宠物与 spritesheet 处理
├── pet-progress.js             # 宠物成长进度
├── pet-abilities.js            # 等级与能力树
├── pet-skills.js               # 技能种子、技能卡、记忆水晶
├── pet-affinity.js             # 亲密度与羁绊物品
├── focus-adventure.js          # 专注冒险
├── inbox-system.js             # 本地 Inbox 收纳
├── voice/                      # TTS 引擎
├── utils/                      # 后端兼容、安全、日志、模型、Gateway 工具
├── assets/pets/                # 内置和自定义宠物资源
├── tests/__tests__/            # Jest 单元测试
├── docs/                       # 用户文档、GitHub Pages、图片与演示资源
├── docs-dev/                   # 开发记录、发布记录、方案文档
├── scripts/                    # 生成、启动、验证、工具脚本
├── archive/                    # 旧实现归档
└── templates/                  # 桥接模板
```

## 6. 本地运行与常用命令

### 6.1 安装依赖

```bash
npm install
```

### 6.2 启动桌面应用

```bash
npm start
```

开发模式：

```bash
npm run dev
```

### 6.3 使用 CLI

```bash
npx petclaw --version
npx petclaw gateway
npx petclaw gateway status
npx petclaw gateway logs --tail 80
npx petclaw doctor --json
npx petclaw dashboard
```

如果已经全局或通过包入口安装，也可以直接使用：

```bash
petclaw gateway
petclaw doctor
```

### 6.4 测试

```bash
npm test
```

CI 覆盖命令：

```bash
npm run test:ci
```

### 6.5 打包

Windows：

```bash
npm run build:win
```

macOS：

```bash
npm run build:mac
```

全部平台：

```bash
npm run build:all
```

## 7. 配置、数据与安全边界

### 7.1 `pet-config.json`

这是本地运行配置文件，已被 `.gitignore` 忽略，不应提交到仓库。可参考 `pet-config.example.json`。

常见字段：

```json
{
  "compatMode": "auto",
  "petName": "Petclaw",
  "userName": "User",
  "voice": {
    "enabled": true
  },
  "appearance": {
    "activePetId": "lobster"
  }
}
```

### 7.2 本地数据文件

| 文件或目录 | 用途 | 是否提交 |
| --- | --- | --- |
| `pet-config.json` | 本地配置 | 否 |
| `pet-progress.json` | 宠物成长、技能、亲密度 | 否 |
| Electron `userData/pet-inbox.json` | Inbox 最近记录 | 否 |
| `Documents/Petclaw Inbox/` | Inbox 文件副本 | 否 |
| `logs/` | 本地日志 | 否 |
| `dist/` | 打包输出 | 否 |

### 7.3 安全边界

项目已经把多个高风险入口做了约束：

- `preload.js` 只允许白名单 IPC channel。
- 外部命令调用尽量使用参数数组，而不是拼接命令字符串。
- API Key 和 Token 通过安全存储或运行时配置读取，避免硬编码。
- 日志系统包含敏感信息脱敏。
- `pet-config.json`、`.env`、凭证文件、进度文件和截图目录不提交。
- Inbox 复制文件，不移动或删除原文件。

## 8. 测试覆盖

当前测试集中在以下方向：

- 后端兼容与 Gateway 客户端。
- CLI 行为。
- 配置读写、安全加载和路径解析。
- 缓存、日志轮转、全局错误处理。
- 语音字幕与手动消息回复。
- 宠物点击反馈、宠物外观、图片生成。
- 专注冒险、成长、技能、亲密度。
- Inbox 文件收纳。
- preload IPC 白名单。

测试文件位于：

```text
tests/__tests__/
```

提交前建议至少运行：

```bash
git diff --check
npm test
```

如果只是文档改动，`git diff --check` 可用于快速检查 Markdown 空白错误；完整发布前仍建议跑完整测试。

## 9. kkclaw 原有功能背景

这一节故意放在文档后半部分。对外介绍时，kkclaw 更适合作为早期基础能力和项目来源背景；前半部分应优先展示 Petclaw 的最新改动。

根据 kkclaw 旧版 README 和代码，kkclaw 的主要功能包括：

### 9.1 流体玻璃球桌面宠物

kkclaw 的早期核心视觉是一个 67px 琉璃质感球体：

- 3 层流体动画。
- 径向渐变和双重高光。
- 根据 mood 改变颜色和光晕。
- 胶囊形眼睛、眨眼、星星眼、爱心眼等表情。
- 鼠标跟踪眼神。
- 点击弹跳和颜色脉冲。
- 悬浮呼吸效果。

### 9.2 情绪、表情与时间感知

kkclaw 已经有比较完整的情绪表达基础：

- 14 种 mood 颜色和光晕。
- 38 种待机微表情。
- 早晨、午后、深夜等时间段感知。
- 情绪与 TTS 语气联动。

这些能力构成了 Petclaw 后续宠物状态系统的基础，但 Petclaw 最新版已经把主要呈现从球体 CSS 表情迁移到可扩展宠物 spritesheet。

### 9.3 语音与桌面字幕

kkclaw 已经支持：

- MiniMax 声音克隆。
- 预设音色。
- Edge TTS 降级。
- 情绪感知语气。
- 自然停顿标记。
- 桌面歌词字幕。
- 消息队列和重复消息过滤。

Petclaw 沿用了这些语音和字幕方向，并继续放进 OpenClaw / Hermes 兼容后端的桌面伴侣体验里。

### 9.4 Gateway、模型切换和诊断

kkclaw 已经具备稳定运行所需的基础设施：

- Gateway 自动拉起。
- 健康监控。
- 崩溃自动重启。
- 10 项一键体检。
- 彩色终端日志。
- 日志去重和轮转。
- 模型热切换。
- Provider 管理和测速。
- 失败自动回滚。

Petclaw 在这些基础上继续保留并调整命名、CLI、后端兼容检测和新版功能入口。

### 9.5 新手向导和桌面集成

kkclaw 已经提供：

- RPG 风格配置向导。
- 7 步全流程引导。
- 缺失依赖一键安装。
- 智能环境检测。
- 全链路验证。
- 桌面快捷方式自动创建。
- 托盘菜单。
- 字幕窗口鼠标穿透。
- Windows 和 macOS 打包支持。

Petclaw 继续保留这些桌面化基础，并把重点扩展到宠物个性化、成长系统和 Inbox 工作流。

## 10. 后续文档与配图建议

为了让文档更适合发布或展示，建议后续补齐以下图片：

| 位置 | 建议图片 |
| --- | --- |
| 项目定位 | 宠物浮窗、字幕、工具栏、Gateway 状态的组合截图 |
| Petclaw vs kkclaw | 左侧 kkclaw 球体，右侧 Petclaw 四宠物和成长面板 |
| 四种初始宠物 | Cow Cat、Chaos Devon Rex、Chinese Village Dog、Lobster 横向图 |
| 宠物工作室 | 宠物切换、本地导入、AI 生成入口 |
| 专注冒险 | 倒计时、任务类型、完成奖励 |
| 亲密度 | 亲密等级、进度条、羁绊物品 |
| Inbox | 最近记录、分类、拖入文件状态 |
| 语音字幕 | 宠物说话 + 字幕窗口 |
| 配置向导 | RPG 风格向导关键步骤 |
| 诊断工具 | Gateway / TTS / 模型体检结果 |

当前推荐的文档分工：

- `README.md`：保持简短，作为项目入口页，突出下载、快速开始和最亮点。
- `PROJECT-DOCUMENTATION.md`：作为完整项目说明，承担功能全貌、Petclaw 改动、最新版宠物系统和 kkclaw 背景说明。
- `docs/CONFIGURATION-GUIDE.md`：继续承担新手配置教程。
- `docs-dev/`：保留开发计划、历史方案和发布记录。
