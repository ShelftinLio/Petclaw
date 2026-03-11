Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 截取全屏
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

# 推导项目根目录并构建输出路径
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $ProjectRoot "docs\images"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}
$outputPath = Join-Path $outputDir "desktop-view.png"

# 保存
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

Write-Host "✅ 截图保存: $outputPath"

# 清理
$graphics.Dispose()
$bitmap.Dispose()
