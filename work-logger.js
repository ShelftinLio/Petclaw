// 工作日志系统
const fs = require('fs').promises;
const path = require('path');

class WorkLogger {
    constructor(logDir) {
        this.logDir = logDir || path.join(process.env.USERPROFILE || process.env.HOME, 'openclaw-data', 'memory');
        this.currentDate = this.getToday();
        this.sessionLog = [];
        this.initialized = false;
        this.initPromise = this.ensureLogDir();
    }

    async ensureLogDir() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
            this.initialized = true;
        } catch (err) {
            console.error('创建日志目录失败:', err);
        }
    }

    getToday() {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    async log(type, content, metadata = {}) {
        // 确保目录已创建
        if (!this.initialized) {
            await this.initPromise;
        }

        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            type,
            content,
            ...metadata
        };

        this.sessionLog.push(entry);

        // 写入日志文件
        const logFile = path.join(this.logDir, `${this.currentDate}.md`);
        const logLine = this.formatLogEntry(entry);

        try {
            await fs.appendFile(logFile, logLine + '\n', 'utf8');
        } catch (err) {
            console.error('写入日志失败:', err);
        }

        return entry;
    }

    formatLogEntry(entry) {
        const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        let emoji = '📝';
        switch (entry.type) {
            case 'message': emoji = '💬'; break;
            case 'task': emoji = '🎯'; break;
            case 'error': emoji = '❌'; break;
            case 'success': emoji = '✅'; break;
            case 'thinking': emoji = '🤔'; break;
            case 'voice': emoji = '🔊'; break;
        }

        return `### ${time} ${emoji} ${entry.type}\n${entry.content}\n`;
    }

    // 记录不同类型的事件
    async logMessage(sender, content) {
        return this.log('message', `**${sender}**: ${content}`);
    }

    async logTask(task, status = 'started') {
        return this.log('task', `${status}: ${task}`);
    }

    async logError(error) {
        return this.log('error', `${error.message || error}`);
    }

    async logSuccess(message) {
        return this.log('success', message);
    }

    getSessionLog() {
        return this.sessionLog;
    }

    /**
     * 获取最近的消息记录（用于三击历史查看）
     * @param {number} count - 返回的消息数量
     * @returns {Array} 最近的消息列表
     */
    getRecentMessages(count = 10) {
        // 从sessionLog中筛选message类型的日志
        const messages = this.sessionLog
            .filter(entry => entry.type === 'message')
            .slice(-count)
            .reverse()
            .map(entry => {
                // 解析 "**sender**: content" 格式
                const match = entry.content.match(/^\*\*(.+?)\*\*:\s*(.+)$/s);
                if (match) {
                    return {
                        timestamp: entry.timestamp,
                        sender: match[1],
                        content: match[2],
                        type: entry.type,
                    };
                }
                return {
                    timestamp: entry.timestamp,
                    sender: '',
                    content: entry.content,
                    type: entry.type,
                };
            });
        
        return messages;
    }
}

module.exports = WorkLogger;
