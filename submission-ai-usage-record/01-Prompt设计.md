# Prompt 设计

本项目的 Prompt 不是一次性“让 AI 写完整项目”，而是按任务阶段拆分。每次先让 AI 读取当前代码结构，再把需求转成设计、计划、测试和实现步骤。这样可以保留人工决策，同时让 AI 负责高密度的代码生成、文档整理和边界检查。

## 1. 产品定位 Prompt

目标：把早期桌面 AI 伴侣升级为 Petclaw，突出“可见、可听、可成长、能接物”的桌面入口。

示例 Prompt：

```text
请基于当前 Petclaw 项目，梳理它相对 kkclaw 的产品升级点。
重点不要只写“桌面宠物 + AI 后端”，而要突出多宠物形态、语音播报、Gateway 守护、模型切换、文件收纳 Inbox、专注成长、技能卡、记忆水晶和亲密度系统。
输出用于 README 和提交材料的结构化说明。
```

AI 作用：

- 提炼项目定位和功能层级。
- 把散落在代码、README、设计文档中的能力整合为统一叙事。
- 帮助形成面向评委的表达顺序。

人工作用：

- 决定 Petclaw 的核心卖点。
- 判断哪些功能适合放进最终提交。
- 校正项目命名、中文表述和参赛重点。

## 2. 需求拆解 Prompt

目标：把新功能先转成设计文档，而不是直接改代码。

示例 Prompt：

```text
我要为 Petclaw 增加一个桌面宠物成长/专注冒险功能。
请先读取现有 Electron 项目结构，按“目标、现有上下文、核心循环、数据模型、UI、错误处理、测试、验收标准”写设计文档。
不要直接实现，先明确 P0 范围和不做的内容。
```

沉淀证据：

- `evidence/superpowers-specs/2026-05-05-p0-gamified-focus-skill-design.md`
- `evidence/superpowers-specs/2026-05-06-lifelike-pet-gamification-design.md`
- `evidence/superpowers-specs/2026-05-07-pet-affinity-design.md`

## 3. 实现计划 Prompt

目标：把设计文档转成可执行计划，明确文件边界、测试顺序和验收命令。

示例 Prompt：

```text
请根据已确认的设计文档，生成 TDD 风格实现计划。
每个任务需要包含：要改的文件、先写哪些失败测试、如何实现、如何验证、何时提交。
请尽量复用现有模块风格，不引入不必要的新框架。
```

沉淀证据：

- `evidence/superpowers-plans/2026-05-05-p0-gamified-focus-skill.md`
- `evidence/superpowers-plans/2026-05-07-file-inbox-helper.md`
- `evidence/superpowers-plans/2026-05-07-pet-affinity.md`

## 4. 代码实现 Prompt

目标：在已有 Electron、Node.js、Jest 架构中做小步实现。

示例 Prompt：

```text
按实现计划执行当前任务。
先写/更新 Jest 测试，确认失败原因，再实现对应模块。
保持 IPC channel 白名单、安全路径、日志脱敏和本地配置隔离。
完成后运行 targeted tests 和 node --check，说明验证结果。
```

AI 作用：

- 生成模块代码、测试用例、IPC 接线、UI 片段。
- 根据测试失败信息迭代修复。
- 总结变更和验证结果。

人工作用：

- 选择优先级。
- 运行桌面端做手动体验验收。
- 决定是否保留功能形态和交互文案。

## 5. 图片生成 Prompt

目标：为自定义宠物生成 spritesheet 资源。

证据文件：

- `evidence/imagegen/imagegen-prompt.md`
- `evidence/imagegen/imagegen-jobs.json`
- `evidence/imagegen/spritesheet.png`

Prompt 设计要点：

- 明确资源类型：透明像素风桌面宠物 spritesheet。
- 明确尺寸：8 列 x 10 行，每格 192 x 208。
- 明确状态顺序：idle、happy、talking、thinking、sleepy、surprised、focused、offline、sad、walking。
- 明确约束：无文字、无水印、无场景、无阴影、居中、统一比例。

## 6. 提交材料整理 Prompt

目标：把开发过程整理成评审能看懂的 AI 使用记录。

示例 Prompt：

```text
我要提交作品，要求 AI 使用记录为 zip/rar 压缩包，包含 Prompt 设计、迭代思路、生成内容占比，截图或日志均可。
请基于当前 Petclaw-git 仓库整理提交包，包含主文档和 evidence 目录，注意不要包含密钥或隐私配置。
```
