# 创建桌面龙虾快捷方式
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "🦞 桌面龙虾.lnk"

# 推导项目根目录（脚本位于项目根）
$ProjectRoot = $PSScriptRoot

# 创建快捷方式对象
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

# 优先直接启动 electron.exe，避免 cmd/powershell 窗口
$ElectronExe = Join-Path $ProjectRoot "node_modules\electron\dist\electron.exe"
if (Test-Path $ElectronExe) {
    $Shortcut.TargetPath = $ElectronExe
    $Shortcut.Arguments = $ProjectRoot
} else {
    # Fallback：开发环境仍可用 npm start
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-NoExit -Command `"cd '$ProjectRoot'; npm start`""
}
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.Description = "桌面龙虾 - 透明AI伴侣"
$IconPath = Join-Path $ProjectRoot "icon.ico"
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = $IconPath
}
$Shortcut.WindowStyle = 7  # 最小化启动

# 保存快捷方式
$Shortcut.Save()

Write-Host "✅ 快捷方式已创建: $ShortcutPath" -ForegroundColor Green
