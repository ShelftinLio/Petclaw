// OpenClaw 自动更新检查器
const { exec, execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const openClawPathResolver = require('./openclaw-path-resolver');

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

class OpenClawUpdater {
    constructor(voiceSystem = null, workLogger = null) {
        this.voiceSystem = voiceSystem;
        this.workLogger = workLogger;
        this.updateCheckInterval = null;
    }

    /**
     * 检查是否有更新
     */
    async checkForUpdates() {
        try {
            // 获取当前版本
            const currentVersion = await this.getCurrentVersion();

            // 获取最新版本
            const latestVersion = await this.getLatestVersion();

            if (!currentVersion || !latestVersion) {
                console.log('⚠️ 无法检查更新');
                return { hasUpdate: false };
            }

            console.log(`📦 OpenClaw: 当前 ${currentVersion}, 最新 ${latestVersion}`);

            // 比较版本
            const hasUpdate = this.compareVersions(currentVersion, latestVersion) < 0;

            return {
                hasUpdate,
                currentVersion,
                latestVersion
            };
        } catch (err) {
            console.error('检查更新失败:', err.message);
            return { hasUpdate: false };
        }
    }

    async _runOpenClawCommand(args, timeout = 5000) {
        const invocation = openClawPathResolver.resolveOpenClawInvocation(args);
        if (!invocation) {
            throw new Error('未检测到已安装的 openclaw');
        }

        return await execFileAsync(invocation.command, invocation.args, {
            cwd: invocation.cwd,
            windowsHide: invocation.windowsHide ?? true,
            timeout,
        });
    }

    /**
     * 获取当前版本
     */
    async getCurrentVersion() {
        try {
            const { stdout } = await this._runOpenClawCommand(['--version'], 5000);
            return stdout.trim();
        } catch (err) {
            console.error('获取当前版本失败:', err.message);
            return null;
        }
    }

    /**
     * 获取最新版本
     */
    async getLatestVersion() {
        try {
            const { stdout } = await execAsync('npm view openclaw version', { timeout: 10000, windowsHide: true });
            return stdout.trim();
        } catch (err) {
            console.error('获取最新版本失败:', err.message);
            return null;
        }
    }

    /**
     * 比较版本号
     * @returns {number} -1: current < latest, 0: equal, 1: current > latest
     */
    compareVersions(current, latest) {
        // 简单的版本比较，适用于 YYYY.M.D 或 YYYY.M.D-N 格式
        const parseVersion = (v) => {
            const parts = v.replace(/-/g, '.').split('.').map(p => parseInt(p) || 0);
            return parts;
        };

        const c = parseVersion(current);
        const l = parseVersion(latest);

        for (let i = 0; i < Math.max(c.length, l.length); i++) {
            const cv = c[i] || 0;
            const lv = l[i] || 0;
            if (cv < lv) return -1;
            if (cv > lv) return 1;
        }

        return 0;
    }

    /**
     * 获取 openclaw 安装目录和关键入口文件路径
     */
    _getOpenclawPaths() {
        const entryFile = openClawPathResolver.findOpenClawPath();
        if (!entryFile) {
            return { installDir: null, entryFile: null, backupDir: null };
        }

        const installDir = path.dirname(path.dirname(entryFile));
        const backupDir = path.join(path.dirname(installDir), '.openclaw-backup');
        return { installDir, entryFile, backupDir };
    }

    /**
     * 执行自动更新（带备份保护）
     */
    async performUpdate(currentVersion, latestVersion) {
        const { installDir, entryFile, backupDir } = this._getOpenclawPaths();

        try {
            console.log(`🔄 开始更新 OpenClaw: ${currentVersion} -> ${latestVersion}`);

            if (this.voiceSystem) {
                this.voiceSystem.speak(`检测到新版本，正在更新 OpenClaw`);
            }

            if (this.workLogger) {
                this.workLogger.log('action', `OpenClaw 更新: ${currentVersion} -> ${latestVersion}`);
            }

            // 备份旧版本
            if (installDir && fs.existsSync(installDir)) {
                if (fs.existsSync(backupDir)) {
                    fs.rmSync(backupDir, { recursive: true, force: true });
                }
                fs.cpSync(installDir, backupDir, { recursive: true });
                console.log('📦 已备份旧版本');
            }

            // 执行更新
            const { stdout, stderr } = await execAsync(
                'npm install -g openclaw@latest',
                { timeout: 120000, windowsHide: true }
            );

            console.log(stdout);

            // 验证关键文件是否存在
            if (!entryFile || !fs.existsSync(entryFile)) {
                console.error('❌ 更新后 dist/index.js 不存在，回滚到旧版本');
                if (backupDir && fs.existsSync(backupDir) && installDir) {
                    if (fs.existsSync(installDir)) {
                        fs.rmSync(installDir, { recursive: true, force: true });
                    }
                    fs.cpSync(backupDir, installDir, { recursive: true });
                    console.log('✅ 已回滚到旧版本');

                    if (this.workLogger) {
                        this.workLogger.logError(`OpenClaw ${latestVersion} 安装不完整，已回滚到 ${currentVersion}`);
                    }
                }
                return { success: false, error: '新版本缺少 dist/index.js，已回滚' };
            }

            // 更新成功，清理备份
            if (backupDir && fs.existsSync(backupDir)) {
                fs.rmSync(backupDir, { recursive: true, force: true });
            }

            console.log('✅ OpenClaw 更新完成');

            if (this.workLogger) {
                this.workLogger.log('success', `OpenClaw 更新成功: ${latestVersion}`);
            }

            await this.runDoctor();

            return { success: true, version: latestVersion };
        } catch (err) {
            console.error('❌ OpenClaw 更新失败:', err.message);

            // npm install 失败时也尝试回滚
            if (backupDir && fs.existsSync(backupDir) && (!entryFile || !fs.existsSync(entryFile)) && installDir) {
                try {
                    if (fs.existsSync(installDir)) {
                        fs.rmSync(installDir, { recursive: true, force: true });
                    }
                    fs.cpSync(backupDir, installDir, { recursive: true });
                    console.log('✅ 已回滚到旧版本');
                } catch (rollbackErr) {
                    console.error('回滚也失败了:', rollbackErr.message);
                }
            }

            if (this.workLogger) {
                this.workLogger.logError(`OpenClaw 更新失败: ${err.message}`);
            }

            return { success: false, error: err.message };
        }
    }

    /**
     * 运行 openclaw doctor
     */
    async runDoctor() {
        try {
            console.log('🔧 运行 openclaw doctor...');
            const { stdout } = await this._runOpenClawCommand(['doctor'], 30000);
            console.log(stdout);
        } catch (err) {
            console.error('运行 doctor 失败:', err.message);
        }
    }

    /**
     * 启动时检查并自动更新
     */
    async checkAndUpdateOnStartup() {
        console.log('🔍 检查 OpenClaw 更新...');

        const result = await this.checkForUpdates();

        if (result.hasUpdate) {
            console.log(`🎉 发现新版本: ${result.currentVersion} -> ${result.latestVersion}`);

            // 自动执行更新
            const updateResult = await this.performUpdate(result.currentVersion, result.latestVersion);

            if (updateResult.success) {
                if (this.voiceSystem) {
                    this.voiceSystem.speak(`OpenClaw 已更新到最新版本 ${result.latestVersion}`);
                }
                return { updated: true, version: result.latestVersion };
            } else {
                if (this.voiceSystem) {
                    this.voiceSystem.speak('OpenClaw 更新失败，请检查日志');
                }
                return { updated: false, error: updateResult.error };
            }
        } else {
            console.log('✅ OpenClaw 已是最新版本');
            return { updated: false, version: result.currentVersion };
        }
    }

    /**
     * 启动定期检查（每天一次）
     */
    startPeriodicCheck() {
        // 每24小时检查一次
        this.updateCheckInterval = setInterval(async () => {
            const result = await this.checkForUpdates();
            if (result.hasUpdate) {
                console.log(`🆕 发现新版本: ${result.latestVersion}，将在下次启动时自动更新`);
                if (this.voiceSystem) {
                    this.voiceSystem.speak(`OpenClaw 有新版本 ${result.latestVersion}，下次启动时自动更新`);
                }
            }
        }, 24 * 60 * 60 * 1000);
    }

    /**
     * 停止定期检查
     */
    stopPeriodicCheck() {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval);
            this.updateCheckInterval = null;
        }
    }
}

module.exports = OpenClawUpdater;
