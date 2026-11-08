const { app, BrowserWindow, Tray, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let tray = null;
let mainWindow = null;
let devServer = null;

// 启动开发服务器
function startDevServer() {
    devServer = spawn('npm', ['run', 'dev:client'], {
        cwd: __dirname,
        shell: true
    });
    
    devServer.stdout.on('data', (data) => {
        console.log(`Dev Server: ${data}`);
    });
    
    devServer.stderr.on('data', (data) => {
        console.error(`Dev Server Error: ${data}`);
    });
}

// 停止开发服务器
function stopDevServer() {
    if (devServer) {
        devServer.kill();
        devServer = null;
    }
}

// 创建托盘图标
function createTray() {
    // 这里需要一个图标文件，我们用默认的
    tray = new Tray(path.join(__dirname, 'assets/icon.png'));
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '打开实验小森林',
            click: () => {
                shell.openExternal('http://localhost:3000');
            }
        },
        {
            label: '启动服务器',
            click: startDevServer
        },
        {
            label: '停止服务器',
            click: stopDevServer
        },
        { type: 'separator' },
        {
            label: '关于',
            click: () => {
                // 显示关于信息
            }
        },
        {
            label: '退出',
            click: () => {
                stopDevServer();
                app.quit();
            }
        }
    ]);
    
    tray.setToolTip('实验小森林 - 科研管理平台');
    tray.setContextMenu(contextMenu);
    
    // 双击托盘图标打开浏览器
    tray.on('double-click', () => {
        shell.openExternal('http://localhost:3000');
    });
}

app.whenReady().then(() => {
    createTray();
    startDevServer();
    
    // 延迟打开浏览器
    setTimeout(() => {
        shell.openExternal('http://localhost:3000');
    }, 3000);
});

app.on('window-all-closed', (e) => {
    e.preventDefault(); // 阻止应用退出
});

app.on('before-quit', () => {
    stopDevServer();
});