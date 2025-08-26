# 🚀 实验小森林 - Vercel部署指南

**作者**: 蔡志宇  
**邮箱**: 3210102604@zju.edu.cn

## 📋 部署前准备

### 1. 确保账号准备
- ✅ GitHub账号
- ✅ Vercel账号（可用GitHub登录）

### 2. 项目文件检查
确保项目根目录包含以下文件：
- ✅ `package.json` - 项目依赖配置
- ✅ `vite.config.ts` - Vite构建配置  
- ✅ `vercel.json` - Vercel部署配置
- ✅ `src/` 文件夹 - 项目源代码

---

## 🌐 方法一：通过GitHub部署（推荐）

### 第1步：上传到GitHub

1. **创建GitHub仓库**
   ```bash
   # 在GitHub网站创建新仓库，名称如: lab-forest
   ```

2. **初始化Git并推送**
   ```bash
   # 在项目根目录执行
   git init
   git add .
   git commit -m "Initial commit: 实验小森林项目"
   git branch -M main
   git remote add origin https://github.com/你的用户名/lab-forest.git
   git push -u origin main
   ```

### 第2步：在Vercel部署

1. **登录Vercel**
   - 访问 https://vercel.com
   - 使用GitHub账号登录

2. **导入项目**
   - 点击 "New Project"
   - 选择GitHub中的项目仓库
   - 点击 "Import"

3. **配置构建设置**
   ```
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **部署**
   - 点击 "Deploy"
   - 等待构建完成（通常2-5分钟）

---

## 📦 方法二：拖拽部署（简单快速）

### 第1步：本地构建
```bash
# 在项目根目录执行
npm install
npm run build
```

### 第2步：上传到Vercel
1. 访问 https://vercel.com/new
2. 选择 "Browse" 上传文件
3. 将生成的 `dist` 文件夹拖拽到页面
4. 等待部署完成

---

## ⚙️ 关键配置说明

### Vercel配置 (`vercel.json`)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist", 
  "framework": "vite",
  "installCommand": "npm install",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Vite配置 (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: getPlugins(),
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  },
  base: '/',
});
```

---

## 🔧 常见问题解决

### 1. 路由问题
**问题**: 页面刷新后出现404错误  
**解决**: `vercel.json`中的rewrites配置已解决此问题

### 2. 构建失败
**问题**: TypeScript编译错误  
**解决**: 
```bash
# 本地测试构建
npm run build
# 修复所有TypeScript错误
```

### 3. 静态资源加载失败
**问题**: 图片、CSS等资源404  
**解决**: 确保`vite.config.ts`中`base: '/'`配置正确

### 4. AI功能无法使用
**问题**: 部署后AI聊天不工作  
**说明**: AI功能需要配置API密钥，在设置页面配置API端点

---

## 🌍 部署后配置

### 1. 自定义域名（可选）
- 在Vercel项目设置中添加自定义域名
- 配置DNS解析到Vercel

### 2. 环境变量
如需配置API密钥等敏感信息：
- 在Vercel项目设置 > Environment Variables
- 添加环境变量（如API_KEY等）

### 3. 性能优化
- 启用Vercel Analytics（免费）
- 配置CDN缓存策略

---

## 📱 部署成功后

### 访问地址
- Vercel会自动生成域名：`https://项目名.vercel.app`
- 可绑定自定义域名

### 功能验证
1. ✅ 页面正常加载
2. ✅ 实验记录功能
3. ✅ AI聊天功能（需配置API）
4. ✅ 思维导图功能
5. ✅ 数据本地存储

---

## 🔄 自动部署

连接GitHub后，每次推送代码都会自动触发部署：
```bash
git add .
git commit -m "更新功能"
git push
# Vercel自动开始构建和部署
```

---

## 🆘 技术支持

### 联系方式
- **作者**: 蔡志宇
- **邮箱**: 3210102604@zju.edu.cn

### 常用资源
- [Vercel官方文档](https://vercel.com/docs)
- [Vite部署指南](https://vitejs.dev/guide/static-deploy.html)

---

## 📋 部署清单

**部署前检查**：
- [ ] Node.js已安装
- [ ] 项目本地运行正常
- [ ] 所有依赖已安装
- [ ] 构建测试通过

**部署后验证**：
- [ ] 网站可以正常访问
- [ ] 所有页面功能正常
- [ ] 数据可以正常保存
- [ ] AI功能配置正确

---

**祝您部署成功！🎉**

*让实验小森林在云端绽放！*