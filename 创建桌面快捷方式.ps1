# 创建桌面快捷方式
$ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "实验小森林.lnk"

# 创建快捷方式对象
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

# 设置快捷方式属性
$Shortcut.TargetPath = Join-Path $ProjectPath "start-lab.bat"
$Shortcut.WorkingDirectory = $ProjectPath
$Shortcut.Description = "实验小森林 - 科研管理平台"
$Shortcut.IconLocation = "shell32.dll,21"  # 使用文件夹图标

# 保存快捷方式
$Shortcut.Save()

Write-Host "✅ 桌面快捷方式已创建: $ShortcutPath" -ForegroundColor Green
Write-Host "🎉 现在您可以双击桌面的'实验小森林'图标来启动应用！" -ForegroundColor Cyan

Read-Host "按回车键继续"