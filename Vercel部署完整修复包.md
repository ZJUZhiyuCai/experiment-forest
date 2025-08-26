# 🚀 实验小森林 - Vercel部署完整修复包

**作者**: 蔡志宇  
**邮箱**: 3210102604@zju.edu.cn

## ❌ 当前问题

```
[vite:build-html] Failed to resolve /src/main.tsx from /vercel/path0/index.html
```

## 📋 完整修复配置

### 1. package.json 修复

将您的 `package.json` scripts 部分替换为：

```json
{
  "scripts": {
    "dev": "vite --host --port 3000",
    "build": "vite build",
    "preview": "vite preview",
    "dev:client": "vite --host --port 3000",
    "build:client": "vite build"
  }
}
```

### 2. vite.config.ts 完整配置

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

function getPlugins() {
  const plugins = [react(), tsconfigPaths()];
  return plugins;
}

export default defineConfig({
  plugins: getPlugins(),
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  base: '/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

### 3. vercel.json 最简配置

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 4. index.html 验证

确保您的 `index.html` 包含正确的脚本引用：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>实验小森林 - 记录每一次科学的萌芽</title>
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      crossorigin="anonymous"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## 🚀 立即修复步骤

### 步骤1: 更新GitHub仓库

在您的项目根目录执行：

```bash
# 1. 更新package.json scripts部分
# 2. 更新vite.config.ts完整内容  
# 3. 更新vercel.json配置
# 4. 验证index.html内容

# 推送修复
git add .
git commit -m "fix: 完整修复Vercel部署配置 - 简化构建脚本和优化配置"
git push
```

### 步骤2: 验证本地构建

```bash
# 本地测试构建
npm run build

# 应该看到：
# ✓ 581 modules transformed.
# dist/index.html
# dist/assets/...
```

### 步骤3: 强制重新部署

在Vercel控制台：
1. 进入项目 → Deployments
2. 点击最新部署的三个点菜单
3. 选择 "Redeploy"

## 🔍 关键修复点

### ❌ 错误的配置
```json
// package.json - 错误
{
  "scripts": {
    "build:client": "vite build --outDir dist/static",
    "build": "rimraf dist && npm run build:client && copy package.json dist"
  }
}
```

### ✅ 正确的配置  
```json
// package.json - 正确
{
  "scripts": {
    "build": "vite build"
  }
}
```

## 📊 修复验证清单

- [ ] package.json scripts 已简化
- [ ] vite.config.ts 输出目录为 'dist'
- [ ] vercel.json 配置正确
- [ ] index.html 脚本路径正确
- [ ] 本地 `npm run build` 成功
- [ ] GitHub 代码已更新
- [ ] Vercel 重新部署

## 🆘 如果仍然失败

如果按照以上步骤修复后仍然失败：

1. **检查文件路径**
   ```bash
   # 确保这些文件存在
   ls src/main.tsx
   ls index.html
   ```

2. **清除构建缓存**
   ```bash
   rm -rf dist
   rm -rf node_modules
   npm install
   npm run build
   ```

3. **联系技术支持**
   - 作者：蔡志宇
   - 邮箱：3210102604@zju.edu.cn

---

**按照此修复包操作，您的实验小森林应该可以成功部署到Vercel！🌲✨**