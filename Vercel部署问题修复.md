# 🔧 Vercel部署问题修复指南

**作者**: 蔡志宇  
**邮箱**: 3210102604@zju.edu.cn

## ❌ 遇到的问题

### 问题1: 路径解析错误
```
[vite:build-html] Failed to resolve /src/main.tsx from /vercel/path0/index.html
```

### 问题2: Function Runtimes错误
```
Error: Function Runtimes must have a valid version, for example `now-php@1.0.0`.
```

## 🔍 问题原因

### 问题1: 路径解析错误
1. **构建脚本配置错误**: `package.json`中的build脚本输出路径与vercel.json不匹配
2. **输出目录不一致**: build:client使用`dist/static`，但vercel.json配置的是`dist`
3. **复杂的构建流程**: 原构建脚本包含了多个步骤，在Vercel环境下可能出错

### 问题2: Function Runtimes错误
1. **不必要的functions配置**: 对于纯React前端项目，不需要functions配置
2. **错误的runtime格式**: 配置格式不符合Vercel要求

## ✅ 修复方案

### 1. 修复package.json构建脚本

**修改前**:
```json
{
  "scripts": {
    "build:client": "vite build --outDir dist/static",
    "build": "rimraf dist && npm run build:client && copy package.json dist && echo. > dist/build.flag"
  }
}
```

**修改后**:
```json
{
  "scripts": {
    "build:client": "vite build --outDir dist",
    "build": "vite build --outDir dist",
    "preview": "vite preview"
  }
}
```

### 2. 优化vite.config.ts

**新增配置**:
```typescript
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

### 3. 更新vercel.json

**优化后配置**:
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

### 4. 移除不必要的functions配置

**❌ 错误配置** (导致Function Runtimes错误):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "functions": {
    "app/api/**/*.js": {
      "runtime": "nodejs18.x"
    }
  }
}
```

**✅ 正确配置** (纯前端项目不需要functions):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## 🚀 重新部署步骤

### 方法一：推送修复到GitHub（推荐）

```bash
# 在项目根目录执行
git add .
git commit -m "fix: 修复Vercel部署构建路径问题"
git push
```

Vercel会自动检测到更改并重新部署。

### 方法二：重新从GitHub导入

1. 删除Vercel中的项目
2. 重新从GitHub导入项目
3. Vercel会使用新的配置进行构建

### 方法三：手动重新部署

在Vercel项目面板中：
1. 点击 "Deployments" 标签
2. 点击最新部署右侧的三个点
3. 选择 "Redeploy"

## ✅ 验证修复

修复后的构建应该：
1. ✅ 成功找到`src/main.tsx`
2. ✅ 正确输出到`dist`目录
3. ✅ 生成正确的静态资源路径
4. ✅ 部署成功并可以访问

## 📋 本地测试命令

在推送到GitHub之前，建议本地测试：

```bash
# 清除之前的构建
npm run build

# 检查dist目录内容
ls dist/

# 预览构建结果
npm run preview
```

## 🔄 如果仍然失败

如果修复后仍然失败，请检查：

1. **确保文件路径正确**
   - `src/main.tsx` 文件存在
   - `index.html` 正确引用了 `/src/main.tsx`

2. **检查依赖**
   - 所有依赖都在 `package.json` 中
   - 没有缺失的devDependencies

3. **Vercel设置**
   - 确认Framework Preset设为"Vite"
   - 构建命令设为"npm run build"
   - 输出目录设为"dist"

## 📞 获得帮助

如果问题仍然存在：
- **作者**: 蔡志宇
- **邮箱**: 3210102604@zju.edu.cn
- 提供完整的错误日志信息

---

**修复完成后，您的实验小森林应该可以成功部署到Vercel了！🎉**