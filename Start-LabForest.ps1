# 实验小森林启动脚本
# PowerShell 版本 - 提供更好的用户体验

param(
    [switch]$NoOpen,  # 不自动打开浏览器
    [switch]$Install,  # 强制重新安装依赖
    [int]$Port = 3000  # 自定义端口
)

# 设置控制台编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 美化输出函数
function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

function Write-Banner {
    Clear-Host
    Write-ColorText "════════════════════════════════════════" "Cyan"
    Write-ColorText "    🧪 实验小森林 - 科研管理平台" "Green"
    Write-ColorText "    Laboratory Forest Management System" "Gray"
    Write-ColorText "════════════════════════════════════════" "Cyan"
    Write-Host ""
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# 显示横幅
Write-Banner

# 切换到脚本所在目录
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptPath
Write-ColorText "📁 工作目录: $ScriptPath" "Yellow"
Write-Host ""

# 检查系统环境
Write-ColorText "🔍 检查系统环境..." "Cyan"

if (-not (Test-Command "node")) {
    Write-ColorText "❌ 错误: 未检测到 Node.js" "Red"
    Write-ColorText "请先安装 Node.js: https://nodejs.org/" "Yellow"
    Write-ColorText "建议安装 LTS 版本" "Gray"
    Read-Host "按回车键退出"
    exit 1
}

$nodeVersion = node --version
Write-ColorText "✅ Node.js 版本: $nodeVersion" "Green"

if (-not (Test-Command "npm")) {
    Write-ColorText "❌ 错误: npm 不可用" "Red"
    Read-Host "按回车键退出"
    exit 1
}

$npmVersion = npm --version
Write-ColorText "✅ npm 版本: $npmVersion" "Green"
Write-Host ""

# 检查并安装依赖
if ($Install -or -not (Test-Path "node_modules")) {
    Write-ColorText "📦 正在安装/更新项目依赖..." "Cyan"
    Write-ColorText "这可能需要几分钟，请耐心等待..." "Yellow"
    
    try {
        $installResult = npm install
        if ($LASTEXITCODE -eq 0) {
            Write-ColorText "✅ 依赖安装完成" "Green"
        } else {
            throw "npm install failed"
        }
    }
    catch {
        Write-ColorText "❌ 依赖安装失败" "Red"
        Write-ColorText "请检查网络连接或尝试手动运行: npm install" "Yellow"
        Read-Host "按回车键退出"
        exit 1
    }
    Write-Host ""
}

# 检查端口是否被占用
$portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-ColorText "⚠️  警告: 端口 $Port 已被占用" "Yellow"
    Write-ColorText "尝试使用其他端口..." "Yellow"
    $Port = 3001
}

# 启动开发服务器
Write-ColorText "🚀 正在启动实验小森林..." "Cyan"
Write-ColorText "端口: $Port" "Gray"
Write-Host ""

if (-not $NoOpen) {
    Write-ColorText "🌐 将在 3 秒后自动打开浏览器..." "Yellow"
    Write-ColorText "如果没有自动打开，请手动访问: http://localhost:$Port" "Gray"
}

Write-Host ""
Write-ColorText "════════════════════════════════════════" "Cyan"
Write-ColorText "💡 使用提示:" "Green"
Write-ColorText "  • 按 Ctrl+C 停止服务器" "Gray"
Write-ColorText "  • 服务器启动后请保持此窗口打开" "Gray"
Write-ColorText "  • 关闭浏览器不会停止服务器" "Gray"
Write-ColorText "════════════════════════════════════════" "Cyan"
Write-Host ""

# 设置环境变量
$env:PORT = $Port

# 启动服务器
try {
    if (-not $NoOpen) {
        # 延迟打开浏览器
        Start-Job -ScriptBlock {
            Start-Sleep 5
            Start-Process "http://localhost:$using:Port"
        } | Out-Null
    }
    
    # 启动开发服务器
    npm run dev:client
}
catch {
    Write-ColorText "❌ 启动失败: $($_.Exception.Message)" "Red"
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-ColorText "👋 实验小森林已停止运行" "Yellow"
Read-Host "按回车键退出"