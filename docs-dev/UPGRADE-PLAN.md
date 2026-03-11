# 🦞 桌面龙虾升级建议 v1.1.0 → v2.0

## 🎯 核心痛点分析

### 当前问题:
1. ❌ **容易被关闭** - 窗口意外关闭后需要手动重启
2. ❌ **缺乏截图反馈** - 做完事不会截图展示结果
3. ❌ **交互单一** - 只能被动接收,不能主动交互
4. ❌ **表情静态** - 表情图片固定,不够生动
5. ❌ **功能入口隐藏** - 没有菜单,功能不直观

---

## 🚀 升级建议 (按优先级排序)

### ⭐⭐⭐⭐⭐ **高优先级 (必须做)**

#### 1. **自动重启机制**
**问题:** 窗口关闭后需要手动启动
**方案:**
```javascript
// 守护进程监控
const { spawn } = require('child_process');

function startGuardian() {
    let child;
    
    function start() {
        child = spawn('npm', ['start'], {
            cwd: __dirname,
            stdio: 'inherit'
        });
        
        child.on('exit', (code) => {
            console.log('龙虾进程退出,3秒后重启...');
            setTimeout(start, 3000);
        });
    }
    
    start();
}
```

**效果:**
- ✅ 意外崩溃自动重启
- ✅ 永不掉线
- ✅ 开机自启动(配合系统服务)

---

#### 2. **截图反馈功能** 🔥
**问题:** 做完事看不到结果
**方案:** 集成 Desktop Control 技能
```javascript
const { exec } = require('child_process');

async function takeScreenshot(reason) {
    // 调用 desktop-control 技能截图
    const timestamp = Date.now();
    const path = `${os.tmpdir()}\\screenshots\\${timestamp}.png`;
    
    await exec(`node screenshot.js --output "${path}"`);
    
    // 在龙虾窗口显示缩略图
    showThumbnail(path, reason);
    
    // 发送到飞书
    await uploadToLark(path, reason);
    
    return path;
}

// 使用示例
async function completeTask(taskName) {
    notify(`✅ ${taskName} 完成!`);
    
    // 延迟1秒,等待界面更新
    await sleep(1000);
    
    // 截图反馈
    const screenshot = await takeScreenshot(taskName);
    notify(`📸 截图已保存: ${screenshot}`);
}
```

**效果:**
- ✅ 任务完成自动截图
- ✅ 发送到飞书
- ✅ 龙虾窗口显示缩略图
- ✅ 可视化反馈

---

#### 3. **右键菜单 + 快捷操作**
**问题:** 功能入口隐藏,不够直观
**方案:**
```javascript
// 右键菜单
const { Menu } = require('electron');

const contextMenu = Menu.buildFromTemplate([
    { label: '📊 查看技能列表', click: () => showSkills() },
    { label: '📸 立即截图', click: () => takeScreenshot('手动截图') },
    { label: '🎙️ 切换语音', type: 'checkbox', checked: voiceEnabled },
    { label: '😊 切换表情', submenu: [
        { label: '😊 开心', click: () => setMood('happy') },
        { label: '🤔 思考', click: () => setMood('thinking') },
        { label: '😴 休息', click: () => setMood('sleeping') },
        { label: '🎉 兴奋', click: () => setMood('excited') },
    ]},
    { type: 'separator' },
    { label: '📝 打开日志', click: () => openLog() },
    { label: '⚙️ 设置', click: () => openSettings() },
    { type: 'separator' },
    { label: '🔄 重启', click: () => app.relaunch() },
    { label: '❌ 退出', click: () => app.quit() },
]);

// 双击龙虾 - 快捷输入
win.on('dblclick', () => {
    showQuickInput(); // 弹出输入框,快速发送消息
});
```

**效果:**
- ✅ 右键显示菜单
- ✅ 快速访问功能
- ✅ 双击快捷输入

---

### ⭐⭐⭐⭐☆ **中优先级 (建议做)**

#### 4. **动画表情系统**
**问题:** 表情静态,不够生动
**方案:**
```javascript
// 使用 Lottie 动画 或 GIF
const moods = {
    thinking: {
        animation: 'thinking.json', // Lottie 动画
        duration: 3000,
        loop: true
    },
    typing: {
        gif: 'typing.gif',
        loop: true
    },
    excited: {
        frames: ['excited1.png', 'excited2.png', 'excited3.png'],
        fps: 10
    }
};

// 或者用 Canvas 实时绘制
function drawAnimatedPet(ctx, mood, frame) {
    // 根据 mood 和 frame 绘制动画帧
    // 眨眼、摇尾巴、打字动作等
}
```

**新增表情:**
- 😴 **sleeping** - 打瞌睡(眼睛半闭)
- ⌨️ **typing** - 打字中(手指敲击)
- 🔍 **searching** - 搜索中(放大镜)
- 🐛 **debugging** - 调试中(拿着扳手)
- 🎉 **celebrating** - 庆祝(撒花)

---

#### 5. **主动提醒系统**
**问题:** 只能被动接收,不够主动
**方案:**
```javascript
// 定时检查系统
const checks = {
    // 每30分钟提醒休息
    breakReminder: {
        interval: 30 * 60 * 1000,
        check: () => {
            const now = Date.now();
            const lastBreak = getLastBreak();
            if (now - lastBreak > 30 * 60 * 1000) {
                notify('🧘 该休息一下了!已经工作30分钟了', { 
                    sound: true,
                    mood: 'concerned' 
                });
            }
        }
    },
    
    // 检查有无新邮件(IMAP Idle)
    emailCheck: {
        realtime: true,
        check: async () => {
            const unread = await checkEmail();
            if (unread > 0) {
                notify(`📧 你有 ${unread} 封未读邮件`, {
                    sound: true,
                    mood: 'alert'
                });
            }
        }
    },
    
    // 检查项目进度
    projectCheck: {
        interval: 60 * 60 * 1000, // 每小时
        check: async () => {
            const tasks = await checkTasks();
            if (tasks.urgent.length > 0) {
                notify(`⚠️ 有 ${tasks.urgent.length} 个紧急任务待处理`, {
                    mood: 'urgent'
                });
            }
        }
    }
};
```

**效果:**
- ✅ 主动提醒休息
- ✅ 邮件实时通知
- ✅ 任务提醒
- ✅ 定时健康提示

---

#### 6. **托盘图标 + 最小化**
**问题:** 窗口一直显示,有时碍事
**方案:**
```javascript
const { Tray, Menu } = require('electron');

// 创建托盘图标
let tray = new Tray('icon.png');

const trayMenu = Menu.buildFromTemplate([
    { label: '显示龙虾', click: () => win.show() },
    { label: '隐藏龙虾', click: () => win.hide() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
]);

tray.setContextMenu(trayMenu);

// 点击托盘图标切换显示/隐藏
tray.on('click', () => {
    win.isVisible() ? win.hide() : win.show();
});

// 关闭窗口时最小化到托盘
win.on('close', (event) => {
    if (!app.isQuitting) {
        event.preventDefault();
        win.hide();
    }
});
```

**效果:**
- ✅ 最小化到托盘
- ✅ 快速显示/隐藏
- ✅ 不占用任务栏

---

### ⭐⭐⭐☆☆ **低优先级 (锦上添花)**

#### 7. **皮肤系统**
```javascript
const themes = {
    default: { dragon: '🦞', color: '#ff6b6b' },
    cat: { dragon: '🐱', color: '#ffd93d' },
    robot: { dragon: '🤖', color: '#6bcf7f' },
    ghost: { dragon: '👻', color: '#b8b8ff' },
};

function changeSkin(themeName) {
    const theme = themes[themeName];
    updatePetAppearance(theme);
}
```

#### 8. **数据统计面板**
```javascript
// 显示工作统计
function showStats() {
    return {
        today: {
            messages: 50,
            voiceTime: '10分钟',
            tasks: 5,
            screenshots: 3
        },
        thisWeek: {
            activeTime: '20小时',
            tasksCompleted: 30
        }
    };
}
```

#### 9. **语音识别输入**
```javascript
// 点击龙虾,语音输入
async function startVoiceInput() {
    const text = await speechToText();
    sendToAI(text);
}
```

#### 10. **拖拽文件处理**
```javascript
// 拖文件到龙虾上
win.on('drop', async (files) => {
    if (files[0].endsWith('.py')) {
        notify('收到Python文件,要不要我帮你分析一下?');
    }
});
```

---

## 📋 推荐实施路线图

### **v1.2.0 - 稳定性升级** (1-2天)
- ✅ 自动重启机制
- ✅ 托盘图标
- ✅ 右键菜单

### **v1.3.0 - 反馈升级** (2-3天)
- ✅ 截图反馈功能
- ✅ 发送到飞书

### **v1.4.0 - 交互升级** (3-5天)
- ✅ 动画表情系统
- ✅ 双击快捷输入
- ✅ 主动提醒系统

### **v2.0.0 - 完整体验** (1周)
- ✅ 皮肤系统
- ✅ 数据统计
- ✅ 语音识别
- ✅ 拖拽文件

---

## 🎯 最优先推荐 (本周可做):

1. **自动重启机制** (30分钟)
2. **托盘图标** (1小时)
3. **右键菜单** (1小时)
4. **截图反馈** (2小���)

**预计4-5小时完成,舒适度提升巨大!** 🚀

---

## 💡 技术参考

### 截图功能:
```bash
# 方案1: 用 desktop-control 技能
node screenshot.js

# 方案2: 用 PowerShell
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::PrimaryScreen

# 方案3: 用 electron 内置
win.capturePage().then(image => ...)
```

### 自动重启:
```bash
# 方案1: Node.js 守护进程
node guardian.js

# 方案2: Windows 服务
nssm install ClawPet "npm start"

# 方案3: 任务计划程序
schtasks /create /tn "ClawPet" /sc onlogon
```

---

**要不要我帮你实现这些功能?从哪个开始?** 🦞
