# WUKDS 键帽配色预览工具

这是一个用于预览和自定义 WUKDS 三周年活动键帽配色的网页工具。

## 功能特性

- 🎨 **六色自定义**：支持自定义 A-F 六个颜色区域
  - A: 字符颜色
  - B: 主体颜色
  - C-F: 四种渐变色带颜色
- 🎯 **预设配色方案**：内置多种预设配色，一键应用
- 💾 **导出功能**：将自定义配色导出为 PNG 图片
- 📱 **响应式设计**：支持桌面端和移动端
- ⚡ **实时预览**：颜色变化实时反映在预览区域

## 使用方法

1. 在浏览器中打开 `index.html`
2. 使用左侧的颜色选择器调整 A-F 六种颜色
3. 或点击预设配色方案快速应用
4. 点击"导出图片"按钮保存自定义配色

## 添加预设配色方案

编辑 `config.js` 文件，在 `presetSchemes` 数组中添加新的配色方案：

```javascript
{
  name: '配色方案名称',
  colors: {
    A: '#FFFFFF',  // 字符颜色
    B: '#8B1A1A',  // 主体颜色
    C: '#FF8C42',  // 色带颜色一
    D: '#FFB884',  // 色带颜色二
    E: '#FFCFA8',  // 色带颜色三
    F: '#FFE4C8'   // 色带颜色四
  }
}
```

## 文件结构

```
wukds-preview/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── app.js              # 核心逻辑
├── config.js           # 配置文件（预设配色方案）
├── assets/
│   └── original.png    # 原始键帽图片
└── README.md           # 说明文档
```

## 技术说明

- 使用 Canvas API 进行像素级颜色替换
- 基于 RGB 色彩空间距离匹配颜色
- 防抖处理优化性能
- 纯前端实现，无需服务器

## 浏览器兼容性

支持所有现代浏览器（Chrome、Firefox、Safari、Edge）

## 部署到 GitHub Pages

### 方法一：使用 GitHub Actions（推荐）

项目已配置 GitHub Actions 工作流，每次推送到 `main` 分支时会自动部署。

**步骤：**

1. 将代码推送到 GitHub 仓库：
   ```bash
   git add .
   git commit -m "初始提交"
   git push origin main
   ```

2. 在 GitHub 仓库中启用 Pages：
   - 进入仓库的 **Settings** → **Pages**
   - 在 **Source** 部分选择 **GitHub Actions**
   - 保存设置

3. 等待 Actions 完成部署（约 1-2 分钟）

4. 访问你的网站：`https://你的用户名.github.io/仓库名/`

### 方法二：手动设置（简单快速）

1. 在 GitHub 仓库中：
   - 进入 **Settings** → **Pages**
   - 在 **Source** 部分选择 **Deploy from a branch**
   - 选择分支：`main`
   - 选择文件夹：`/ (root)`
   - 点击 **Save**

2. 等待几分钟，GitHub 会自动构建并部署

3. 访问你的网站：`https://你的用户名.github.io/仓库名/`

### 注意事项

- 确保所有资源路径使用相对路径（项目中已正确配置）
- 首次部署可能需要几分钟时间
- 如果仓库是私有的，GitHub Pages 可能需要升级账户（或使用其他免费方案）

